"use client";

import { MAX_JD_CHARS, MIN_JD_CHARS } from "@/lib/constants";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function JDInput({ value, onChange }: Props) {
  const charCount = value.length;
  // Validation gates use the trimmed length so the counter UX matches
  // the server, which calls len(jd.strip()). The visible char counter
  // still shows the raw count so the user sees what they typed.
  const trimmedLen = value.trim().length;
  const tooShort = trimmedLen > 0 && trimmedLen < MIN_JD_CHARS;
  const tooLong = trimmedLen > MAX_JD_CHARS;

  let message = " ";
  if (tooLong) {
    message = `Too long by ${(trimmedLen - MAX_JD_CHARS).toLocaleString()}. Max ${MAX_JD_CHARS.toLocaleString()} characters.`;
  } else if (tooShort) {
    message = `Need at least ${MIN_JD_CHARS} characters (${MIN_JD_CHARS - trimmedLen} more).`;
  }

  const messageClass = tooLong
    ? "text-red-600 dark:text-red-400"
    : tooShort
      ? "text-amber-600 dark:text-amber-400"
      : "text-zinc-500 dark:text-zinc-400";

  const counterClass = tooLong
    ? "font-mono text-red-600 dark:text-red-400"
    : "font-mono text-zinc-500 dark:text-zinc-400";

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
        <span className={messageClass}>{message}</span>
        <span className={counterClass}>
          {charCount.toLocaleString()} / {MAX_JD_CHARS.toLocaleString()} chars
        </span>
      </div>
    </div>
  );
}
