"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  Loader2,
  Plus,
  Search,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type CampusIssueCategory = "hostel" | "mess" | "cleanliness" | "electricity" | "water";
type CampusTicketStatus = "open" | "in_progress" | "resolved";
type MealKey = "breakfast" | "lunch" | "snacks" | "dinner";

type CampusTicket = {
  id: string;
  title: string;
  description: string;
  category: CampusIssueCategory;
  hostelBlock: string;
  status: CampusTicketStatus;
  createdAt: string;
  updatedAt: string;
};

type MessMenuDay = {
  day: string;
  meals: Record<MealKey, string[]>;
};

type CampusDashboard = {
  total: number;
  open: number;
  in_progress: number;
  resolved: number;
  resolutionRate: number;
};

type CampusResponse = {
  tickets: CampusTicket[];
  messMenu: MessMenuDay[];
  dashboard: CampusDashboard;
  filterOptions: {
    categories: CampusIssueCategory[];
    statuses: CampusTicketStatus[];
  };
};

const categoryLabel: Record<CampusIssueCategory, string> = {
  hostel: "Hostel",
  mess: "Mess",
  cleanliness: "Cleanliness",
  electricity: "Electricity",
  water: "Water",
};

const statusLabel: Record<CampusTicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const statusPillClass: Record<CampusTicketStatus, string> = {
  open: "border-rose-400/40 bg-rose-500/15 text-rose-300",
  in_progress: "border-amber-400/40 bg-amber-500/15 text-amber-300",
  resolved: "border-emerald-400/40 bg-emerald-500/15 text-emerald-300",
};

const categoryPillClass: Record<CampusIssueCategory, string> = {
  hostel: "border-sky-400/40 bg-sky-500/15 text-sky-300",
  mess: "border-indigo-400/40 bg-indigo-500/15 text-indigo-300",
  cleanliness: "border-cyan-400/40 bg-cyan-500/15 text-cyan-300",
  electricity: "border-violet-400/40 bg-violet-500/15 text-violet-300",
  water: "border-teal-400/40 bg-teal-500/15 text-teal-300",
};

function formatDateTime(dateIso: string) {
  return new Date(dateIso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toRelative(dateIso: string) {
  const diffMinutes = Math.floor((Date.now() - Date.parse(dateIso)) / 60_000);

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

export function CampusHub() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tickets, setTickets] = useState<CampusTicket[]>([]);
  const [messMenu, setMessMenu] = useState<MessMenuDay[]>([]);
  const [dashboard, setDashboard] = useState<CampusDashboard | null>(null);
  const [statusOptions, setStatusOptions] = useState<CampusTicketStatus[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CampusIssueCategory[]>([]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeMenuDay, setActiveMenuDay] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<CampusIssueCategory>("hostel");
  const [hostelBlock, setHostelBlock] = useState("");

  const fetchCampusData = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (categoryFilter) {
        params.set("category", categoryFilter);
      }

      const response = await fetch(`/api/campus?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as CampusResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not fetch campus data");
        setTickets([]);
        setDashboard(null);
        setMessMenu([]);
        return;
      }

      const data = payload as CampusResponse;
      setTickets(data.tickets);
      setMessMenu(data.messMenu);
      setDashboard(data.dashboard);
      setStatusOptions(data.filterOptions.statuses);
      setCategoryOptions(data.filterOptions.categories);

      if (!activeMenuDay && data.messMenu.length > 0) {
        setActiveMenuDay(data.messMenu[0].day);
      }
    } catch {
      setError("Could not connect to campus service");
      setTickets([]);
      setDashboard(null);
      setMessMenu([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchCampusData();
    }, 140);

    return () => clearTimeout(timer);
  }, [query, statusFilter, categoryFilter]);

  const activeMenu = useMemo(() => messMenu.find((item) => item.day === activeMenuDay) ?? null, [messMenu, activeMenuDay]);

  const submitComplaint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError(null);
    if (!title.trim() || !description.trim()) {
      setFormError("Please add title and description.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/campus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          hostelBlock: hostelBlock.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "Could not create complaint");
        return;
      }

      setTitle("");
      setDescription("");
      setCategory("hostel");
      setHostelBlock("");
      setShowModal(false);
      await fetchCampusData();
    } catch {
      setFormError("Could not create complaint");
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (ticketId: string, status: CampusTicketStatus) => {
    setTickets((prev) => prev.map((ticket) => (ticket.id === ticketId ? { ...ticket, status } : ticket)));

    try {
      const response = await fetch(`/api/campus/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("Could not update status");
      }

      await fetchCampusData();
    } catch {
      setError("Could not update complaint status. Showing latest data.");
      await fetchCampusData();
    }
  };

  return (
    <section className="space-y-6 animate-fade-in-up">
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-5 shadow-[0_16px_50px_-28px_rgba(15,23,42,0.55)] backdrop-blur-md">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Hostel and Campus</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Campus Management</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Raise complaints, monitor issue status, and check your weekly mess menu.</p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
        >
          <Plus size={16} />
          New Complaint
        </button>
      </header>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Total Tickets</p>
          <p className="mt-2 text-2xl font-bold">{dashboard?.total ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.12em] text-rose-200">Open</p>
          <p className="mt-2 text-2xl font-bold text-rose-100">{dashboard?.open ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.12em] text-amber-200">In Progress</p>
          <p className="mt-2 text-2xl font-bold text-amber-100">{dashboard?.in_progress ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.12em] text-emerald-200">Resolved</p>
          <p className="mt-2 text-2xl font-bold text-emerald-100">{dashboard?.resolved ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Resolution Rate</p>
          <p className="mt-2 text-2xl font-bold">{dashboard?.resolutionRate ?? 0}%</p>
          <div className="mt-3 h-2 rounded-full bg-[var(--bg-muted)]">
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
              style={{ width: `${dashboard?.resolutionRate ?? 0}%` }}
            />
          </div>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-4 rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            <Filter size={14} />
            Filters
          </h2>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Search issues</span>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search complaints"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-[var(--accent)]"
              />
            </div>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">All statuses</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabel[status]}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2 text-sm">
            <span className="font-medium">Category</span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
            >
              <option value="">All categories</option>
              {categoryOptions.map((value) => (
                <option key={value} value={value}>
                  {categoryLabel[value]}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatusFilter("");
              setCategoryFilter("");
            }}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm font-semibold transition-colors hover:bg-[var(--bg-muted)]"
          >
            Reset Filters
          </button>
        </aside>

        <div className="space-y-5">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <Wrench size={18} />
                Complaint Tickets
              </h2>
              {loading ? <Loader2 size={16} className="animate-spin text-[var(--text-secondary)]" /> : null}
            </div>

            {error ? (
              <div className="mt-4 rounded-xl border border-rose-500/35 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>
            ) : null}

            {!loading && tickets.length === 0 ? (
              <div className="mt-4">
                <EmptyState
                  icon={Wrench}
                  title="No complaints yet ✨"
                  message="Everything looks good! File a complaint if you need assistance."
                  actionLabel="New Complaint"
                  onAction={() => setShowModal(true)}
                />
              </div>
            ) : null}

            <div className="mt-4 space-y-3">
              {tickets.map((ticket) => (
                <article
                  key={ticket.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold">{ticket.title}</h3>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{ticket.description}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${categoryPillClass[ticket.category]}`}>
                        {categoryLabel[ticket.category]}
                      </span>
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClass[ticket.status]}`}>
                        {statusLabel[ticket.status]}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                    <p>Location: {ticket.hostelBlock}</p>
                    <p>Updated: {toRelative(ticket.updatedAt)} ({formatDateTime(ticket.updatedAt)})</p>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <label className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Track status</label>
                    <select
                      value={ticket.status}
                      onChange={(event) => void updateStatus(ticket.id, event.target.value as CampusTicketStatus)}
                      className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1.5 text-xs outline-none transition focus:border-[var(--accent)]"
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <UtensilsCrossed size={18} />
                Mess Menu
              </h2>

              <div className="flex flex-wrap gap-2">
                {messMenu.map((menu) => (
                  <button
                    key={menu.day}
                    type="button"
                    onClick={() => setActiveMenuDay(menu.day)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeMenuDay === menu.day
                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                        : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    {menu.day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            {activeMenu ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {(["breakfast", "lunch", "snacks", "dinner"] as MealKey[]).map((meal) => (
                  <article key={meal} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{meal}</p>
                    <ul className="mt-2 space-y-1 text-sm">
                      {activeMenu.meals[meal].map((item) => (
                        <li key={item} className="text-[var(--text-primary)]">• {item}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-[var(--text-secondary)]">No menu available.</p>
            )}
          </section>
        </div>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
            aria-label="Close complaint modal"
          />

          <div className="relative w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--surface)]/96 p-5 shadow-2xl backdrop-blur-xl animate-fade-in-up">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--text-secondary)]">Campus Complaint</p>
                <h3 className="mt-1 text-xl font-bold">Raise New Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg border border-[var(--border)] bg-[var(--card)] px-2.5 py-1 text-xs"
              >
                Close
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={submitComplaint}>
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Short issue title"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
                  required
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="Explain the problem clearly"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
                  required
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as CampusIssueCategory)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
                  >
                    {Object.entries(categoryLabel).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block space-y-1.5 text-sm">
                  <span className="font-medium">Hostel Block</span>
                  <input
                    value={hostelBlock}
                    onChange={(event) => setHostelBlock(event.target.value)}
                    placeholder="Block A / Mess"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              {formError ? (
                <div className="rounded-xl border border-rose-500/35 bg-rose-500/10 p-2.5 text-sm text-rose-200">{formError}</div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:opacity-95 disabled:opacity-70"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                {saving ? "Submitting..." : "Submit Complaint"}
              </button>
            </form>

            <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded-lg border border-rose-500/35 bg-rose-500/10 p-2 text-center text-rose-200">
                <AlertCircle size={14} className="mx-auto mb-1" />
                Open
              </div>
              <div className="rounded-lg border border-amber-500/35 bg-amber-500/10 p-2 text-center text-amber-200">
                <Clock3 size={14} className="mx-auto mb-1" />
                In Progress
              </div>
              <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/10 p-2 text-center text-emerald-200">
                <CheckCircle2 size={14} className="mx-auto mb-1" />
                Resolved
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
