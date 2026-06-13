import type { CustomizedResume, SavedResumeMeta } from "./types";

export type Status = "idle" | "customizing" | "success" | "error";

export type ResumeFile = {
  file: File;
  name: string;
  sizeBytes: number;
};

export type PageError = {
  code: string;
  message: string;
};

export type PageState = {
  jd: string;
  resumeFile: ResumeFile | null;
  // Server-persisted resume for authenticated users. Loaded on mount;
  // null for anonymous users or users who haven't uploaded yet.
  savedResume: SavedResumeMeta | null;
  status: Status;
  // During streaming, fields fill in one by one — so the type is partial.
  // Non-streaming responses still populate all four fields at once.
  result: Partial<CustomizedResume> | null;
  error: PageError | null;
};

export type Action =
  | { type: "set_jd"; value: string }
  | { type: "set_resume"; file: ResumeFile }
  | { type: "clear_resume" }
  | { type: "set_saved_resume"; meta: SavedResumeMeta }
  | { type: "clear_saved_resume" }
  | { type: "customize_start" }
  | { type: "customize_partial"; payload: Partial<CustomizedResume> }
  | { type: "customize_success"; payload: CustomizedResume }
  | { type: "customize_error"; error: PageError }
  | { type: "reset" };

export const initialState: PageState = {
  jd: "",
  resumeFile: null,
  savedResume: null,
  status: "idle",
  result: null,
  error: null,
};

export function pageReducer(state: PageState, action: Action): PageState {
  switch (action.type) {
    case "set_jd":
      return { ...state, jd: action.value };
    case "set_resume":
      return { ...state, resumeFile: action.file };
    case "clear_resume":
      return { ...state, resumeFile: null };
    case "set_saved_resume":
      return { ...state, savedResume: action.meta };
    case "clear_saved_resume":
      return { ...state, savedResume: null };
    case "customize_start":
      return { ...state, status: "customizing", result: null, error: null };
    case "customize_partial":
      return {
        ...state,
        result: { ...(state.result ?? {}), ...action.payload },
      };
    case "customize_success":
      return { ...state, status: "success", result: action.payload, error: null };
    case "customize_error":
      return { ...state, status: "error", error: action.error };
    case "reset":
      return initialState;
  }
}
