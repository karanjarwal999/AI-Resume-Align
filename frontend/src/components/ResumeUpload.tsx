"use client";

import { useRef, useState } from "react";

import { MAX_FILE_BYTES } from "@/lib/constants";
import type { ResumeFile } from "@/lib/reducer";

type Props = {
  value: ResumeFile | null;
  onFile: (file: ResumeFile) => void;
  onClear: () => void;
};

function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${Math.round(kb)} KB`;
  }
  return `${(kb / 1024).toFixed(1)} MB`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

function validate(file: File): string | null {
  const ext = extensionOf(file.name);
  const isPdf = file.type === "application/pdf" || ext === ".pdf";
  if (!isPdf) {
    return `Only PDF files are supported. Got: ${ext || "(no extension)"}.`;
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `Resume must be under 5 MB. This file is ${mb} MB.`;
  }
  return null;
}

export function ResumeUpload({ value, onFile, onClear }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const message = validate(file);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onFile({ file, name: file.name, sizeBytes: file.size });
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const clear = () => {
    setError(null);
    onClear();
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
        Upload Resume (PDF)
      </span>

      {value ? (
        <div className="flex items-center justify-between rounded-lg border border-zinc-300 bg-white px-4 py-3 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {value.name}
            </span>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {formatSize(value.sizeBytes)}
            </span>
          </div>
          <button
            type="button"
            onClick={clear}
            aria-label="Remove resume"
            className="cursor-pointer rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <span aria-hidden="true" className="text-lg leading-none">
              &times;
            </span>
          </button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
            dragOver
              ? "border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800"
              : "border-zinc-300 bg-white hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500"
          }`}
        >
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Drag &amp; drop your PDF resume here, or{" "}
            <span className="font-medium underline">click to browse</span>
          </span>
          <span className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            PDF only, up to 5 MB
          </span>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={onPick}
            className="hidden"
          />
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="text-xs text-red-600 dark:text-red-400"
        >
          {error}
        </p>
      )}
    </div>
  );
}
