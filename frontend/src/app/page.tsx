"use client";

import { useEffect, useReducer, useState } from "react";

import { AuthHeader } from "@/components/AuthHeader";
import { CustomizeButton } from "@/components/CustomizeButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import { JDInput } from "@/components/JDInput";
import { ResultPanel } from "@/components/ResultPanel";
import { ResumeUpload } from "@/components/ResumeUpload";
import { SavedResumeChip } from "@/components/SavedResumeChip";
import {
  ApiError,
  customizeResume,
  customizeResumeStream,
  fetchSavedResume,
  replaceSavedResume,
} from "@/lib/api";
import { MAX_JD_CHARS, MIN_JD_CHARS } from "@/lib/constants";
import { initialState, pageReducer } from "@/lib/reducer";
import type { CustomizedResume } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

function disabledReason(jd: string, hasResume: boolean): string | undefined {
  const trimmedLen = jd.trim().length;
  const jdShort = trimmedLen < MIN_JD_CHARS;
  const jdLong = trimmedLen > MAX_JD_CHARS;
  if (jdShort && !hasResume) {
    return `Paste a job description (at least ${MIN_JD_CHARS} characters) and upload your PDF resume.`;
  }
  if (jdShort) {
    return `Job description must be at least ${MIN_JD_CHARS} characters.`;
  }
  if (jdLong) {
    return `Job description must be ${MAX_JD_CHARS.toLocaleString()} characters or fewer.`;
  }
  if (!hasResume) {
    return "Upload your PDF resume.";
  }
  return undefined;
}

export default function Home() {
  const [state, dispatch] = useReducer(pageReducer, initialState);
  const { user, ready } = useAuth();
  // Off by default per AR — keep the proven non-streaming path until
  // streaming has been verified in production.
  const [useStreaming, setUseStreaming] = useState(false);

  // On auth-ready, fetch the user's saved resume (if any). A 404 means
  // "no saved resume yet" — we silently fall back to the upload flow.
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const meta = await fetchSavedResume(idToken);
        if (!cancelled) dispatch({ type: "set_saved_resume", meta });
      } catch (err) {
        // 404 NO_SAVED_RESUME is the expected first-time case. Anything
        // else we silently ignore here so it doesn't block the page —
        // the user can still upload fresh.
        if (
          err instanceof ApiError &&
          err.code !== "NO_SAVED_RESUME" &&
          err.code !== "NETWORK_ERROR"
        ) {
          console.warn("fetchSavedResume failed:", err.code, err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user]);

  // A fresh manual upload takes precedence over the saved resume for
  // *this* customize call. Otherwise, the saved resume counts as
  // "have resume" for the gate.
  const usingSaved = state.savedResume !== null && state.resumeFile === null;
  const hasResume = state.resumeFile !== null || state.savedResume !== null;
  const reason = disabledReason(state.jd, hasResume);
  const isDisabled = reason !== undefined;
  const isLoading = state.status === "customizing";

  const handleReplace = async (file: File) => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const meta = await replaceSavedResume(file, idToken);
    dispatch({ type: "set_saved_resume", meta });
    // Drop any one-off fresh upload so the new saved version is what
    // the next customize call uses.
    dispatch({ type: "clear_resume" });
  };

  const runNonStreaming = async (idToken: string | undefined) => {
    try {
      const result = await customizeResume(
        state.jd,
        state.resumeFile?.file ?? null,
        idToken,
        usingSaved,
      );
      dispatch({ type: "customize_success", payload: result });
    } catch (err) {
      const error =
        err instanceof ApiError
          ? { code: err.code, message: err.message }
          : { code: "UNKNOWN_ERROR", message: "Something went wrong." };
      dispatch({ type: "customize_error", error });
    }
  };

  const runStreaming = async (idToken: string | undefined) => {
    let assembled: Partial<CustomizedResume> = {};
    await customizeResumeStream(
      state.jd,
      state.resumeFile?.file ?? null,
      idToken,
      {
        onPartial: (partial) => {
          assembled = { ...assembled, ...partial };
          dispatch({ type: "customize_partial", payload: partial });
        },
        onComplete: () => {
          dispatch({
            type: "customize_success",
            payload: assembled as CustomizedResume,
          });
        },
        onError: (err) => {
          dispatch({
            type: "customize_error",
            error: { code: err.code, message: err.message },
          });
        },
      },
      usingSaved,
    );
  };

  const handleCustomize = async () => {
    if (!state.resumeFile && !state.savedResume) return;
    dispatch({ type: "customize_start" });
    const idToken = user ? await user.getIdToken() : undefined;
    if (useStreaming) {
      await runStreaming(idToken);
    } else {
      await runNonStreaming(idToken);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            AI Resume Align
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paste a JD, upload your resume, and we&apos;ll tailor it for the
            role.
          </p>
        </div>
        <AuthHeader />
      </header>

      <JDInput
        value={state.jd}
        onChange={(value) => dispatch({ type: "set_jd", value })}
      />

      {state.savedResume && (
        <SavedResumeChip
          meta={state.savedResume}
          onReplace={handleReplace}
        />
      )}

      <ResumeUpload
        value={state.resumeFile}
        onFile={(file) => dispatch({ type: "set_resume", file })}
        onClear={() => dispatch({ type: "clear_resume" })}
      />

      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 sm:mr-auto">
          <input
            type="checkbox"
            checked={useStreaming}
            onChange={(e) => setUseStreaming(e.target.checked)}
            disabled={isLoading}
            className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
          />
          Stream results as they arrive (experimental)
        </label>
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

      {state.result && state.status !== "error" && state.status === "customizing" && (
        <ResultPanel result={state.result} isStreaming />
      )}

      {state.result && state.status === "success" && (
        <ResultPanel result={state.result} />
      )}

      {/* Mid-stream error path: keep the partial content visible (AC4 of 2.5). */}
      {state.result && state.status === "error" && (
        <ResultPanel result={state.result} />
      )}
    </main>
  );
}
