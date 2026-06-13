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
from app.schemas import CustomizedResume
from app.services.llm_service import customize_resume
from app.services.pdf_parser import parse_pdf

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


@app.get("/health")
def health() -> dict[str, bool]:
    return {"ok": True}


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
    # AR13 / AC9 — accept an optional Bearer token but ignore its value in MVP.
    del authorization

    start = time.perf_counter()
    status_code = 200
    error_code: str | None = None
    resume_bytes = b""
    try:
        if len(jd.strip()) < MIN_JD_CHARS:
            raise JDTooShortError(
                f"Job description must be at least {MIN_JD_CHARS} characters."
            )

        resume_bytes = await resume.read()
        _validate_resume_bytes(resume.filename, resume.content_type, resume_bytes)

        resume_text = parse_pdf(resume_bytes)
        return customize_resume(
            jd,
            resume_text,
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
        )
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
        entry = {
            "event": "customize",
            "duration_ms": int((time.perf_counter() - start) * 1000),
            "status_code": status_code,
            "jd_length": len(jd),
            "resume_size_bytes": len(resume_bytes),
        }
        if error_code is not None:
            entry["error_code"] = error_code
        print(json.dumps(entry), flush=True)
