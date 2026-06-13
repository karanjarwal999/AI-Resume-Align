"use client";

import { useState } from "react";

import { pdf } from "@react-pdf/renderer";

import { ResumeDocument } from "@/components/ResumeDocument";
import type { CustomizedResume } from "@/lib/types";

type Props = {
  result: Partial<CustomizedResume>;
  isStreaming?: boolean;
};

function isComplete(r: Partial<CustomizedResume>): r is CustomizedResume {
  return (
    typeof r.summary === "string" &&
    Array.isArray(r.skills) &&
    Array.isArray(r.experience) &&
    Array.isArray(r.suggested_additions)
  );
}

export function ResultPanel({ result, isStreaming = false }: Props) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (downloading || !isComplete(result)) return;
    setDownloading(true);
    try {
      const blob = await pdf(<ResumeDocument result={result} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "customized-resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const complete = isComplete(result);
  const downloadDisabled = downloading || !complete;

  return (
    <section className="flex flex-col gap-6 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Your customized resume
          </h2>
          {isStreaming && !complete && (
            <span className="inline-flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span
                aria-hidden="true"
                className="h-2 w-2 animate-pulse rounded-full bg-zinc-400 dark:bg-zinc-500"
              />
              Generating…
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloadDisabled}
          aria-busy={downloading}
          title={!complete ? "Available once the customization finishes." : undefined}
          className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
            downloadDisabled
              ? "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800"
              : "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          {downloading ? "Preparing…" : "Download PDF"}
        </button>
      </div>

      {result.summary !== undefined && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Summary
          </h3>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {result.summary}
          </p>
        </div>
      )}

      {result.skills !== undefined && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Skills
          </h3>
          <ul className="flex flex-wrap gap-2">
            {result.skills.map((skill, i) => (
              <li
                key={i}
                className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {skill}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.experience !== undefined && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Experience
          </h3>
          <ul className="flex flex-col gap-2 pl-4">
            {result.experience.map((bullet, i) => (
              <li
                key={i}
                className="list-disc text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 marker:text-zinc-400"
              >
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.suggested_additions !== undefined && result.suggested_additions.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
            Suggested additions
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            These appeared in the JD but not in your resume. Consider adding
            them if they apply to you. They&apos;re advisory only and not part
            of your customized resume.
          </p>
          <ul className="flex flex-col gap-1 pl-4">
            {result.suggested_additions.map((addition, i) => (
              <li
                key={i}
                className="list-disc text-sm text-amber-900 dark:text-amber-200 marker:text-amber-500"
              >
                {addition}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
