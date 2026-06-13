"use client";

import { useReducer } from "react";

import { JDInput } from "@/components/JDInput";
import { ResumeUpload } from "@/components/ResumeUpload";
import { initialState, pageReducer } from "@/lib/reducer";

export default function Home() {
  const [state, dispatch] = useReducer(pageReducer, initialState);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
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
    </main>
  );
}
