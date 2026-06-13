"use client";

import { useRef, useState } from "react";

import { MAX_FILE_BYTES } from "@/lib/constants";
import type { SavedResumeMeta } from "@/lib/types";

type Props = {
  meta: SavedResumeMeta;
  onReplace: (file: File) => Promise<void>;
};

function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function validate(file: File): string | null {
  const dot = file.name.lastIndexOf(".");
  const ext = dot === -1 ? "" : file.name.slice(dot).toLowerCase();
  const isPdf = file.type === "application/pdf" || ext === ".pdf";
  if (!isPdf) return `Only PDF files are supported. Got: ${ext || "(no extension)"}.`;
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Resume must be under 5 MB. This file is ${mb} MB.`;
  }
  return null;
}

export function SavedResumeChip({ meta, onReplace }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const message = validate(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setReplacing(true);
    try {
      await onReplace(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not replace your saved resume.");
    } finally {
      setReplacing(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Saved resume
      </span>
      <div className="flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-700 dark:bg-emerald-950/30">
        <div className="flex flex-col">
          <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
            {meta.file_name}
          </span>
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            {formatSize(meta.file_size_bytes)} · saved {relativeTime(meta.updated_at)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={replacing}
          aria-busy={replacing}
          className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
            replacing
              ? "cursor-wait border-emerald-200 bg-emerald-100 text-emerald-500 dark:border-emerald-700 dark:bg-emerald-900"
              : "cursor-pointer border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-emerald-950/60"
          }`}
        >
          {replacing ? "Replacing…" : "Replace"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={onPick}
          className="hidden"
        />
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
