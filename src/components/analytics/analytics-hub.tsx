"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, Clock3, Gauge, Plus, TrendingUp } from "lucide-react";

type SessionItem = {
  id: string;
  date: string;
  subject: string;
  minutes: number;
  dsaProblemsSolved: number;
  focusScore: number;
  notes: string;
};

type AnalyticsResponse = {
  dashboard: {
    weeklyMinutes: number;
    monthlyMinutes: number;
    weeklyHours: number;
    monthlyHours: number;
    weeklyProblems: number;
    monthlyProblems: number;
    weeklyFocus: number;
    sessionsThisWeek: number;
  };
  reports: {
    weeklyStudyChart: Array<{ date: string; label: string; minutes: number; problems: number }>;
    monthlyStudyChart: Array<{ key: string; label: string; hours: number; problems: number }>;
    subjectBreakdown: Array<{ subject: string; hours: number }>;
    dsaDifficulty: Array<{ level: string; solved: number }>;
    latestSessions: SessionItem[];
  };
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function AnalyticsHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const [subject, setSubject] = useState("");
  const [minutes, setMinutes] = useState("60");
  const [date, setDate] = useState("");
  const [problems, setProblems] = useState("0");
  const [focusScore, setFocusScore] = useState("80");
  const [notes, setNotes] = useState("");

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/analytics", { cache: "no-store" });
      const payload = (await response.json()) as AnalyticsResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load analytics");
        setData(null);
        return;
      }

      setData(payload as AnalyticsResponse);
    } catch {
      setError("Could not connect to analytics service");
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAnalytics();
  }, []);

  const submitSession = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (!subject.trim()) {
      setError("Subject is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          minutes: Number(minutes),
          date: date || undefined,
          dsaProblemsSolved: Number(problems),
          focusScore: Number(focusScore),
          notes: notes.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Could not log session");
        return;
      }

      setSubject("");
      setMinutes("60");
      setDate("");
      setProblems("0");
      setFocusScore("80");
      setNotes("");
      setShowLogModal(false);
      await fetchAnalytics();
    } catch {
      setError("Could not log session");
    } finally {
      setSaving(false);
    }
  };

  const maxWeekMinutes = useMemo(() => {
    if (!data?.reports.weeklyStudyChart.length) {
      return 1;
    }

    return Math.max(1, ...data.reports.weeklyStudyChart.map((item) => item.minutes));
  }, [data]);

  const maxMonthlyHours = useMemo(() => {
    if (!data?.reports.monthlyStudyChart.length) {
      return 1;
    }

    return Math.max(1, ...data.reports.monthlyStudyChart.map((item) => item.hours));
  }, [data]);

  const showSkeleton = loading && !data;

  return (
    <section className="page-enter space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm card-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              <BarChart3 size={14} />
              Performance Intelligence
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Analytics and Performance</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Track study time, monitor weekly and monthly reports, and visualize DSA performance with smooth animated charts.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null);
              setShowLogModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            <Plus size={16} />
            Log Study Session
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/45 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Weekly Study</p>
          {showSkeleton ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-24 rounded-lg" />
              <div className="skeleton h-3 w-36 rounded-lg" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-bold">{data?.dashboard.weeklyHours ?? 0}h</p>
                <Clock3 size={18} className="text-sky-400" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{data?.dashboard.sessionsThisWeek ?? 0} sessions this week</p>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Monthly Study</p>
          {showSkeleton ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-24 rounded-lg" />
              <div className="skeleton h-3 w-36 rounded-lg" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-bold">{data?.dashboard.monthlyHours ?? 0}h</p>
                <TrendingUp size={18} className="text-indigo-400" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">{data?.dashboard.monthlyMinutes ?? 0} total minutes</p>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">DSA Solved</p>
          {showSkeleton ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-20 rounded-lg" />
              <div className="skeleton h-3 w-32 rounded-lg" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-bold">{data?.dashboard.weeklyProblems ?? 0}</p>
                <Activity size={18} className="text-emerald-400" />
              </div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">Weekly solved problems</p>
            </>
          )}
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Focus Score</p>
          {showSkeleton ? (
            <div className="mt-3 space-y-3" aria-hidden="true">
              <div className="skeleton h-8 w-20 rounded-lg" />
              <div className="skeleton h-2 w-full rounded-full" />
            </div>
          ) : (
            <>
              <div className="mt-3 flex items-end justify-between">
                <p className="text-3xl font-bold">{data?.dashboard.weeklyFocus ?? 0}</p>
                <Gauge size={18} className="text-amber-400" />
              </div>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500"
                  style={{ width: `${data?.dashboard.weeklyFocus ?? 0}%` }}
                />
              </div>
            </>
          )}
        </article>
      </div>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-3">
        <article className="xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <h2 className="text-lg font-semibold">Weekly Study Time</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Minutes per day with DSA solved overlay</p>

          <div className="responsive-table-wrap mt-5">
            <div className="grid min-w-[460px] grid-cols-7 gap-3">
            {showSkeleton
              ? Array.from({ length: 7 }).map((_, index) => (
                  <div key={index} className="flex flex-col items-center gap-2" aria-hidden="true">
                    <div className="flex h-36 items-end">
                      <div className="skeleton w-8 rounded-t-lg" style={{ height: `${30 + (index % 4) * 15}%` }} />
                    </div>
                    <div className="skeleton h-3 w-7 rounded" />
                    <div className="skeleton h-3 w-10 rounded" />
                    <div className="skeleton h-3 w-12 rounded" />
                  </div>
                ))
              : (data?.reports.weeklyStudyChart ?? []).map((point) => (
                  <div key={point.date} className="flex flex-col items-center gap-2">
                    <div className="flex h-36 items-end">
                      <div
                        className="w-8 rounded-t-lg bg-gradient-to-t from-sky-500/70 to-indigo-400/80 transition-all duration-500"
                        style={{ height: `${Math.max(8, Math.round((point.minutes / maxWeekMinutes) * 100))}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-semibold text-[var(--text-secondary)]">{point.label}</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{point.minutes}m</p>
                    <p className="text-[11px] text-emerald-400">{point.problems} DSA</p>
                  </div>
                ))}
              </div>
          </div>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <h2 className="text-lg font-semibold">Subject Split</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Monthly effort by subject</p>

          <div className="mt-4 space-y-3">
            {showSkeleton
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} aria-hidden="true">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="skeleton h-3 w-20 rounded" />
                      <span className="skeleton h-3 w-10 rounded" />
                    </div>
                    <div className="skeleton h-2 w-full rounded-full" />
                  </div>
                ))
              : (data?.reports.subjectBreakdown ?? []).map((item) => {
              const maxHours = Math.max(1, ...(data?.reports.subjectBreakdown.map((entry) => entry.hours) ?? [1]));
              const width = Math.max(12, Math.round((item.hours / maxHours) * 100));

              return (
                <div key={item.subject}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{item.subject}</span>
                    <span className="text-[var(--text-secondary)]">{item.hours}h</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <div className="grid gap-4 lg:gap-6 xl:grid-cols-5">
        <article className="xl:col-span-3 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <h2 className="text-lg font-semibold">Monthly Report</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Hours trend and solved volume</p>

          <div className="responsive-table-wrap mt-4">
            <div className="responsive-table-content space-y-3">
            {showSkeleton
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid grid-cols-[70px_1fr_60px] items-center gap-3 text-xs" aria-hidden="true">
                    <span className="skeleton h-3 w-14 rounded" />
                    <div className="skeleton h-2 w-full rounded-full" />
                    <span className="skeleton h-3 w-12 rounded" />
                  </div>
                ))
              : (data?.reports.monthlyStudyChart ?? []).map((point) => (
                  <div key={point.key} className="grid grid-cols-[70px_1fr_60px] items-center gap-3 text-xs">
                    <span className="font-medium text-[var(--text-secondary)]">{point.label}</span>
                    <div className="h-2 rounded-full bg-[var(--bg-muted)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 transition-all duration-500"
                        style={{ width: `${Math.max(8, Math.round((point.hours / maxMonthlyHours) * 100))}%` }}
                      />
                    </div>
                    <span className="text-right text-[var(--text-secondary)]">{point.hours}h</span>
                  </div>
                ))}
            </div>
          </div>
        </article>

        <article className="xl:col-span-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
          <h2 className="text-lg font-semibold">DSA Difficulty Stats</h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Solved by difficulty level</p>

          <div className="mt-4 space-y-3">
            {showSkeleton
              ? Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} aria-hidden="true">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="skeleton h-3 w-20 rounded" />
                      <span className="skeleton h-3 w-8 rounded" />
                    </div>
                    <div className="skeleton h-2 w-full rounded-full" />
                  </div>
                ))
              : (data?.reports.dsaDifficulty ?? []).map((item) => {
              const maxSolved = Math.max(1, ...(data?.reports.dsaDifficulty.map((entry) => entry.solved) ?? [1]));
              const width = Math.max(12, Math.round((item.solved / maxSolved) * 100));

              return (
                <div key={item.level}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium">{item.level}</span>
                    <span className="text-[var(--text-secondary)]">{item.solved}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 transition-all duration-500"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </article>
      </div>

      <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 card-hover">
        <h2 className="text-lg font-semibold">Recent Study Activity</h2>
        <div className="responsive-table-wrap mt-4">
          <div className="responsive-table-content space-y-2">
          {showSkeleton
            ? Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[120px_1fr_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/60 px-3 py-2 text-xs"
                  aria-hidden="true"
                >
                  <span className="skeleton h-3 w-20 rounded" />
                  <div className="space-y-2">
                    <p className="skeleton h-3 w-28 rounded" />
                    <p className="skeleton h-3 w-40 rounded" />
                  </div>
                  <span className="skeleton h-6 w-16 rounded-full" />
                </div>
              ))
            : (data?.reports.latestSessions ?? []).slice(0, 8).map((session) => (
                <div
                  key={session.id}
                  className="grid grid-cols-[120px_1fr_auto] items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/60 px-3 py-2 text-xs"
                >
                  <span className="text-[var(--text-secondary)]">{formatDate(session.date)}</span>
                  <div>
                    <p className="font-medium">{session.subject}</p>
                    <p className="text-[var(--text-secondary)]">{session.minutes} min • Focus {session.focusScore}</p>
                  </div>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                    {session.dsaProblemsSolved} solved
                  </span>
                </div>
              ))}
          </div>
        </div>
      </article>

      {showLogModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">Log Study Session</h3>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">Add a study block to update your analytics charts.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowLogModal(false)}
                className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <form className="mt-4 grid gap-3" onSubmit={submitSession}>
              <input
                className="auth-input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Subject or topic"
              />

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  className="auth-input"
                  type="number"
                  min={10}
                  max={600}
                  value={minutes}
                  onChange={(event) => setMinutes(event.target.value)}
                  placeholder="Minutes"
                />
                <input
                  className="auth-input"
                  type="number"
                  min={0}
                  max={30}
                  value={problems}
                  onChange={(event) => setProblems(event.target.value)}
                  placeholder="DSA solved"
                />
                <input
                  className="auth-input"
                  type="number"
                  min={1}
                  max={100}
                  value={focusScore}
                  onChange={(event) => setFocusScore(event.target.value)}
                  placeholder="Focus score"
                />
              </div>

              <input className="auth-input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />

              <textarea
                className="auth-input min-h-24"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
              />

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || loading}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-65"
                >
                  {saving ? "Saving..." : "Save Session"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
