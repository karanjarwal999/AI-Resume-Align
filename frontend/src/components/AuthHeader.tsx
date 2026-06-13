"use client";

import Link from "next/link";

import { signOut } from "firebase/auth";

import { auth } from "@/lib/firebase";
import { useAuth } from "@/lib/useAuth";

export function AuthHeader() {
  const { user, ready } = useAuth();

  if (!ready) {
    return <div className="h-6" aria-hidden="true" />;
  }

  if (user) {
    return (
      <div className="flex items-center justify-end gap-3 text-sm">
        <Link
          href="/history"
          className="text-zinc-700 hover:underline dark:text-zinc-200"
        >
          History
        </Link>
        <span
          className="max-w-[12rem] truncate text-zinc-600 dark:text-zinc-400"
          title={user.email ?? undefined}
        >
          {user.email}
        </span>
        <button
          type="button"
          onClick={() => signOut(auth)}
          className="rounded-md border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      <Link
        href="/login"
        className="text-zinc-700 hover:underline dark:text-zinc-200"
      >
        Log in
      </Link>
      <Link
        href="/register"
        className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Sign up
      </Link>
    </div>
  );
}
