from enum import StrEnum


class ErrorCode(StrEnum):
    PDF_PARSE_FAILED = "PDF_PARSE_FAILED"
    JD_TOO_SHORT = "JD_TOO_SHORT"
    INVALID_FILE_TYPE = "INVALID_FILE_TYPE"
    FILE_TOO_LARGE = "FILE_TOO_LARGE"
    LLM_INVALID_RESPONSE = "LLM_INVALID_RESPONSE"
    LLM_UNAVAILABLE = "LLM_UNAVAILABLE"
    INVALID_INPUT = "INVALID_INPUT"
    INVALID_TOKEN = "INVALID_TOKEN"
    INTERNAL_ERROR = "INTERNAL_ERROR"


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


class JDTooShortError(AppError):
    status_code = 400
    code = ErrorCode.JD_TOO_SHORT


class InvalidFileTypeError(AppError):
    status_code = 400
    code = ErrorCode.INVALID_FILE_TYPE


class FileTooLargeError(AppError):
    status_code = 400
    code = ErrorCode.FILE_TOO_LARGE


class InvalidTokenError(AppError):
    status_code = 401
    code = ErrorCode.INVALID_TOKEN


class LLMError(AppError):
    """Base for Gemini-related failures (502)."""

    status_code = 502


class LLMUnavailableError(LLMError):
    code = ErrorCode.LLM_UNAVAILABLE


class LLMInvalidResponseError(LLMError):
    code = ErrorCode.LLM_INVALID_RESPONSE
