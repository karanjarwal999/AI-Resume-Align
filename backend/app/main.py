import json
import time
from typing import Annotated

from fastapi import FastAPI, File, Form, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.config import settings
from app.errors import (
    AppError,
    FileTooLargeError,
    InvalidFileTypeError,
    InvalidInputError,
    JDTooLongError,
    JDTooShortError,
    NoSavedResumeError,
)
from app.errors import InvalidTokenError
from app.schemas import (
    CustomizedResume,
    HistoryDetail,
    HistoryListItem,
    SavedResumeMeta,
)
from app.services.auth import extract_bearer_token, verify_id_token
from app.services.history import (
    DEFAULT_HISTORY_LIMIT,
    get_customization,
    list_customizations,
    save_customization,
)
from app.services.llm_service import customize_resume, customize_resume_stream
from app.services.pdf_parser import parse_pdf
from app.services.saved_resume import get_saved, upsert_saved

from fastapi import HTTPException

MIN_JD_CHARS = 50
MAX_JD_CHARS = 1500
MAX_RESUME_BYTES = 5 * 1024 * 1024
PDF_MAGIC = b"%PDF"

app = FastAPI(title="AI Resume Align API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(AppError)
async def app_error_handler(_request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code.value, "message": exc.message}},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    _request: Request, _exc: Exception
) -> JSONResponse:
    # NFR2 -- never include stack traces or internal details in the
    # response body. The original exception is logged elsewhere if needed.
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "Something went wrong on our end. Please try again.",
            }
        },
    )


def _require_user_id(authorization: str | None) -> str:
    """Resolve the verified UID or raise InvalidTokenError.

    Used by endpoints that REQUIRE authentication (the history APIs).
    The customize endpoint, which still accepts anonymous traffic,
    uses extract_bearer_token + verify_id_token directly.
    """
    token = extract_bearer_token(authorization)
    if not token:
        raise InvalidTokenError("Sign in to view your history.")
    return verify_id_token(token)


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


@app.post("/api/customize/stream")
async def customize_stream(
    jd: Annotated[str, Form()],
    resume: Annotated[UploadFile | None, File()] = None,
    use_saved: Annotated[bool, Form()] = False,
    authorization: Annotated[str | None, Header()] = None,
) -> StreamingResponse:
    """Phase 2 sibling of /api/customize. Streams partial CustomizedResume
    fields as NDJSON as Gemini's response unfolds. Pre-stream validation
    (auth, JD length, file type/size, PDF parse) returns 4xx via the
    standard error envelope BEFORE any streaming begins; failures
    during the stream are emitted as a final {"error": {...}} NDJSON
    line and then the stream closes (AR — Phase 2 coexistence rule).

    Accepts either a `resume` file upload OR `use_saved=true` (authenticated
    only) to reuse the user's saved-resume text.
    """
    bearer = extract_bearer_token(authorization)
    user_id = verify_id_token(bearer) if bearer else None

    jd_len = len(jd.strip())
    if jd_len < MIN_JD_CHARS:
        raise JDTooShortError(
            f"Job description must be at least {MIN_JD_CHARS} characters."
        )
    if jd_len > MAX_JD_CHARS:
        raise JDTooLongError(
            f"Job description must be {MAX_JD_CHARS:,} characters or fewer."
        )

    resume_text, resume_size_bytes = await _resolve_resume_text(
        resume, use_saved, user_id
    )

    async def ndjson_body():
        start = time.perf_counter()
        result_payload: dict[str, object] | None = None
        error_code: str | None = None
        history_write_error: str | None = None
        try:
            for event in customize_resume_stream(
                jd,
                resume_text,
                api_key=settings.gemini_api_key,
                model=settings.gemini_model,
            ):
                if "complete" in event:
                    result_payload = event.get("result")  # type: ignore[assignment]
                    yield (json.dumps({"complete": True}) + "\n").encode()
                    continue
                if "error" in event:
                    error_code = event["error"]["code"]  # type: ignore[index]
                yield (json.dumps(event) + "\n").encode()

            if result_payload is not None and user_id is not None:
                try:
                    save_customization(
                        user_id=user_id,
                        jd_text=jd,
                        parsed_resume_text=resume_text,
                        customized_resume=CustomizedResume.model_validate(
                            result_payload
                        ),
                    )
                except Exception:
                    history_write_error = "HISTORY_WRITE_FAILED"
        finally:
            entry: dict[str, object] = {
                "event": "customize_stream",
                "duration_ms": int((time.perf_counter() - start) * 1000),
                "status_code": 200,
                "jd_length": len(jd),
                "resume_size_bytes": resume_size_bytes,
                "authenticated": user_id is not None,
                "used_saved_resume": use_saved,
            }
            if error_code is not None:
                entry["error_code"] = error_code
            if history_write_error is not None:
                entry["history_write_error"] = history_write_error
            print(json.dumps(entry), flush=True)

    return StreamingResponse(
        ndjson_body(), media_type="application/x-ndjson"
    )


@app.get("/api/resume")
def get_saved_resume(
    authorization: Annotated[str | None, Header()] = None,
) -> SavedResumeMeta:
    """Return metadata for the caller's saved resume.

    404 NO_SAVED_RESUME when the user has never uploaded a resume yet --
    the frontend treats that as "no chip" and falls back to the upload
    flow. 401 INVALID_TOKEN for anonymous callers.
    """
    user_id = _require_user_id(authorization)
    saved = get_saved(user_id)
    if saved is None:
        raise NoSavedResumeError("No saved resume yet.")
    return SavedResumeMeta(
        file_name=saved["file_name"],
        file_size_bytes=saved["file_size_bytes"],
        updated_at=saved["updated_at"],
    )


@app.put("/api/resume")
async def replace_saved_resume(
    resume: Annotated[UploadFile, File()],
    authorization: Annotated[str | None, Header()] = None,
) -> SavedResumeMeta:
    """Replace the caller's saved resume with a fresh upload.

    Upsert semantics: previous record (if any) is overwritten. The PDF
    bytes are NOT persisted -- only the parsed text + metadata.
    """
    user_id = _require_user_id(authorization)
    resume_bytes = await resume.read()
    _validate_resume_bytes(resume.filename, resume.content_type, resume_bytes)
    parsed = parse_pdf(resume_bytes)
    meta = upsert_saved(
        user_id=user_id,
        parsed_text=parsed,
        file_name=resume.filename or "resume.pdf",
        file_size_bytes=len(resume_bytes),
    )
    return SavedResumeMeta(**meta)


@app.get("/api/history")
def history_list(
    authorization: Annotated[str | None, Header()] = None,
) -> list[HistoryListItem]:
    user_id = _require_user_id(authorization)
    return [
        HistoryListItem(**item)
        for item in list_customizations(
            user_id=user_id, limit=DEFAULT_HISTORY_LIMIT
        )
    ]


@app.get("/api/history/{customization_id}")
def history_detail(
    customization_id: str,
    authorization: Annotated[str | None, Header()] = None,
) -> HistoryDetail:
    user_id = _require_user_id(authorization)
    doc = get_customization(
        user_id=user_id, customization_id=customization_id
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="Customization not found.")
    return HistoryDetail(**doc)


async def _resolve_resume_text(
    resume: UploadFile | None,
    use_saved: bool,
    user_id: str | None,
) -> tuple[str, int]:
    """Return (parsed_resume_text, byte_size_for_log) for a customize call.

    Two branches:
    - use_saved=True: require auth, no upload, fetch from saved_resumes.
    - use_saved=False: require upload, validate, parse_pdf as before.

    Raises AppError subclasses for any rejection so callers don't need
    to inspect return values for failure.
    """
    if use_saved:
        if user_id is None:
            raise InvalidTokenError("Sign in to use your saved resume.")
        if resume is not None and (resume.filename or "").strip():
            raise InvalidInputError(
                "Send either a resume file or use_saved=true, not both."
            )
        saved = get_saved(user_id)
        if saved is None:
            raise NoSavedResumeError(
                "No saved resume yet. Upload one first.",
                status_code=400,
            )
        return saved["parsed_text"], int(saved.get("file_size_bytes", 0))

    if resume is None or not (resume.filename or "").strip():
        raise InvalidInputError(
            "A resume file is required when use_saved is false."
        )
    resume_bytes = await resume.read()
    _validate_resume_bytes(resume.filename, resume.content_type, resume_bytes)
    parsed = parse_pdf(resume_bytes)
    return parsed, len(resume_bytes)


def _validate_resume_bytes(name: str | None, content_type: str | None, data: bytes) -> None:
    extension_ok = bool(name) and name.lower().endswith(".pdf")
    content_type_ok = content_type == "application/pdf"
    if not (extension_ok or content_type_ok):
        raise InvalidFileTypeError(
            "Only PDF resumes are accepted. Please upload a .pdf file."
        )
    if len(data) > MAX_RESUME_BYTES:
        mb = len(data) / (1024 * 1024)
        raise FileTooLargeError(
            f"Resume must be under 5 MB. This file is {mb:.1f} MB."
        )
    if not data.startswith(PDF_MAGIC):
        raise InvalidFileTypeError(
            "Uploaded file does not look like a PDF (missing PDF header)."
        )


@app.post("/api/customize")
async def customize(
    jd: Annotated[str, Form()],
    resume: Annotated[UploadFile | None, File()] = None,
    use_saved: Annotated[bool, Form()] = False,
    authorization: Annotated[str | None, Header()] = None,
) -> CustomizedResume:
    start = time.perf_counter()
    status_code = 200
    error_code: str | None = None
    user_id: str | None = None
    history_write_error: str | None = None
    resume_size_bytes = 0
    try:
        # Phase 2: if a Bearer token is present, verify it and attach uid
        # to the request for history persistence. Anonymous requests
        # (no header) still proceed exactly as before.
        bearer = extract_bearer_token(authorization)
        if bearer is not None:
            user_id = verify_id_token(bearer)

        jd_len = len(jd.strip())
        if jd_len < MIN_JD_CHARS:
            raise JDTooShortError(
                f"Job description must be at least {MIN_JD_CHARS} characters."
            )
        if jd_len > MAX_JD_CHARS:
            raise JDTooLongError(
                f"Job description must be {MAX_JD_CHARS:,} characters or fewer."
            )

        resume_text, resume_size_bytes = await _resolve_resume_text(
            resume, use_saved, user_id
        )
        result = customize_resume(
            jd,
            resume_text,
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )

        # AR — authenticated runs are persisted to Firestore; anonymous
        # runs are deliberately NOT stored. A storage failure must not
        # break the user-facing 200, so we swallow and log it.
        if user_id is not None:
            try:
                save_customization(
                    user_id=user_id,
                    jd_text=jd,
                    parsed_resume_text=resume_text,
                    customized_resume=result,
                )
            except Exception:
                history_write_error = "HISTORY_WRITE_FAILED"

        return result
    except AppError as exc:
        status_code = exc.status_code
        error_code = exc.code.value
        raise
    except Exception:
        status_code = 500
        error_code = "INTERNAL_ERROR"
        raise
    finally:
        # AR8 / AC7 — single-line JSON log, no JD or resume content.
        entry: dict[str, object] = {
            "event": "customize",
            "duration_ms": int((time.perf_counter() - start) * 1000),
            "status_code": status_code,
            "jd_length": len(jd),
            "resume_size_bytes": resume_size_bytes,
            "authenticated": user_id is not None,
            "used_saved_resume": use_saved,
        }
        if error_code is not None:
            entry["error_code"] = error_code
        if history_write_error is not None:
            entry["history_write_error"] = history_write_error
        print(json.dumps(entry), flush=True)
