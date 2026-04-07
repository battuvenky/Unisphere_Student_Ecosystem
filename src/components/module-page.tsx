import { ArrowRight, Construction, Sparkles } from "lucide-react";

type ModulePageProps = {
  title: string;
  subtitle: string;
};

export function ModulePage({ title, subtitle }: ModulePageProps) {
  return (
    <section className="page-enter space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 shadow-sm">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
          <Sparkles size={14} />
          UniSphere Module
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-3xl border border-dashed border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <div className="mb-3 flex items-center gap-2 text-[var(--text-primary)]">
            <Construction size={18} />
            <h2 className="text-lg font-semibold">Feature Placeholder</h2>
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            This module structure is set up and ready for real business logic, APIs, and data-driven components.
          </p>
        </div>

        <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold text-[var(--text-primary)]">Suggested Next Build</h2>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            Connect API + Database
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
