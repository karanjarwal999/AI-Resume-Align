"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { ResultPanel } from "@/components/ResultPanel";
import { ApiError, fetchHistoryDetail } from "@/lib/api";
import type { HistoryDetail } from "@/lib/types";
import { useAuth } from "@/lib/useAuth";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

type Props = {
  params: Promise<{ id: string }>;
};

export default function HistoryDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();

  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const d = await fetchHistoryDetail(idToken, id);
        if (!cancelled) setDetail(d);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.status === 404
              ? "This customization no longer exists."
              : err.message
            : "Could not load this customization.";
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, id]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            href="/history"
            className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
          >
            ← Back to history
          </Link>
          {detail && (
            <p className="mt-1 font-mono text-xs text-zinc-500 dark:text-zinc-400">
              Saved {formatTimestamp(detail.timestamp)}
            </p>
          )}
        </div>
      </header>

      {!ready || (ready && user && detail === null && !error) ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
      ) : null}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
        >
          {error}
        </p>
      )}

      {detail && (
        <>
          <section className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Job description
            </h2>
            <p className="whitespace-pre-wrap text-sm text-zinc-800 dark:text-zinc-200">
              {detail.jd_text}
            </p>
          </section>

          <ResultPanel result={detail.customized_resume} />
        </>
      )}
    </main>
  );
}
