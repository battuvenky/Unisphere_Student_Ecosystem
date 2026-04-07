import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-gradient px-4 text-[var(--text-primary)]">
      <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-8 text-center shadow-xl backdrop-blur-sm page-enter">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Page Not Found</h1>
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          The page you requested does not exist or may have been moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
        >
          Go to Dashboard
        </Link>
      </section>
    </main>
  );
}
