import type { ApiErrorPayload, CustomizedResume } from "./types";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

function isApiErrorPayload(value: unknown): value is ApiErrorPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { error?: unknown };
  if (typeof v.error !== "object" || v.error === null) return false;
  const e = v.error as { code?: unknown; message?: unknown };
  return typeof e.code === "string" && typeof e.message === "string";
}

export async function customizeResume(
  jd: string,
  resume: File,
  idToken?: string,
): Promise<CustomizedResume> {
  const body = new FormData();
  body.append("jd", jd);
  body.append("resume", resume);

  const headers: HeadersInit = {};
  if (idToken) {
    headers["Authorization"] = `Bearer ${idToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/customize`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Could not reach the customize service. Check your connection and try again.",
      0,
    );
  }

  if (response.ok) {
    return (await response.json()) as CustomizedResume;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // body was not JSON
  }
  if (isApiErrorPayload(payload)) {
    throw new ApiError(
      payload.error.code,
      payload.error.message,
      response.status,
    );
  }
  throw new ApiError(
    "UNKNOWN_ERROR",
    `Customize service returned ${response.status} with no error payload.`,
    response.status,
  );
}
