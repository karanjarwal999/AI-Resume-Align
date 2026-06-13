import type {
  ApiErrorPayload,
  CustomizedResume,
  HistoryDetail,
  HistoryListItem,
  SavedResumeMeta,
} from "./types";

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
  resume: File | null,
  idToken?: string,
  useSaved = false,
): Promise<CustomizedResume> {
  const body = new FormData();
  body.append("jd", jd);
  if (useSaved) {
    body.append("use_saved", "true");
  } else if (resume) {
    body.append("resume", resume);
  }

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

async function authedGet<T>(path: string, idToken: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  }

  if (response.ok) {
    return (await response.json()) as T;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // not JSON
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
    `Server returned ${response.status}.`,
    response.status,
  );
}

export function fetchHistoryList(idToken: string): Promise<HistoryListItem[]> {
  return authedGet<HistoryListItem[]>("/api/history", idToken);
}

export function fetchHistoryDetail(
  idToken: string,
  id: string,
): Promise<HistoryDetail> {
  return authedGet<HistoryDetail>(`/api/history/${id}`, idToken);
}

export function fetchSavedResume(idToken: string): Promise<SavedResumeMeta> {
  return authedGet<SavedResumeMeta>("/api/resume", idToken);
}

export async function replaceSavedResume(
  resume: File,
  idToken: string,
): Promise<SavedResumeMeta> {
  const body = new FormData();
  body.append("resume", resume);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/resume`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${idToken}` },
      body,
    });
  } catch {
    throw new ApiError(
      "NETWORK_ERROR",
      "Could not reach the server. Check your connection and try again.",
      0,
    );
  }

  if (response.ok) {
    return (await response.json()) as SavedResumeMeta;
  }

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // not JSON
  }
  if (isApiErrorPayload(payload)) {
    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }
  throw new ApiError(
    "UNKNOWN_ERROR",
    `Server returned ${response.status}.`,
    response.status,
  );
}

export type StreamCallbacks = {
  onPartial: (partial: Partial<CustomizedResume>) => void;
  onComplete: () => void;
  onError: (err: ApiError) => void;
};

export async function customizeResumeStream(
  jd: string,
  resume: File | null,
  idToken: string | undefined,
  callbacks: StreamCallbacks,
  useSaved = false,
): Promise<void> {
  const body = new FormData();
  body.append("jd", jd);
  if (useSaved) {
    body.append("use_saved", "true");
  } else if (resume) {
    body.append("resume", resume);
  }

  const headers: HeadersInit = {};
  if (idToken) headers["Authorization"] = `Bearer ${idToken}`;

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/customize/stream`, {
      method: "POST",
      headers,
      body,
    });
  } catch {
    callbacks.onError(
      new ApiError(
        "NETWORK_ERROR",
        "Could not reach the customize service. Check your connection and try again.",
        0,
      ),
    );
    return;
  }

  // Pre-stream validation errors arrive as a normal JSON error envelope.
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      // not JSON
    }
    if (isApiErrorPayload(payload)) {
      callbacks.onError(
        new ApiError(payload.error.code, payload.error.message, response.status),
      );
    } else {
      callbacks.onError(
        new ApiError(
          "UNKNOWN_ERROR",
          `Customize service returned ${response.status} with no error payload.`,
          response.status,
        ),
      );
    }
    return;
  }

  if (!response.body) {
    callbacks.onError(
      new ApiError(
        "UNKNOWN_ERROR",
        "Streaming response had no body.",
        response.status,
      ),
    );
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let streamErrored = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    // Split off complete NDJSON lines; keep the trailing partial line.
    let newlineAt: number;
    while ((newlineAt = buffered.indexOf("\n")) !== -1) {
      const line = buffered.slice(0, newlineAt).trim();
      buffered = buffered.slice(newlineAt + 1);
      if (!line) continue;

      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line) as Record<string, unknown>;
      } catch {
        continue; // ignore unparseable lines
      }

      if (
        typeof event.error === "object" &&
        event.error !== null &&
        "code" in (event.error as object) &&
        "message" in (event.error as object)
      ) {
        const err = event.error as { code: string; message: string };
        callbacks.onError(new ApiError(err.code, err.message, response.status));
        streamErrored = true;
        // Continue draining so the connection closes cleanly, but skip further events.
        continue;
      }

      if (event.complete === true) {
        if (!streamErrored) callbacks.onComplete();
        continue;
      }

      // Otherwise: it's a per-field partial event.
      callbacks.onPartial(event as Partial<CustomizedResume>);
    }
  }

  // Flush any trailing buffered text (last line without newline).
  const trailing = buffered.trim();
  if (trailing) {
    try {
      const event = JSON.parse(trailing) as Record<string, unknown>;
      if (event.complete === true && !streamErrored) callbacks.onComplete();
      else if (!streamErrored && !("error" in event)) {
        callbacks.onPartial(event as Partial<CustomizedResume>);
      }
    } catch {
      // ignore
    }
  }
}
