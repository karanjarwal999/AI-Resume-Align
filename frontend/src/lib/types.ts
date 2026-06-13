// Field names mirror app/schemas.py exactly (AR2 — no camelCase aliases).
export type CustomizedResume = {
  name: string;
  summary: string;
  skills: string[];
  experience: string[];
  education: string[];
  suggested_additions: string[];
};

export type SavedResumeMeta = {
  file_name: string;
  file_size_bytes: number;
  updated_at: string;  // ISO string
};

export type HistoryListItem = {
  id: string;
  timestamp: string;  // ISO string
  jd_preview: string;
};

export type HistoryDetail = {
  id: string;
  timestamp: string;
  jd_text: string;
  customized_resume: CustomizedResume;
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};
