// Field names mirror app/schemas.py exactly (AR2 — no camelCase aliases).
export type CustomizedResume = {
  summary: string;
  skills: string[];
  experience: string[];
  suggested_additions: string[];
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
  };
};
