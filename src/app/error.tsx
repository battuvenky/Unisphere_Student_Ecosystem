"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("Global app error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-gradient px-4 text-[var(--text-primary)]">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-8 text-center shadow-xl backdrop-blur-sm page-enter">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Something Went Wrong</p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight">We could not load UniSphere</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          A temporary error occurred. Try again and the app will reload this section.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Try Again
        </button>
      </section>
    </main>
  );
}
