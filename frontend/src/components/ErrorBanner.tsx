"use client";

import { copyFor } from "@/lib/errors";

type Props = {
  code: string;
  onRetry: () => void;
};

export function ErrorBanner({ code, onRetry }: Props) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex flex-col">
        <span className="font-semibold">We couldn&apos;t customize your resume.</span>
        <span className="mt-0.5 text-red-700 dark:text-red-400">
          {copyFor(code)}
        </span>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="self-start rounded-md border border-red-400 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-600 dark:bg-zinc-900 dark:text-red-300 dark:hover:bg-red-950/40 sm:self-auto"
      >
        Retry
      </button>
    </div>
  );
}
