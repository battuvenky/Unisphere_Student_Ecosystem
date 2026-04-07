"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  CheckCircle2,
  Coins,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";

type ExpenseCategory =
  | "food"
  | "travel"
  | "academics"
  | "hostel"
  | "entertainment"
  | "utilities"
  | "other";

type ExpenseItem = {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note: string;
  splitEnabled: boolean;
  splitFriends: string[];
  splitPerFriend: number;
  settledFriends: string[];
};

type ExpensesDashboard = {
  month: string;
  totalEntries: number;
  totalSpent: number;
  personalSpent: number;
  recoverable: number;
  settlementRate: number;
  settledCount: number;
  splitFriendsTotal: number;
  categoryTotals: Array<{ category: ExpenseCategory; amount: number }>;
  monthlySeries: Array<{ month: string; label: string; amount: number }>;
};

type ExpensesResponse = {
  expenses: ExpenseItem[];
  dashboard: ExpensesDashboard;
  filterOptions: {
    categories: ExpenseCategory[];
    types: Array<"all" | "personal" | "split">;
  };
};

const categoryLabels: Record<ExpenseCategory, string> = {
  food: "Food",
  travel: "Travel",
  academics: "Academics",
  hostel: "Hostel",
  entertainment: "Entertainment",
  utilities: "Utilities",
  other: "Other",
};

const categoryColorClass: Record<ExpenseCategory, string> = {
  food: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
  travel: "bg-sky-500/15 text-sky-300 border-sky-500/35",
  academics: "bg-indigo-500/15 text-indigo-300 border-indigo-500/35",
  hostel: "bg-amber-500/15 text-amber-300 border-amber-500/35",
  entertainment: "bg-pink-500/15 text-pink-300 border-pink-500/35",
  utilities: "bg-cyan-500/15 text-cyan-300 border-cyan-500/35",
  other: "bg-slate-500/15 text-slate-300 border-slate-500/35",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateIso: string) {
  return new Date(dateIso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function ExpensesHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [categoryFilter, setCategoryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [dashboard, setDashboard] = useState<ExpensesDashboard | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("250");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [splitFriendsInput, setSplitFriendsInput] = useState("");

  const fetchExpenses = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (month) {
        params.set("month", month);
      }
      if (categoryFilter) {
        params.set("category", categoryFilter);
      }
      if (typeFilter && typeFilter !== "all") {
        params.set("type", typeFilter);
      }

      const response = await fetch(`/api/expenses?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as ExpensesResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load expenses");
        setExpenses([]);
        setDashboard(null);
        return;
      }

      const data = payload as ExpensesResponse;
      setExpenses(data.expenses);
      setDashboard(data.dashboard);
    } catch {
      setError("Could not connect to expenses service");
      setExpenses([]);
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      void fetchExpenses();
    }, 120);

    return () => clearTimeout(timer);
  }, [query, month, categoryFilter, typeFilter]);

  const chartMax = useMemo(() => {
    if (!dashboard?.monthlySeries.length) {
      return 1;
    }
    return Math.max(1, ...dashboard.monthlySeries.map((point) => point.amount));
  }, [dashboard]);

  const createExpense = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError(null);

    if (!title.trim()) {
      setFormError("Expense title is required.");
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError("Enter a valid amount.");
      return;
    }

    setSaving(true);

    try {
      const splitFriends = splitFriendsInput
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          amount: numericAmount,
          category,
          date,
          note: note.trim() || undefined,
          splitFriends: splitFriends.length > 0 ? splitFriends : undefined,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "Could not create expense");
        return;
      }

      setTitle("");
      setAmount("250");
      setCategory("other");
      setDate(new Date().toISOString().slice(0, 10));
      setNote("");
      setSplitFriendsInput("");
      setShowCreateModal(false);
      await fetchExpenses();
    } catch {
      setFormError("Could not create expense");
    } finally {
      setSaving(false);
    }
  };

  const updateSettlement = async (expenseId: string, friendName: string, settled: boolean) => {
    setError(null);
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ friendName, settled }),
      });

      if (!response.ok) {
        throw new Error("Could not update split settlement");
      }

      await fetchExpenses();
    } catch {
      setError("Could not update split status");
    }
  };

  const removeExpense = async (expenseId: string) => {
    setError(null);
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Could not delete expense");
      }

      await fetchExpenses();
    } catch {
      setError("Could not delete expense");
    }
  };

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-6 shadow-[0_18px_45px_rgba(0,0,0,0.18)] backdrop-blur-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Expense Tracker</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Personal Finance Overview</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Track daily spending, split costs with friends, and monitor your monthly student budget in one place.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white shadow transition-all duration-200 hover:scale-[1.01] hover:shadow-lg"
          >
            <Plus size={16} />
            Add Expense
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Total Spent</p>
          <p className="mt-3 text-2xl font-bold">{formatCurrency(dashboard?.totalSpent ?? 0)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{dashboard?.totalEntries ?? 0} entries this month</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Personal Burden</p>
          <p className="mt-3 text-2xl font-bold">{formatCurrency(dashboard?.personalSpent ?? 0)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">After split recoveries</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Recoverable</p>
          <p className="mt-3 text-2xl font-bold">{formatCurrency(dashboard?.recoverable ?? 0)}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Pending from friends</p>
        </article>

        <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">Settlement</p>
          <p className="mt-3 text-2xl font-bold">{dashboard?.settlementRate ?? 0}%</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {(dashboard?.settledCount ?? 0)}/{dashboard?.splitFriendsTotal ?? 0} settled
          </p>
        </article>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.8fr_1.2fr]">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-sm">
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <label className="relative md:col-span-2">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, notes, friends..."
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] py-2.5 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[var(--accent)]"
              />
            </label>

            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            />

            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
            >
              <option value="">All Categories</option>
              {Object.entries(categoryLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            {[
              { value: "all", label: "All" },
              { value: "personal", label: "Personal" },
              { value: "split", label: "Split" },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTypeFilter(item.value)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                  typeFilter === item.value
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{error}</div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--text-secondary)]">
              Loading expenses...
            </div>
          ) : expenses.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No expenses yet 💰"
              message="Start tracking your expenses to stay on top of your spending."
              actionLabel="Add Expense"
              onAction={() => setShowCreateModal(true)}
            />
          ) : (
            <div className="space-y-3">
              {expenses.map((expense) => (
                <article
                  key={expense.id}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{expense.title}</h3>
                        <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${categoryColorClass[expense.category]}`}>
                          {categoryLabels[expense.category]}
                        </span>
                        {expense.splitEnabled ? (
                          <span className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-300">
                            Split
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs text-[var(--text-secondary)]">{formatDate(expense.date)}</p>
                      {expense.note ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{expense.note}</p> : null}
                    </div>

                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{formatCurrency(expense.amount)}</p>
                      <button
                        type="button"
                        onClick={() => void removeExpense(expense.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-secondary)] transition-colors hover:border-rose-400 hover:text-rose-300"
                        aria-label="Delete expense"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {expense.splitEnabled ? (
                    <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)]/50 p-3">
                      <div className="mb-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>Per friend share: {formatCurrency(expense.splitPerFriend)}</span>
                        <span>
                          Settled: {expense.settledFriends.length}/{expense.splitFriends.length}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {expense.splitFriends.map((friend) => {
                          const settled = expense.settledFriends.includes(friend);
                          return (
                            <button
                              key={`${expense.id}-${friend}`}
                              type="button"
                              onClick={() => void updateSettlement(expense.id, friend, !settled)}
                              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition-all ${
                                settled
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                              }`}
                            >
                              {settled ? <CheckCircle2 size={12} /> : <Coins size={12} />}
                              {friend}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Spending Trend</h2>
            <div className="space-y-3">
              {(dashboard?.monthlySeries ?? []).map((point) => (
                <div key={point.month}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[var(--text-secondary)]">{point.label}</span>
                    <span className="font-semibold">{formatCurrency(point.amount)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--bg-muted)]">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-400 to-sky-500 transition-all duration-500"
                      style={{ width: `${(point.amount / chartMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Category Mix</h2>
            <div className="space-y-3">
              {(dashboard?.categoryTotals ?? []).slice(0, 6).map((item) => (
                <div key={item.category} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-secondary)]">{categoryLabels[item.category]}</span>
                  <span className="font-semibold">{formatCurrency(item.amount)}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 shadow-sm backdrop-blur-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">Finance Snapshot</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Wallet size={13} />
                  Total entries
                </div>
                <p className="text-lg font-semibold">{dashboard?.totalEntries ?? 0}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Users size={13} />
                  Split friends
                </div>
                <p className="text-lg font-semibold">{dashboard?.splitFriendsTotal ?? 0}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <Banknote size={13} />
                  Recoverable
                </div>
                <p className="text-lg font-semibold">{formatCurrency(dashboard?.recoverable ?? 0)}</p>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                  <BarChart3 size={13} />
                  Settlement rate
                </div>
                <p className="text-lg font-semibold">{dashboard?.settlementRate ?? 0}%</p>
              </div>
            </div>
          </section>
        </aside>
      </div>

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add Expense</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-xl border border-[var(--border)] px-3 py-1 text-xs text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
              >
                Close
              </button>
            </div>

            <form className="space-y-4" onSubmit={createExpense}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Title</span>
                  <input
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Dinner with batchmates"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Amount (INR)</span>
                  <input
                    type="number"
                    min={1}
                    step="1"
                    required
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Category</span>
                  <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value as ExpenseCategory)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Date</span>
                  <input
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Split with friends (comma separated)</span>
                <input
                  value={splitFriendsInput}
                  onChange={(event) => setSplitFriendsInput(event.target.value)}
                  placeholder="Rahul, Aisha"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">Note</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Optional context"
                  className="w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--accent)]"
                />
              </label>

              {formError ? (
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</div>
              ) : null}

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl border border-[var(--accent)] bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:shadow-lg disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save Expense"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
