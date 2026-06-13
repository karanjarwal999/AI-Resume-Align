"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ApiError, fetchHistoryList } from "@/lib/api";
import type { HistoryListItem } from "@/lib/types";
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

export default function HistoryPage() {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [items, setItems] = useState<HistoryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auth gate (AC3): not signed in -> /login
  useEffect(() => {
    if (ready && !user) {
      router.replace("/login");
    }
  }, [ready, user, router]);

  // Fetch list once we have a verified user
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const idToken = await user.getIdToken();
        const list = await fetchHistoryList(idToken);
        if (!cancelled) setItems(list);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Could not load your history. Please try again.";
        setError(message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-3xl">
            Your customization history
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The 50 most recent JDs you&apos;ve tailored a resume for.
          </p>
        </div>
        <Link
          href="/"
          className="self-start rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800 sm:self-auto"
        >
          New customization
        </Link>
      </header>

      {!ready || (ready && user && items === null && !error) ? (
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

      {items !== null && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          No customizations yet. Run one from the home page and it&apos;ll
          show up here.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/history/${item.id}`}
                className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-3 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="line-clamp-2 text-sm text-zinc-800 dark:text-zinc-200">
                  {item.jd_preview}
                </span>
                <span className="shrink-0 font-mono text-xs text-zinc-500 dark:text-zinc-400">
                  {formatTimestamp(item.timestamp)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
