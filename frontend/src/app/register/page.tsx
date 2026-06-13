"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { FirebaseError } from "firebase/app";
import { createUserWithEmailAndPassword } from "firebase/auth";

import { humanizeAuthError } from "@/lib/auth-errors";
import { auth } from "@/lib/firebase";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LEN = 8;

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_RE.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < MIN_PASSWORD_LEN) {
      setError(`Password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }

    setSubmitting(true);
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      router.push("/");
    } catch (err) {
      setError(
        err instanceof FirebaseError
          ? humanizeAuthError(err.code)
          : "Registration failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-4 py-12 sm:px-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Create an account
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Save your customization history across sessions.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="email"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LEN}
            className="w-full rounded-lg border border-zinc-300 bg-white p-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
          />
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            At least {MIN_PASSWORD_LEN} characters.
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-700 dark:bg-red-950/30 dark:text-red-300"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className={`inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
            submitting
              ? "cursor-wait bg-zinc-200 text-zinc-500 dark:bg-zinc-800"
              : "bg-zinc-900 text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          }`}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline dark:text-zinc-100"
        >
          Log in
        </Link>
      </p>
    </main>
  );
}
