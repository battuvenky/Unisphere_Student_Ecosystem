"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Clock3,
  GripVertical,
  KanbanSquare,
  ListTodo,
  Plus,
  Search,
  Target,
} from "lucide-react";
import { apiFetchJson, ApiError } from "@/lib/client-api";

type TaskStatus = "todo" | "in_progress" | "done";
type TaskPriority = "low" | "medium" | "high";
type DeadlineFilter = "overdue" | "today" | "week";

type TaskItem = {
  id: string;
  title: string;
  description: string;
  course: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedMinutes: number;
  completedAt: string | null;
};

type TasksDashboard = {
  total: number;
  completed: number;
  completionRate: number;
  overdue: number;
  dueToday: number;
  plannedMinutes: number;
  statusCounts: Record<TaskStatus, number>;
  weeklyCompletion: Array<{ date: string; label: string; done: number }>;
};

type TasksResponse = {
  tasks: TaskItem[];
  dashboard: TasksDashboard;
  filterOptions: {
    statuses: TaskStatus[];
    priorities: TaskPriority[];
    deadlines: DeadlineFilter[];
  };
};

const statusColumns: Array<{ key: TaskStatus; label: string; hint: string }> = [
  { key: "todo", label: "To Do", hint: "Backlog and upcoming tasks" },
  { key: "in_progress", label: "In Progress", hint: "Currently focused" },
  { key: "done", label: "Done", hint: "Completed work" },
];

const priorityPillClass: Record<TaskPriority, string> = {
  low: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  high: "bg-rose-500/15 text-rose-300 border-rose-500/40",
};

const statusPillClass: Record<TaskStatus, string> = {
  todo: "bg-sky-500/15 text-sky-300 border-sky-500/35",
  in_progress: "bg-indigo-500/15 text-indigo-300 border-indigo-500/35",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
};

function toDisplayStatus(status: TaskStatus) {
  if (status === "in_progress") {
    return "In Progress";
  }

  if (status === "todo") {
    return "To Do";
  }

  return "Done";
}

function toDisplayPriority(priority: TaskPriority) {
  return priority.slice(0, 1).toUpperCase() + priority.slice(1);
}

function getDeadlineMeta(deadlineIso: string, status: TaskStatus) {
  const today = new Date().toISOString().slice(0, 10);
  const diff = Math.floor((Date.parse(deadlineIso) - Date.parse(today)) / 86_400_000);

  if (status === "done") {
    return {
      label: "Completed",
      className: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35",
    };
  }

  if (diff < 0) {
    return {
      label: `Overdue ${Math.abs(diff)}d`,
      className: "bg-rose-500/15 text-rose-300 border-rose-500/35",
    };
  }

  if (diff === 0) {
    return {
      label: "Due Today",
      className: "bg-amber-500/15 text-amber-300 border-amber-500/35",
    };
  }

  if (diff <= 3) {
    return {
      label: `Due in ${diff}d`,
      className: "bg-sky-500/15 text-sky-300 border-sky-500/35",
    };
  }

  return {
    label: `Due in ${diff}d`,
    className: "bg-slate-500/15 text-slate-300 border-slate-500/35",
  };
}

function formatDeadline(dateIso: string) {
  return new Date(dateIso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function TasksHub() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [dashboard, setDashboard] = useState<TasksDashboard | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [deadlineFilter, setDeadlineFilter] = useState("");

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropStatus, setDropStatus] = useState<TaskStatus | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [course, setCourse] = useState("");
  const [deadline, setDeadline] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [estimatedMinutes, setEstimatedMinutes] = useState("45");

  const fetchTasks = async (signal?: AbortSignal) => {
    const isBackgroundRefresh = tasks.length > 0 || dashboard !== null;
    if (isBackgroundRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      if (query.trim()) {
        params.set("query", query.trim());
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (priorityFilter) {
        params.set("priority", priorityFilter);
      }
      if (deadlineFilter) {
        params.set("deadline", deadlineFilter);
      }

      const data = await apiFetchJson<TasksResponse>(`/api/tasks?${params.toString()}`, {
        cache: "no-store",
        timeoutMs: 12000,
        signal,
      });
      setTasks(data.tasks);
      setDashboard(data.dashboard);
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) {
        return;
      }

      const fallbackMessage =
        requestError instanceof ApiError
          ? requestError.status === 408
            ? "Tasks are taking longer than expected. Retrying..."
            : requestError.message
          : "Could not connect to tasks service";

      setError(fallbackMessage);

      if (!isBackgroundRefresh) {
        setTasks([]);
        setDashboard(null);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetchTasks(controller.signal);
    }, 140);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, statusFilter, priorityFilter, deadlineFilter]);

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskStatus, TaskItem[]> = {
      todo: [],
      in_progress: [],
      done: [],
    };

    for (const task of tasks) {
      groups[task.status].push(task);
    }

    return groups;
  }, [tasks]);

  const weeklyMax = useMemo(() => {
    if (!dashboard?.weeklyCompletion.length) {
      return 1;
    }

    return Math.max(1, ...dashboard.weeklyCompletion.map((point) => point.done));
  }, [dashboard]);

  const createTask = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setFormError(null);

    if (!title.trim()) {
      setFormError("Task title is required.");
      return;
    }

    setSaving(true);

    try {
      await apiFetchJson<{ success: boolean }>("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          course: course.trim() || undefined,
          deadline: deadline || undefined,
          priority,
          estimatedMinutes: Number(estimatedMinutes),
        }),
      });

      setTitle("");
      setDescription("");
      setCourse("");
      setDeadline("");
      setPriority("medium");
      setEstimatedMinutes("45");
      setShowCreateModal(false);
      await fetchTasks();
    } catch (requestError) {
      setFormError(requestError instanceof ApiError ? requestError.message : "Could not create task");
    } finally {
      setSaving(false);
    }
  };

  const patchTask = async (
    taskId: string,
    payload: Partial<{ status: TaskStatus; completed: boolean }>
  ) => {
    await apiFetchJson<{ success: boolean }>(`/api/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  };

  const toggleComplete = async (task: TaskItem) => {
    const next = task.status !== "done";

    setTasks((prev) =>
      prev.map((item) =>
        item.id === task.id
          ? {
              ...item,
              status: next ? "done" : "todo",
            }
          : item
      )
    );

    try {
      await patchTask(task.id, { completed: next });
      await fetchTasks();
    } catch {
      setError("Could not update task status. Showing latest data.");
      await fetchTasks();
    }
  };

  const handleDrop = async (status: TaskStatus) => {
    if (!draggingTaskId) {
      return;
    }

    setTasks((prev) =>
      prev.map((item) =>
        item.id === draggingTaskId
          ? {
              ...item,
              status,
            }
          : item
      )
    );

    try {
      await patchTask(draggingTaskId, { status });
      await fetchTasks();
    } catch {
      setError("Could not move task. Showing latest data.");
      await fetchTasks();
    } finally {
      setDraggingTaskId(null);
      setDropStatus(null);
    }
  };

  return (
    <section className="page-enter space-y-6">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm card-hover">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
              <Target size={14} />
              Task Studio
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight">Tasks and Assignments</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Plan assignments, organize coursework, and move tasks across your workflow with smooth drag and drop.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setFormError(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:brightness-110"
          >
            <Plus size={16} />
            New Task
          </button>
        </div>

        <div className="mt-6 h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-muted)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 transition-all duration-500"
            style={{ width: `${dashboard?.completionRate ?? 0}%` }}
          />
        </div>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--text-secondary)]">
          Completion rate {dashboard?.completionRate ?? 0}%
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 stagger-children">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 card-hover">
          <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">Total Tasks</p>
          <p className="mt-2 text-2xl font-semibold">{dashboard?.total ?? 0}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{dashboard?.completed ?? 0} completed</p>
        </div>

        <div className="rounded-2xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 to-transparent p-4 card-hover">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-amber-200">
            <CalendarClock size={14} />
            Due Today
          </p>
          <p className="mt-2 text-2xl font-semibold">{dashboard?.dueToday ?? 0}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Prioritize these first</p>
        </div>

        <div className="rounded-2xl border border-rose-500/35 bg-gradient-to-br from-rose-500/10 to-transparent p-4 card-hover">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-rose-200">
            <AlertTriangle size={14} />
            Overdue
          </p>
          <p className="mt-2 text-2xl font-semibold">{dashboard?.overdue ?? 0}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Need immediate attention</p>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 card-hover">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
            <Clock3 size={14} />
            Planned Hours
          </p>
          <p className="mt-2 text-2xl font-semibold">{Math.round(((dashboard?.plannedMinutes ?? 0) / 60) * 10) / 10}h</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Work remaining</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search tasks or course"
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] py-2.5 pl-9 pr-3 text-sm outline-none transition-all duration-200 focus:border-[var(--accent)]"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All status</option>
              <option value="todo">To do</option>
              <option value="in_progress">In progress</option>
              <option value="done">Done</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={deadlineFilter}
              onChange={(event) => setDeadlineFilter(event.target.value)}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2.5 text-sm outline-none"
            >
              <option value="">All deadlines</option>
              <option value="overdue">Overdue</option>
              <option value="today">Due today</option>
              <option value="week">This week</option>
            </select>

            <div className="ml-auto inline-flex rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-1">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === "kanban" ? "bg-[var(--card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <KanbanSquare size={14} /> Kanban
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === "list" ? "bg-[var(--card)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <ListTodo size={14} /> List
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <BarChart3 size={16} />
            Weekly Completion
          </p>
          <div className="mt-4 flex items-end gap-2">
            {(dashboard?.weeklyCompletion ?? []).map((point) => (
              <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
                <div className="h-20 w-full rounded-md bg-[var(--bg-muted)] p-1">
                  <div
                    className="h-full w-full rounded-sm bg-gradient-to-t from-sky-500/85 to-indigo-500/85 transition-all duration-500"
                    style={{
                      transform: `scaleY(${Math.max(0.1, point.done / weeklyMax)})`,
                      transformOrigin: "bottom",
                    }}
                  />
                </div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{point.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
      ) : null}

      {refreshing && !loading ? (
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">
          Refreshing tasks...
        </p>
      ) : null}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
          <div className="skeleton h-44 rounded-2xl" />
        </div>
      ) : null}

      {!loading && viewMode === "kanban" ? (
        <div className="grid gap-4 xl:grid-cols-3">
          {statusColumns.map((column) => {
            const columnTasks = groupedTasks[column.key] ?? [];
            const activeDrop = dropStatus === column.key;

            return (
              <div
                key={column.key}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDropStatus(column.key);
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDrop(column.key);
                }}
                onDragLeave={() => {
                  if (dropStatus === column.key) {
                    setDropStatus(null);
                  }
                }}
                className={`rounded-2xl border p-4 transition-all duration-200 ${
                  activeDrop ? "border-[var(--accent)] bg-[var(--bg-muted)]" : "border-[var(--border)] bg-[var(--card)]"
                }`}
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold">{column.label}</h3>
                    <span className="rounded-full border border-[var(--border)] bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-semibold">
                      {columnTasks.length}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{column.hint}</p>
                </div>

                <div className="space-y-3">
                  {columnTasks.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-5 text-center text-xs text-[var(--text-secondary)]">
                      No tasks
                    </div>
                  ) : null}

                  {columnTasks.map((task) => {
                    const deadlineMeta = getDeadlineMeta(task.deadline, task.status);

                    return (
                      <article
                        key={task.id}
                        draggable={task.status !== "done"}
                        onDragStart={() => setDraggingTaskId(task.id)}
                        onDragEnd={() => {
                          setDraggingTaskId(null);
                          setDropStatus(null);
                        }}
                        className="group rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/10"
                      >
                        <div className="flex items-start gap-2">
                          <button
                            type="button"
                            onClick={() => void toggleComplete(task)}
                            className={`mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                              task.status === "done"
                                ? "border-emerald-400/60 bg-emerald-500 text-white"
                                : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--accent)]"
                            }`}
                            aria-label="Toggle complete"
                          >
                            {task.status === "done" ? <CheckCircle2 size={13} /> : null}
                          </button>

                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold leading-5 text-[var(--text-primary)]">{task.title}</p>
                            {task.description ? (
                              <p className="mt-1 line-clamp-2 text-xs text-[var(--text-secondary)]">{task.description}</p>
                            ) : null}
                          </div>

                          {task.status !== "done" ? (
                            <GripVertical size={15} className="text-[var(--text-secondary)] opacity-0 transition-opacity group-hover:opacity-100" />
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${priorityPillClass[task.priority]}`}>
                            {toDisplayPriority(task.priority)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusPillClass[task.status]}`}>
                            {toDisplayStatus(task.status)}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${deadlineMeta.className}`}>
                            {deadlineMeta.label}
                          </span>
                        </div>

                        <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                          <p>{task.course}</p>
                          <p>{Math.round(task.estimatedMinutes / 60)}h</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {!loading && viewMode === "list" ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]">
          <div className="responsive-table-wrap">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_80px] gap-3 border-b border-[var(--border)] px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--text-secondary)]">
                <p>Task</p>
                <p>Course</p>
                <p>Deadline</p>
                <p>Status</p>
                <p>Done</p>
              </div>

              <div className="divide-y divide-[var(--border)]">
                {tasks.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-[var(--text-secondary)]">No matching tasks found.</div>
                ) : null}

                {tasks.map((task) => {
                  const deadlineMeta = getDeadlineMeta(task.deadline, task.status);
                  return (
                    <div key={task.id} className="grid grid-cols-[minmax(220px,2fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_80px] gap-3 px-4 py-3 text-sm transition-colors hover:bg-[var(--bg-muted)]/70">
                      <div>
                        <p className="font-semibold leading-5">{task.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{task.description || "No notes"}</p>
                      </div>
                      <p className="text-[var(--text-secondary)]">{task.course}</p>
                      <div>
                        <p>{formatDeadline(task.deadline)}</p>
                        <p className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${deadlineMeta.className}`}>
                          {deadlineMeta.label}
                        </p>
                      </div>
                      <p className={`inline-flex h-fit rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${statusPillClass[task.status]}`}>
                        {toDisplayStatus(task.status)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void toggleComplete(task)}
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors ${
                          task.status === "done"
                            ? "border-emerald-400/60 bg-emerald-500 text-white"
                            : "border-[var(--border)] bg-[var(--bg-muted)] hover:border-[var(--accent)]"
                        }`}
                        aria-label="Toggle complete"
                      >
                        {task.status === "done" ? <CheckCircle2 size={14} /> : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateModal ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-[var(--border)] bg-[var(--surface)]/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Create New Task</h2>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Add assignment details, due date, and planned effort.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Close
              </button>
            </div>

            <form onSubmit={createTask} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Title</label>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Example: Submit CN assignment"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Description</label>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="Add notes or acceptance criteria"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)]"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Course</label>
                  <input
                    value={course}
                    onChange={(event) => setCourse(event.target.value)}
                    placeholder="DSA / DBMS / OS"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Deadline</label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Priority</label>
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as TaskPriority)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Planned minutes</label>
                  <input
                    type="number"
                    min={10}
                    max={720}
                    value={estimatedMinutes}
                    onChange={(event) => setEstimatedMinutes(event.target.value)}
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm outline-none transition-all focus:border-[var(--accent)]"
                  />
                </div>
              </div>

              {formError ? (
                <p className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{formError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] px-4 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-70"
                >
                  {saving ? "Saving..." : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
