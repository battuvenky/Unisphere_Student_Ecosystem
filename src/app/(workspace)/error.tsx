"use client";

import { useEffect } from "react";

export default function WorkspaceError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("Workspace route error", error);
  }, [error]);

  return (
    <div className="page-enter rounded-3xl border border-rose-500/30 bg-rose-500/10 p-8 text-center text-[var(--text-primary)]">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-rose-300">Workspace Error</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight">Could not load this module</h2>
      <p className="mt-3 text-sm text-[var(--text-secondary)]">
        Refresh this section to continue. Your saved data has not been lost.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-5 inline-flex rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--bg-muted)]"
      >
        Reload Module
      </button>
    </div>
  );
}
