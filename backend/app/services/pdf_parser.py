import io

import pdfplumber

from app.errors import PDFParseError

MIN_EXTRACTED_CHARS = 100

_SCANNED_OR_EMPTY_MESSAGE = (
    "PDF appears to be a scanned image or empty — please upload a text-based PDF."
)


def parse_pdf(data: bytes) -> str:
    """Extract text from PDF bytes.

    Returns the joined per-page text as a single string. Raises
    PDFParseError if the file cannot be parsed at all, or if the
    extracted text is too short to be a real resume (suggesting a
    scanned image or near-empty document).

    The input bytes and the extracted text are held in memory for the
    duration of the call only and are never written to disk or logged.
    """
    try:
        with pdfplumber.open(io.BytesIO(data)) as pdf:
            pages = [page.extract_text() or "" for page in pdf.pages]
    except Exception as exc:  # pdfplumber surfaces a few different parser errors
        raise PDFParseError(_SCANNED_OR_EMPTY_MESSAGE) from exc

    text = "\n".join(pages)
    if len(text.strip()) < MIN_EXTRACTED_CHARS:
        raise PDFParseError(_SCANNED_OR_EMPTY_MESSAGE)
    return text
