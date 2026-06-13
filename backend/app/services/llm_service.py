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
- summary: 200-600 char tailored summary that highlights overlap with the JD.
- skills: 5-20 short strings (each <=60 chars) drawn from the original resume \
that match the JD.
- experience: 3-30 short bullets (each <=400 chars) REPHRASING bullets that \
already appear in the original resume to emphasize JD-relevant aspects. \
NEVER invent companies, job titles, dates, or experiences that are not \
already in the original resume.
- suggested_additions: 0-10 short strings (each <=60 chars) listing skills \
or qualifications named in the JD that the candidate does NOT currently \
show. Each entry MUST be a phrase that literally appears in the JD.

Strict rules:
1. Do not fabricate employer names, project names, or titles in 'experience'. \
   Every proper noun in an experience bullet must already appear somewhere in \
   the original resume.
2. Every suggested_additions item must appear verbatim (case-insensitive) in \
   the JD text.
3. Output a single JSON object only, no commentary.
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


def _proper_noun_phrases(text: str) -> set[str]:
    return {m.group(0).lower() for m in _PROPER_NOUN_PATTERN.finditer(text)}


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


def _validate_response(
    raw_json: str, jd: str, original_resume: str
) -> CustomizedResume | _ValidationFailure:
    """Parse, schema-validate, and run post-checks on a single LLM reply."""
    try:
        payload = json.loads(raw_json)
    except json.JSONDecodeError as exc:
        return _ValidationFailure(f"response was not valid JSON: {exc}")

    try:
        result = CustomizedResume.model_validate(payload)
    except ValidationError as exc:
        return _ValidationFailure(f"response violated schema: {exc.errors()[:3]}")

    for check in (
        _check_suggested_additions_in_jd(result, jd),
        _check_no_fabricated_employers(result, original_resume),
    ):
        if check is not None:
            return _ValidationFailure(check)
    return result


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
