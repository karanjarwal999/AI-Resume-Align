import type { CustomizedResume } from "./types";

export type Status = "idle" | "customizing" | "success" | "error";

export type ResumeFile = {
  file: File;
  name: string;
  sizeBytes: number;
};

export type PageState = {
  jd: string;
  resumeFile: ResumeFile | null;
  status: Status;
  result: CustomizedResume | null;
  error: string | null;
};

export type Action =
  | { type: "set_jd"; value: string }
  | { type: "set_resume"; file: ResumeFile }
  | { type: "clear_resume" }
  | { type: "customize_start" }
  | { type: "customize_success"; payload: CustomizedResume }
  | { type: "customize_error"; message: string }
  | { type: "reset" };

export const initialState: PageState = {
  jd: "",
  resumeFile: null,
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
    case "customize_start":
      return { ...state, status: "customizing", error: null };
    case "customize_success":
      return { ...state, status: "success", result: action.payload, error: null };
    case "customize_error":
      return { ...state, status: "error", error: action.message };
    case "reset":
      return initialState;
  }
}
