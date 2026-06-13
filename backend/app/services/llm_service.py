"""Gemini-backed resume customization service.

The service stays HTTP-agnostic (no FastAPI imports) so it can be
exercised from tests or another caller. Failures from the underlying
Gemini SDK or from server-side validation are surfaced as typed
LLMError subclasses for the HTTP layer to translate.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass

from google import genai
from google.genai import types
from pydantic import ValidationError

from app.errors import LLMInvalidResponseError, LLMUnavailableError
from app.schemas import CustomizedResume


_SYSTEM_INSTRUCTION = """You are a resume tailoring assistant.

You will receive a job description (JD) and a candidate's original resume text. \
Produce a JSON object that tailors the resume to that JD. Output JSON only -- \
no markdown fences, no prose around it.

Required fields:
- name: the candidate's full name, exactly as it appears in the original \
resume (typically at the top). Copy it verbatim -- do not invent or paraphrase.
- summary: 200-600 char tailored summary that highlights overlap with the JD.
- skills: 5-20 short strings (each <=60 chars) drawn from the original resume \
that match the JD.
- experience: 3-30 short bullets (each <=400 chars) REPHRASING bullets that \
already appear in the original resume to emphasize JD-relevant aspects. \
NEVER invent companies, job titles, dates, or experiences that are not \
already in the original resume.
- education: 1-10 entries (each <=200 chars) drawn from the original resume's \
education section. Keep each entry close to the resume's original text \
(school name, degree, year). NEVER invent schools, programs, or dates.
- suggested_additions: 0-10 short strings (each <=60 chars) listing skills \
or qualifications named in the JD that the candidate does NOT currently \
show. Each entry MUST be a phrase that literally appears in the JD.

Strict rules:
1. Do not fabricate employer names, project names, or titles in 'experience'. \
   Every proper noun in an experience bullet must already appear somewhere in \
   the original resume.
2. Do not fabricate schools, universities, or programs in 'education'. Every \
   proper noun in an education entry must already appear in the original resume.
3. The 'name' field must appear (case-insensitive) in the original resume.
4. Every suggested_additions item must appear verbatim (case-insensitive) in \
   the JD text.
5. Output a single JSON object only, no commentary.
"""

# Captures Title-Case 2+ word phrases like "Acme Inc", "Microsoft Research",
# "Goldman Sachs", "Google LLC". Single capitalized words are allowed through
# (too common: "Engineer", "Senior", "Led").
_PROPER_NOUN_PATTERN = re.compile(
    r"\b[A-Z][A-Za-z0-9]*(?:\s+(?:&\s+|of\s+|the\s+)?[A-Z][A-Za-z0-9]*)+\b"
)


@dataclass
class _ValidationFailure:
    """In-band signal that a response failed shape or post-check validation."""

    reason: str


_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")
_WHITESPACE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _WHITESPACE.sub(" ", text.lower()).strip()


def _proper_noun_phrases(text: str) -> set[str]:
    """Extract Title-Case 2+ word phrases from `text`, ignoring matches
    that span a sentence-initial word. Without this, bullets like
    "Designed Postgres schemas..." get flagged as introducing the
    proper-noun phrase "Designed Postgres" -- but "Designed" is just a
    sentence-leading verb, not part of an employer or project name.
    """
    out: set[str] = set()
    for sentence in _SENTENCE_SPLIT.split(text):
        sentence = sentence.strip()
        if not sentence:
            continue
        # Decapitalize the first letter so the leading verb/adjective
        # is excluded from proper-noun matching.
        munged = sentence[0].lower() + sentence[1:]
        for match in _PROPER_NOUN_PATTERN.finditer(munged):
            out.add(match.group(0).lower())
    return out


def _check_suggested_additions_in_jd(result: CustomizedResume, jd: str) -> str | None:
    jd_lower = jd.lower()
    for item in result.suggested_additions:
        if item.lower() not in jd_lower:
            return f"suggested_addition not found in JD: {item!r}"
    return None


def _check_no_fabricated_employers(
    result: CustomizedResume, original_resume: str
) -> str | None:
    resume_lower = original_resume.lower()
    for bullet in result.experience:
        for phrase in _proper_noun_phrases(bullet):
            if phrase not in resume_lower:
                return (
                    "experience bullet introduces a proper noun not in the "
                    f"original resume: {phrase!r}"
                )
    return None


def _check_name_in_resume(
    result: CustomizedResume, original_resume: str
) -> str | None:
    name_norm = _normalize(result.name)
    if not name_norm:
        return "name was empty"
    if name_norm not in _normalize(original_resume):
        return f"name not found in original resume: {result.name!r}"
    return None


def _validate_response(
    raw_json: str, jd: str, original_resume: str
) -> CustomizedResume | _ValidationFailure:
    """Parse, schema-validate, and run post-checks on a single LLM reply."""
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        failure = _ValidationFailure(f"response was not valid JSON: {exc}")
        _log_validation_failure(failure.reason)
        return failure

    try:
        result = CustomizedResume.model_validate(payload)
    except ValidationError as exc:
        failure = _ValidationFailure(
            f"response violated schema: {exc.errors()[:3]}"
        )
        _log_validation_failure(failure.reason)
        return failure

    # The education entries are kept honest by the system prompt
    # ("draw from original resume, never invent schools"). A second
    # proper-noun post-check was too strict in practice: faithful
    # acronym rephrases like resume="MIT" -> LLM="Massachusetts
    # Institute of Technology" got rejected because the rephrased
    # tokens don't appear in the lowercased original resume. We
    # accept the prompt as sufficient guardrail here.
    for check in (
        _check_name_in_resume(result, original_resume),
        _check_no_fabricated_employers(result, original_resume),
        _check_suggested_additions_in_jd(result, jd),
    ):
        if check is not None:
            _log_validation_failure(check)
            return _ValidationFailure(check)
    return result


def _log_validation_failure(reason: str) -> None:
    """Surface the post-check reason to the backend log so failures are
    diagnosable. The user-facing error stays generic for security; the
    detail goes only to server logs."""
    print(
        json.dumps({"event": "llm_validation_failure", "reason": reason}),
        flush=True,
    )


def _build_client(api_key: str) -> genai.Client:
    if not api_key:
        raise LLMUnavailableError(
            "Gemini is not configured. Set GEMINI_API_KEY in the backend environment."
        )
    return genai.Client(api_key=api_key)


def _generate(
    client: genai.Client,
    model: str,
    jd: str,
    resume_text: str,
    feedback: str | None,
) -> str:
    """Single attempt at calling Gemini. Returns the raw JSON text on success.

    Raises an exception (caught by the caller) on transport / SDK failure.
    """
    user_payload = (
        f"JOB DESCRIPTION:\n{jd}\n\n"
        f"ORIGINAL RESUME TEXT:\n{resume_text}"
    )
    if feedback:
        user_payload += (
            "\n\nYour previous response was rejected because: "
            f"{feedback}\nProduce a corrected response that satisfies all rules."
        )

    response = client.models.generate_content(
        model=model,
        contents=user_payload,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=CustomizedResume,
            temperature=0.3,
        ),
    )
    return response.text or ""


def _stream(
    client: genai.Client,
    model: str,
    jd: str,
    resume_text: str,
):
    """Default streaming generator. Tests inject a fake to avoid the
    network call."""
    user_payload = (
        f"JOB DESCRIPTION:\n{jd}\n\n"
        f"ORIGINAL RESUME TEXT:\n{resume_text}"
    )
    return client.models.generate_content_stream(
        model=model,
        contents=user_payload,
        config=types.GenerateContentConfig(
            system_instruction=_SYSTEM_INSTRUCTION,
            response_mime_type="application/json",
            response_schema=CustomizedResume,
            temperature=0.3,
        ),
    )


_STREAM_FIELDS = (
    "name",
    "summary",
    "skills",
    "experience",
    "education",
    "suggested_additions",
)


class _FieldStreamer:
    """Accumulates streamed JSON text and yields one {field: value} dict
    per known top-level field as soon as that field's value parses.

    Uses json.JSONDecoder.raw_decode to detect when a value is complete:
    if raw_decode succeeds on the next-value position, we have the full
    string / list / number, no matter how Gemini chunked it.
    """

    def __init__(self) -> None:
        self.buffer = ""
        self._emitted: set[str] = set()
        self._decoder = json.JSONDecoder()

    def feed(self, chunk: str):
        if not chunk:
            return
        self.buffer += chunk
        for field in _STREAM_FIELDS:
            if field in self._emitted:
                continue
            value = self._try_field(field)
            if value is not None:
                self._emitted.add(field)
                yield {field: value[0]}

    def _try_field(self, field: str):
        # Anchor to a JSON key position: the key must be preceded by
        # `{` or `,` (with optional whitespace) so we don't false-match
        # the literal substring inside another field's value -- e.g. a
        # summary that contains the word "name" would otherwise hijack
        # the `name` field.
        pattern = re.compile(r'[{,]\s*"' + re.escape(field) + r'"\s*:')
        match = pattern.search(self.buffer)
        if match is None:
            return None
        pos = match.end()
        while pos < len(self.buffer) and self.buffer[pos].isspace():
            pos += 1
        if pos >= len(self.buffer):
            return None
        try:
            value, _ = self._decoder.raw_decode(self.buffer, pos)
        except json.JSONDecodeError:
            return None
        return (value,)


def customize_resume_stream(
    jd: str,
    resume_text: str,
    *,
    api_key: str,
    model: str,
    _client_factory=_build_client,
    _stream_generator=_stream,
):
    """Streaming counterpart to customize_resume.

    Yields NDJSON-shaped dicts as Gemini's response unfolds:

      {"summary": "..."}
      {"skills": [...]}
      {"experience": [...]}
      {"suggested_additions": [...]}
      {"complete": true, "result": {...}}   # success terminator (full validated result)
      OR
      {"error": {"code": "...", "message": "..."}}  # failure terminator

    Callers stream the per-field dicts to the client and use the
    "complete" terminator's `result` field for history persistence.
    """
    try:
        client = _client_factory(api_key)
    except LLMUnavailableError as exc:
        yield {"error": {"code": exc.code.value, "message": exc.message}}
        return

    streamer = _FieldStreamer()
    try:
        for chunk in _stream_generator(client, model, jd, resume_text):
            text = getattr(chunk, "text", None) or ""
            for emitted in streamer.feed(text):
                yield emitted
    except Exception:
        yield {
            "error": {
                "code": "LLM_UNAVAILABLE",
                "message": "The customize service is temporarily unavailable. Please try again.",
            }
        }
        return

    outcome = _validate_response(streamer.buffer, jd, resume_text)
    if isinstance(outcome, CustomizedResume):
        yield {"complete": True, "result": outcome.model_dump()}
    else:
        yield {
            "error": {
                "code": "LLM_INVALID_RESPONSE",
                "message": "The customize service returned an unusable response. Please try again.",
            }
        }


def customize_resume(
    jd: str,
    resume_text: str,
    *,
    api_key: str,
    model: str,
    _client_factory=_build_client,
    _generator=_generate,
) -> CustomizedResume:
    """Run a JD + resume through Gemini and return a validated CustomizedResume.

    Up to two attempts: the second attempt receives a feedback string
    naming what went wrong in the first attempt. Persistent transport
    failure -> LLMUnavailableError. Persistent shape/check failure ->
    LLMInvalidResponseError.

    Test injection points (`_client_factory`, `_generator`) keep the
    function offline-testable without touching the network.
    """
    client = _client_factory(api_key)
    last_validation_failure: _ValidationFailure | None = None
    last_transport_failure: Exception | None = None

    for attempt in (1, 2):
        feedback = last_validation_failure.reason if last_validation_failure else None
        try:
            raw = _generator(client, model, jd, resume_text, feedback)
        except Exception as exc:
            last_transport_failure = exc
            last_validation_failure = None
            continue

        outcome = _validate_response(raw, jd, resume_text)
        if isinstance(outcome, CustomizedResume):
            return outcome
        last_validation_failure = outcome
        last_transport_failure = None

    if last_transport_failure is not None:
        raise LLMUnavailableError(
            "The customize service is temporarily unavailable. Please try again."
        ) from last_transport_failure
    assert last_validation_failure is not None  # one of the two is always set
    raise LLMInvalidResponseError(
        "The customize service returned an unusable response. Please try again."
    )
