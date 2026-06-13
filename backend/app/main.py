import json
import time
from typing import Annotated

from fastapi import FastAPI, File, Form, Header, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.errors import (
    AppError,
    FileTooLargeError,
    InvalidFileTypeError,
    JDTooShortError,
)
from app.errors import InvalidTokenError
from app.schemas import CustomizedResume, HistoryDetail, HistoryListItem
from app.services.auth import extract_bearer_token, verify_id_token
from app.services.history import (
    DEFAULT_HISTORY_LIMIT,
    get_customization,
    list_customizations,
    save_customization,
)
from app.services.llm_service import customize_resume
from app.services.pdf_parser import parse_pdf

from fastapi import HTTPException

MIN_JD_CHARS = 50
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
    resume: Annotated[UploadFile, File()],
    authorization: Annotated[str | None, Header()] = None,
) -> CustomizedResume:
    start = time.perf_counter()
    status_code = 200
    error_code: str | None = None
    user_id: str | None = None
    history_write_error: str | None = None
    resume_bytes = b""
    try:
        # Phase 2: if a Bearer token is present, verify it and attach uid
        # to the request for history persistence. Anonymous requests
        # (no header) still proceed exactly as before.
        bearer = extract_bearer_token(authorization)
        if bearer is not None:
            user_id = verify_id_token(bearer)

        if len(jd.strip()) < MIN_JD_CHARS:
            raise JDTooShortError(
                f"Job description must be at least {MIN_JD_CHARS} characters."
            )

        resume_bytes = await resume.read()
        _validate_resume_bytes(resume.filename, resume.content_type, resume_bytes)

        resume_text = parse_pdf(resume_bytes)
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
            "resume_size_bytes": len(resume_bytes),
            "authenticated": user_id is not None,
        }
        if error_code is not None:
            entry["error_code"] = error_code
        if history_write_error is not None:
            entry["history_write_error"] = history_write_error
        print(json.dumps(entry), flush=True)
