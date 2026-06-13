from enum import StrEnum


class ErrorCode(StrEnum):
    PDF_PARSE_FAILED = "PDF_PARSE_FAILED"
    LLM_FAILED = "LLM_FAILED"
    INVALID_INPUT = "INVALID_INPUT"


class AppError(Exception):
    """Base for typed, user-facing application errors.

    The exception handler in app.main converts these to a JSON response of
    the shape {"error": {"code": ..., "message": ...}} with the given
    status code.
    """

    status_code: int = 400
    code: ErrorCode = ErrorCode.INVALID_INPUT

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class PDFParseError(AppError):
    status_code = 400
    code = ErrorCode.PDF_PARSE_FAILED
