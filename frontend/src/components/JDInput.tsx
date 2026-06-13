"use client";

import { MIN_JD_CHARS } from "@/lib/constants";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function JDInput({ value, onChange }: Props) {
  const charCount = value.length;
  const tooShort = charCount > 0 && charCount < MIN_JD_CHARS;

  return (
    <div className="flex flex-col gap-2 w-full">
      <label htmlFor="jd-input" className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Job Description
      </label>
      <textarea
        id="jd-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Paste the job description here..."
        rows={10}
        className="w-full min-h-[200px] resize-y rounded-lg border border-zinc-300 bg-white p-3 font-mono text-sm leading-relaxed text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 dark:focus:border-zinc-100"
      />
      <div className="flex items-center justify-between text-xs">
        <span
          className={
            tooShort
              ? "text-amber-600 dark:text-amber-400"
              : "text-zinc-500 dark:text-zinc-400"
          }
        >
          {tooShort
            ? `Need at least ${MIN_JD_CHARS} characters (${MIN_JD_CHARS - charCount} more).`
            : " "}
        </span>
        <span className="font-mono text-zinc-500 dark:text-zinc-400">
          {charCount.toLocaleString()} chars
        </span>
      </div>
    </div>
  );
}
