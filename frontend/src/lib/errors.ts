// Mirror of app/errors.py ErrorCode StrEnum plus a few frontend-only
// codes (network + unknown). Backend codes must stay in lockstep
// with the Python StrEnum (AR3).
export type ErrorCode =
  | "PDF_PARSE_FAILED"
  | "JD_TOO_SHORT"
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "LLM_INVALID_RESPONSE"
  | "LLM_UNAVAILABLE"
  | "INVALID_INPUT"
  | "INTERNAL_ERROR"
  // Frontend-only
  | "NETWORK_ERROR"
  | "UNKNOWN_ERROR";

export const ERROR_COPY: Record<ErrorCode, string> = {
  INVALID_FILE_TYPE: "Only PDF files are supported.",
  FILE_TOO_LARGE: "Resume must be under 5 MB.",
  JD_TOO_SHORT: "Job description must be at least 50 characters.",
  PDF_PARSE_FAILED:
    "PDF appears to be a scanned image or empty — try a text-based PDF.",
  LLM_UNAVAILABLE:
    "The AI service is temporarily unavailable. Please retry in a moment.",
  LLM_INVALID_RESPONSE:
    "The AI returned an unusable response. Please try again.",
  INTERNAL_ERROR: "Something went wrong on our end. Please try again.",
  INVALID_INPUT: "Some of the inputs are invalid. Please check them and retry.",
  NETWORK_ERROR:
    "Could not reach the customize service. Check your connection.",
  UNKNOWN_ERROR: "Something went wrong. Please try again.",
};

export function copyFor(code: string): string {
  return code in ERROR_COPY
    ? ERROR_COPY[code as ErrorCode]
    : ERROR_COPY.UNKNOWN_ERROR;
}
