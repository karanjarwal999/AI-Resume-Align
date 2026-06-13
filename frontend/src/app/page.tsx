"use client";

import { useReducer } from "react";

import { CustomizeButton } from "@/components/CustomizeButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JDInput } from "@/components/JDInput";
import { ResultPanel } from "@/components/ResultPanel";
import { ResumeUpload } from "@/components/ResumeUpload";
import { ApiError, customizeResume } from "@/lib/api";
import { MIN_JD_CHARS } from "@/lib/constants";
import { initialState, pageReducer } from "@/lib/reducer";

function disabledReason(jd: string, hasResume: boolean): string | undefined {
  const jdShort = jd.trim().length < MIN_JD_CHARS;
  if (jdShort && !hasResume) {
    return `Paste a job description (at least ${MIN_JD_CHARS} characters) and upload your PDF resume.`;
  }
  if (jdShort) {
    return `Job description must be at least ${MIN_JD_CHARS} characters.`;
  }
  if (!hasResume) {
    return "Upload your PDF resume.";
  }
  return undefined;
}

export default function Home() {
  const [state, dispatch] = useReducer(pageReducer, initialState);

  const reason = disabledReason(state.jd, state.resumeFile !== null);
  const isDisabled = reason !== undefined;
  const isLoading = state.status === "customizing";

  const handleCustomize = async () => {
    if (!state.resumeFile) return;
    dispatch({ type: "customize_start" });
    try {
      const result = await customizeResume(state.jd, state.resumeFile.file);
      dispatch({ type: "customize_success", payload: result });
    } catch (err) {
      const error =
        err instanceof ApiError
          ? { code: err.code, message: err.message }
          : { code: "UNKNOWN_ERROR", message: "Something went wrong." };
      dispatch({ type: "customize_error", error });
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
          AI Resume Align
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Paste a JD, upload your resume, and we&apos;ll tailor it for the role.
        </p>
      </header>

      <JDInput
        value={state.jd}
        onChange={(value) => dispatch({ type: "set_jd", value })}
      />

      <ResumeUpload
        value={state.resumeFile}
        onFile={(file) => dispatch({ type: "set_resume", file })}
        onClear={() => dispatch({ type: "clear_resume" })}
      />

      <div className="flex flex-col items-stretch sm:flex-row sm:justify-end">
        <CustomizeButton
          disabled={isDisabled}
          disabledReason={reason}
          loading={isLoading}
          onClick={handleCustomize}
        />
      </div>

      {state.status === "error" && state.error && (
        <ErrorBanner code={state.error.code} onRetry={handleCustomize} />
      )}

      {state.status === "success" && state.result && (
        <ResultPanel result={state.result} />
      )}
    </main>
  );
}
