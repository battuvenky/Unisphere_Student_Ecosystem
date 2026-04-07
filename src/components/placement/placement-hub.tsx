"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChartColumn,
  Clock3,
  Filter,
  Plus,
  Search,
  Target,
  TrendingUp,
  FileText,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type ApplicationStatus = "applied" | "interview" | "rejected" | "offered";
type PracticeDifficulty = "easy" | "medium" | "hard";

type PracticeLog = {
  id: string;
  date: string;
  topic: string;
  problemsSolved: number;
  timeSpentMinutes: number;
  difficulty: PracticeDifficulty;
  notes: string;
};

type ApplicationRecord = {
  id: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedOn: string;
  location: string;
  link: string;
  notes: string;
  updatedAt: string;
};

type WeeklyPoint = {
  date: string;
  solved: number;
  label: string;
};

type PlacementResponse = {
  dashboard: {
    targetProblems: number;
    totalProblemsSolved: number;
    dsaProgress: number;
    totalPracticeHours: number;
    weeklySolved: number;
    activeApplications: number;
    statusCounts: Record<ApplicationStatus, number>;
    weeklyChart: WeeklyPoint[];
  };
  practiceLogs: PracticeLog[];
  applications: ApplicationRecord[];
  filterOptions: {
    companies: string[];
    statuses: ApplicationStatus[];
  };
};

const statusLabels: Record<ApplicationStatus, string> = {
  applied: "Applied",
  interview: "Interview",
  rejected: "Rejected",
  offered: "Offered",
};

const statusPillClass: Record<ApplicationStatus, string> = {
  applied: "bg-sky-500/15 text-sky-300 border-sky-500/40",
  interview: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  rejected: "bg-rose-500/15 text-rose-300 border-rose-500/40",
  offered: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLastUpdated(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) {
    return "Updated now";
  }

  if (minutes < 60) {
    return `Updated ${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

function PlacementTableSkeleton() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, index) => (
        <tr key={index}>
          <td className="px-3 py-3"><div className="skeleton h-4 w-24 rounded-lg" /></td>
          <td className="px-3 py-3"><div className="skeleton h-4 w-28 rounded-lg" /></td>
          <td className="px-3 py-3"><div className="skeleton h-4 w-20 rounded-lg" /></td>
          <td className="px-3 py-3"><div className="skeleton h-4 w-24 rounded-lg" /></td>
          <td className="px-3 py-3"><div className="skeleton h-8 w-24 rounded-lg" /></td>
        </tr>
      ))}
    </>
  );
}

export function PlacementHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [companies, setCompanies] = useState<string[]>([]);
  const [statuses, setStatuses] = useState<ApplicationStatus[]>(["applied", "interview", "rejected", "offered"]);

  const [dashboard, setDashboard] = useState<PlacementResponse["dashboard"] | null>(null);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);

  const [showPracticeForm, setShowPracticeForm] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [practiceTopic, setPracticeTopic] = useState("");
  const [practiceDate, setPracticeDate] = useState("");
  const [practiceSolved, setPracticeSolved] = useState("");
  const [practiceMinutes, setPracticeMinutes] = useState("");
  const [practiceDifficulty, setPracticeDifficulty] = useState<PracticeDifficulty>("medium");
  const [practiceNotes, setPracticeNotes] = useState("");

  const [appCompany, setAppCompany] = useState("");
  const [appRole, setAppRole] = useState("");
  const [appStatus, setAppStatus] = useState<ApplicationStatus>("applied");
  const [appDate, setAppDate] = useState("");
  const [appLocation, setAppLocation] = useState("");
  const [appLink, setAppLink] = useState("");
  const [appNotes, setAppNotes] = useState("");

  const fetchPlacement = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (companyFilter) {
        params.set("company", companyFilter);
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }

      const response = await fetch(`/api/placement?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as PlacementResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load placement data");
        setDashboard(null);
        setApplications([]);
        setPracticeLogs([]);
        return;
      }

      const data = payload as PlacementResponse;
      setDashboard(data.dashboard);
      setPracticeLogs(data.practiceLogs);
      setApplications(data.applications);
      setCompanies(data.filterOptions.companies);
      setStatuses(data.filterOptions.statuses);
    } catch {
      setError("Could not connect to placement service");
      setDashboard(null);
      setApplications([]);
      setPracticeLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchPlacement();
    }, 160);

    return () => clearTimeout(timer);
  }, [query, companyFilter, statusFilter]);

  const weeklyMax = useMemo(() => {
    if (!dashboard?.weeklyChart.length) {
      return 1;
    }

    return Math.max(1, ...dashboard.weeklyChart.map((point) => point.solved));
  }, [dashboard]);

  const submitPractice = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    setFormError(null);

    if (!practiceTopic.trim() || !practiceSolved.trim() || !practiceMinutes.trim()) {
      setFormError("Please fill topic, solved count, and practice minutes.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "practice",
          topic: practiceTopic.trim(),
          date: practiceDate || undefined,
          problemsSolved: Number(practiceSolved),
          timeSpentMinutes: Number(practiceMinutes),
          difficulty: practiceDifficulty,
          notes: practiceNotes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "Could not save practice log");
        return;
      }

      setPracticeTopic("");
      setPracticeDate("");
      setPracticeSolved("");
      setPracticeMinutes("");
      setPracticeDifficulty("medium");
      setPracticeNotes("");
      setShowPracticeForm(false);
      await fetchPlacement();
    } catch {
      setFormError("Could not save practice log");
    } finally {
      setSaving(false);
    }
  };

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) {
      return;
    }

    setFormError(null);

    if (!appCompany.trim() || !appRole.trim()) {
      setFormError("Company and role are required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "application",
          company: appCompany.trim(),
          role: appRole.trim(),
          status: appStatus,
          appliedOn: appDate || undefined,
          location: appLocation.trim() || undefined,
          link: appLink.trim() || undefined,
          notes: appNotes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "Could not create application entry");
        return;
      }

      setAppCompany("");
      setAppRole("");
      setAppStatus("applied");
      setAppDate("");
      setAppLocation("");
      setAppLink("");
      setAppNotes("");
      setShowApplicationForm(false);
      await fetchPlacement();
    } catch {
      setFormError("Could not create application entry");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (applicationId: string, nextStatus: ApplicationStatus) => {
    setApplications((prev) =>
      prev.map((item) =>
        item.id === applicationId
          ? {
              ...item,
              status: nextStatus,
            }
          : item
      )
    );

    try {
      const response = await fetch("/api/placement", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "application-status",
          applicationId,
          status: nextStatus,
        }),
      });

      if (!response.ok) {
        throw new Error("Could not update status");
      }

      await fetchPlacement();
    } catch {
      setError("Status update failed. Reloaded latest data.");
      await fetchPlacement();
    }
  };

  return (
    <section className="page-enter space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)]/85 p-6 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Career Engine</p>
            <h1 className="mt-1 text-2xl font-semibold md:text-3xl">Placement Preparation Hub</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Track DSA momentum, log coding practice, and manage company applications with data-first insights.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPracticeForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium transition hover:-translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              Log Practice
            </button>
            <button
              type="button"
              onClick={() => setShowApplicationForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl border border-transparent bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white shadow-lg shadow-sky-500/20 transition hover:-translate-y-0.5"
            >
              <Briefcase className="h-4 w-4" />
              Add Application
            </button>
          </div>
        </div>
      </div>

      {formError ? (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{formError}</div>
      ) : null}

      {showPracticeForm ? (
        <form onSubmit={submitPractice} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Practice Log</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              value={practiceTopic}
              onChange={(event) => setPracticeTopic(event.target.value)}
              placeholder="Topic (e.g. Graphs)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={practiceDate}
              onChange={(event) => setPracticeDate(event.target.value)}
              type="date"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={practiceSolved}
              onChange={(event) => setPracticeSolved(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Problems solved"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={practiceMinutes}
              onChange={(event) => setPracticeMinutes(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="Minutes practiced"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <select
              value={practiceDifficulty}
              onChange={(event) => setPracticeDifficulty(event.target.value as PracticeDifficulty)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
            <input
              value={practiceNotes}
              onChange={(event) => setPracticeNotes(event.target.value)}
              placeholder="Notes (optional)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Practice"}
            </button>
          </div>
        </form>
      ) : null}

      {showApplicationForm ? (
        <form onSubmit={submitApplication} className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <h2 className="text-lg font-semibold">Company Application</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <input
              value={appCompany}
              onChange={(event) => setAppCompany(event.target.value)}
              placeholder="Company"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={appRole}
              onChange={(event) => setAppRole(event.target.value)}
              placeholder="Role"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <select
              value={appStatus}
              onChange={(event) => setAppStatus(event.target.value as ApplicationStatus)}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            >
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={appDate}
              onChange={(event) => setAppDate(event.target.value)}
              type="date"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={appLocation}
              onChange={(event) => setAppLocation(event.target.value)}
              placeholder="Location"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={appLink}
              onChange={(event) => setAppLink(event.target.value)}
              placeholder="Application link (optional)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={appNotes}
              onChange={(event) => setAppNotes(event.target.value)}
              placeholder="Notes (optional)"
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)] md:col-span-2 xl:col-span-3"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-70"
            >
              {saving ? "Saving..." : "Save Application"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 stagger-children">
        <article className="card-hover rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-[0.14em]">DSA Progress</span>
            <Target className="h-4 w-4" />
          </div>
          {loading ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-20 rounded-lg" />
              <div className="skeleton h-2 w-full rounded-full" />
              <div className="skeleton h-3 w-40 rounded-lg" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold">{dashboard?.dsaProgress ?? 0}%</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{ width: `${dashboard?.dsaProgress ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {(dashboard?.totalProblemsSolved ?? 0).toLocaleString()} / {(dashboard?.targetProblems ?? 0).toLocaleString()} target solved
              </p>
            </>
          )}
        </article>

        <article className="card-hover rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-[0.14em]">Weekly Solved</span>
            <TrendingUp className="h-4 w-4" />
          </div>
          {loading ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-20 rounded-lg" />
              <div className="skeleton h-3 w-44 rounded-lg" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold">{dashboard?.weeklySolved ?? 0}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Problems solved in the last 7 days</p>
            </>
          )}
        </article>

        <article className="card-hover rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-[0.14em]">Practice Hours</span>
            <Clock3 className="h-4 w-4" />
          </div>
          {loading ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-16 rounded-lg" />
              <div className="skeleton h-3 w-36 rounded-lg" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold">{dashboard?.totalPracticeHours ?? 0}h</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Total coding practice time</p>
            </>
          )}
        </article>

        <article className="card-hover rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span className="text-xs uppercase tracking-[0.14em]">Active Pipelines</span>
            <Building2 className="h-4 w-4" />
          </div>
          {loading ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-16 rounded-lg" />
              <div className="skeleton h-3 w-40 rounded-lg" />
            </div>
          ) : (
            <>
              <p className="mt-3 text-3xl font-semibold">{dashboard?.activeApplications ?? 0}</p>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Applied + interview stages</p>
            </>
          )}
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-4 inline-flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4" />
            Application Filters
          </div>

          <div className="space-y-3">
            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Search</span>
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3">
                <Search className="h-4 w-4 text-[var(--text-secondary)]" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Company or role"
                  className="h-10 w-full bg-transparent text-sm outline-none"
                />
              </div>
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Company</span>
              <select
                value={companyFilter}
                onChange={(event) => setCompanyFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none"
              >
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1">
              <span className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="h-10 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm outline-none"
              >
                <option value="">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setQuery("");
                setCompanyFilter("");
                setStatusFilter("");
              }}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium transition hover:bg-[var(--bg-muted)]"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
            <div className="mb-2 inline-flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              <ChartColumn className="h-3.5 w-3.5" />
              7-day DSA Trend
            </div>
            <div className="grid h-28 grid-cols-7 items-end gap-2">
              {(dashboard?.weeklyChart ?? []).map((point) => {
                const height = Math.max(8, Math.round((point.solved / weeklyMax) * 100));
                return (
                  <div key={point.date} className="group flex flex-col items-center gap-1">
                    <div className="text-[10px] text-[var(--text-secondary)] opacity-0 transition group-hover:opacity-100">{point.solved}</div>
                    <div
                      className="w-full rounded-md bg-[var(--accent)]/80 transition-all duration-300 group-hover:bg-[var(--accent)]"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-[10px] text-[var(--text-secondary)]">{point.label}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        <div className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
          ) : null}

          <article className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Company Application Tracker</h2>
              <p className="text-xs text-[var(--text-secondary)]">Table + quick status updates</p>
            </div>

            <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] md:block">
              {!loading && applications.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--card)] p-8">
                  <EmptyState
                    icon={FileText}
                    title="No applications yet 📝"
                    message="Track your company applications here to stay organized and monitor your progress."
                    actionLabel="Add Application"
                    onAction={() => setShowApplicationForm(true)}
                  />
                </div>
              ) : (
                <table className="min-w-full divide-y divide-[var(--border)] text-sm">
                  <thead className="bg-[var(--bg-muted)]/70 text-left text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                    <tr>
                      <th className="px-3 py-2">Company</th>
                      <th className="px-3 py-2">Role</th>
                      <th className="px-3 py-2">Applied</th>
                      <th className="px-3 py-2">Location</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)] bg-[var(--card)]">
                    {loading ? (
                      <PlacementTableSkeleton />
                    ) : (
                      applications.map((application) => (
                        <tr key={application.id} className="transition hover:bg-[var(--bg-muted)]/45">
                          <td className="px-3 py-3 font-medium">{application.company}</td>
                          <td className="px-3 py-3 text-[var(--text-secondary)]">{application.role}</td>
                          <td className="px-3 py-3 text-[var(--text-secondary)]">{formatDate(application.appliedOn)}</td>
                          <td className="px-3 py-3 text-[var(--text-secondary)]">{application.location || "-"}</td>
                          <td className="px-3 py-3">
                            <select
                              value={application.status}
                              onChange={(event) => void updateStatus(application.id, event.target.value as ApplicationStatus)}
                              className={`rounded-lg border px-2 py-1 text-xs font-semibold ${statusPillClass[application.status]}`}
                            >
                              {statuses.map((status) => (
                                <option key={status} value={status}>
                                  {statusLabels[status]}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>

            <div className="space-y-3 md:hidden">
              {loading
                ? Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-hidden="true">
                      <div className="space-y-3">
                        <div className="skeleton h-5 w-36 rounded-lg" />
                        <div className="skeleton h-4 w-24 rounded-lg" />
                        <div className="skeleton h-4 w-28 rounded-lg" />
                      </div>
                    </div>
                  ))
                : applications.map((application) => (
                    <div key={application.id} className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{application.company}</p>
                          <p className="text-sm text-[var(--text-secondary)]">{application.role}</p>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusPillClass[application.status]}`}>
                          {statusLabels[application.status]}
                        </span>
                      </div>
                      <div className="mt-3 text-xs text-[var(--text-secondary)]">
                        <p>{formatDate(application.appliedOn)}</p>
                        <p>{application.location || "Remote/Not specified"}</p>
                      </div>
                    </div>
                  ))}
            </div>
          </article>

          <article className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Coding Practice Timeline</h2>
              <div className="inline-flex items-center gap-1 text-xs text-[var(--text-secondary)]">
                <CalendarDays className="h-3.5 w-3.5" />
                Last {practiceLogs.length} sessions
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <article key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" aria-hidden="true">
                    <div className="space-y-3">
                      <div className="skeleton h-5 w-36 rounded-lg" />
                      <div className="skeleton h-4 w-24 rounded-lg" />
                      <div className="skeleton h-4 w-40 rounded-lg" />
                      <div className="skeleton h-2 w-full rounded-full" />
                    </div>
                  </article>
                ))
              ) : practiceLogs.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No practice logs found for this profile.</p>
              ) : (
                practiceLogs.slice(0, 10).map((item) => {
                  const width = Math.min(100, item.problemsSolved * 10);

                  return (
                    <article key={item.id} className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold">{item.topic}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{formatDate(item.date)}</p>
                        </div>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                          {item.difficulty}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between text-sm">
                        <p className="font-medium">{item.problemsSolved} solved</p>
                        <p className="text-[var(--text-secondary)]">{item.timeSpentMinutes} min</p>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-muted)]">
                        <div
                          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>

                      {item.notes ? <p className="mt-2 text-xs text-[var(--text-secondary)]">{item.notes}</p> : null}
                    </article>
                  );
                })
              )}
            </div>
          </article>
        </div>
      </div>

      {dashboard ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(dashboard.statusCounts) as ApplicationStatus[]).map((status) => (
            <div key={status} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{statusLabels[status]}</p>
              <p className="mt-1 text-2xl font-semibold">{dashboard.statusCounts[status]}</p>
            </div>
          ))}
        </section>
      ) : null}
    </section>
  );
}
