"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  BookMarked,
  CalendarDays,
  CheckCheck,
  CircleDot,
  Filter,
  Inbox,
  MessageCircle,
  Plus,
  Reply,
  Trash2,
  UserPlus,
} from "lucide-react";
import { EmptyState } from "../empty-state";
import { getRealtimeSocket } from "@/lib/realtime-client";

type NotificationType = "task" | "exam" | "event" | "friend" | "message" | "comment" | "reply";

type NotificationItem = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  priority: "low" | "medium" | "high";
  isRead: boolean;
  createdAt: string;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
  unreadCount: number;
  total: number;
};

const typeIcon: Record<NotificationType, React.ComponentType<{ size?: number; className?: string }>> = {
  task: CircleDot,
  exam: BookMarked,
  event: CalendarDays,
  friend: UserPlus,
  message: MessageCircle,
  comment: MessageCircle,
  reply: Reply,
};

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationsHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [exitingIds, setExitingIds] = useState<string[]>([]);

  const [filterType, setFilterType] = useState<"all" | NotificationType>("all");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [type, setType] = useState<NotificationType>("event");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("/dashboard");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const loadNotifications = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;

    if (!silent) {
      setLoading(true);
    }
    setError(null);

    try {
      const params = new URLSearchParams();
      if (unreadOnly) {
        params.set("unread", "true");
      }
      if (filterType !== "all") {
        params.set("type", filterType);
      }

      const response = await fetch(`/api/notifications?${params.toString()}`, { cache: "no-store" });
      const payload = (await response.json()) as NotificationsResponse | { error?: string };

      if (!response.ok) {
        setError((payload as { error?: string }).error ?? "Could not load notifications");
        setNotifications([]);
        setUnreadCount(0);
        return;
      }

      const data = payload as NotificationsResponse;
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch {
      setError("Could not connect to notifications service");
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [filterType, unreadOnly]);

  useEffect(() => {
    const socket = getRealtimeSocket();
    if (!socket) {
      return;
    }

    const handleNotificationsChanged = () => {
      void loadNotifications({ silent: true });
    };

    socket.on("notifications:changed", handleNotificationsChanged);
    socket.on("connect", handleNotificationsChanged);

    return () => {
      socket.off("notifications:changed", handleNotificationsChanged);
      socket.off("connect", handleNotificationsChanged);
    };
  }, [filterType, unreadOnly]);

  const markRead = async (notificationId: string, isRead: boolean) => {
    await fetch(`/api/notifications/${notificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isRead }),
    });
    await loadNotifications({ silent: true });
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await loadNotifications({ silent: true });
  };

  const clearViewed = async () => {
    await fetch("/api/notifications", { method: "DELETE" });
    await loadNotifications({ silent: true });
  };

  const clearAll = async () => {
    setExitingIds(notifications.map((item) => item.id));

    window.setTimeout(() => {
      setNotifications([]);
      setUnreadCount(0);
      setExitingIds([]);
    }, 185);

    await fetch("/api/notifications/clear-all", { method: "DELETE" });
    await loadNotifications({ silent: true });
  };

  const animateRemove = (id: string) => {
    setExitingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));

    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      setExitingIds((prev) => prev.filter((item) => item !== id));
    }, 185);
  };

  const removeNotification = async (notificationId: string) => {
    const target = notifications.find((item) => item.id === notificationId);
    animateRemove(notificationId);
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    await fetch(`/api/notifications/${notificationId}`, { method: "DELETE" });
    await loadNotifications({ silent: true });
  };

  const openNotification = (notification: NotificationItem) => {
    animateRemove(notification.id);
    if (!notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    void fetch(`/api/notifications/${notification.id}`, {
      method: "DELETE",
      keepalive: true,
    });
  };

  const createAlert = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title,
          message,
          link,
          priority,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFormError(payload.error ?? "Could not create notification");
        return;
      }

      setTitle("");
      setMessage("");
      setLink("/dashboard");
      setPriority("medium");
      setType("event");
      setShowCreate(false);
      await loadNotifications({ silent: true });
    } catch {
      setFormError("Could not connect to notification service");
    } finally {
      setSaving(false);
    }
  };

  const byType = useMemo(() => {
    return {
      task: notifications.filter((item) => item.type === "task").length,
      exam: notifications.filter((item) => item.type === "exam").length,
      event: notifications.filter((item) => item.type === "event").length,
    };
  }, [notifications]);

  return (
    <section className="page-enter space-y-5">
      <header className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/85 p-5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Notifications</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-[var(--text-primary)] md:text-3xl">Smart Alerts Center</h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--text-secondary)]">
              Real-time updates for friend activity, messages, tasks, and discussion activity with subtle motion and unread indicators.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-xs font-semibold text-white shadow transition-all duration-200 hover:translate-y-[-1px] hover:shadow-lg"
            >
              <Plus size={14} /> New Alert
            </button>
            <button
              type="button"
              onClick={markAllRead}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              <CheckCheck size={14} /> Mark all read
            </button>
            <button
              type="button"
              onClick={clearViewed}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
            >
              <Trash2 size={14} /> Clear viewed
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-400/50 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/20"
            >
              <Trash2 size={14} /> Clear all
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4 stagger-children">
        <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">Unread</p>
          {loading ? <div className="skeleton mt-2 h-8 w-14 rounded-lg" /> : <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{unreadCount}</p>}
        </article>
        <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">Task Alerts</p>
          {loading ? <div className="skeleton mt-2 h-8 w-14 rounded-lg" /> : <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{byType.task}</p>}
        </article>
        <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">Exam Alerts</p>
          {loading ? <div className="skeleton mt-2 h-8 w-14 rounded-lg" /> : <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{byType.exam}</p>}
        </article>
        <article className="card-hover rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <p className="text-xs text-[var(--text-secondary)]">Event Alerts</p>
          {loading ? <div className="skeleton mt-2 h-8 w-14 rounded-lg" /> : <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{byType.event}</p>}
        </article>
      </div>

      <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)]/90 p-4 shadow-sm backdrop-blur">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <Filter size={14} /> Filters
          </div>

          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "all" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilterType("task")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "task" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setFilterType("exam")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "exam" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Exams
          </button>
          <button
            type="button"
            onClick={() => setFilterType("event")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "event" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Events
          </button>
          <button
            type="button"
            onClick={() => setFilterType("friend")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "friend" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Friends
          </button>
          <button
            type="button"
            onClick={() => setFilterType("message")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "message" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Messages
          </button>
          <button
            type="button"
            onClick={() => setFilterType("reply")}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              filterType === "reply" ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Replies
          </button>

          <button
            type="button"
            onClick={() => setUnreadOnly((value) => !value)}
            className={`rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
              unreadOnly ? "bg-[var(--accent)] text-white" : "border border-[var(--border)] bg-[var(--card)] text-[var(--text-secondary)]"
            }`}
          >
            Unread only
          </button>
        </div>

        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <article key={index} className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4" aria-hidden="true">
                <div className="space-y-3">
                  <div className="skeleton h-5 w-44 rounded-lg" />
                  <div className="skeleton h-4 w-full rounded-lg" />
                  <div className="skeleton h-4 w-10/12 rounded-lg" />
                  <div className="skeleton h-3 w-24 rounded-lg" />
                </div>
              </article>
            ))
          ) : error ? (
            <p className="rounded-xl border border-rose-400/50 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>
          ) : notifications.length === 0 ? (
            <div className="flex items-center justify-center p-8">
              <EmptyState
                icon={Inbox}
                title="All caught up! 🎉"
                message="You have no notifications. Check back when new updates arrive."
              />
            </div>
          ) : (
            notifications.map((notification) => {
              const TypeIcon = typeIcon[notification.type];

              return (
                <article
                  key={notification.id}
                  className={`card-hover rounded-2xl border p-4 ${
                    notification.isRead ? "border-[var(--border)] bg-[var(--card)]" : "border-[var(--accent)]/40 bg-[var(--accent)]/5"
                  } ${exitingIds.includes(notification.id) ? "notification-exit" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <TypeIcon size={15} className="text-[var(--accent)]" />
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</h3>
                        {!notification.isRead ? (
                          <span className="inline-flex h-2 w-2 rounded-full bg-[var(--accent)]" aria-label="Unread notification" />
                        ) : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{notification.message}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">{timeAgo(notification.createdAt)}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={notification.link}
                        onClick={() => {
                          openNotification(notification);
                        }}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--card)]"
                      >
                        Open
                      </a>
                      <button
                        type="button"
                        onClick={() => void markRead(notification.id, !notification.isRead)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--card)]"
                      >
                        {notification.isRead ? "Mark unread" : "Mark read"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void removeNotification(notification.id)}
                        className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-2.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--card)]"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </section>

      {showCreate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-[var(--border)] auth-glass-card p-5 shadow-2xl page-enter">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[var(--text-primary)]">Create Alert</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setFormError(null);
                }}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]"
              >
                Close
              </button>
            </div>

            <form className="space-y-3" onSubmit={(event) => void createAlert(event)}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                  Type
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as NotificationType)}
                    className="auth-input"
                  >
                    <option value="task">Task</option>
                    <option value="exam">Exam</option>
                    <option value="event">Event</option>
                  </select>
                </label>

                <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                  Priority
                  <select
                    value={priority}
                    onChange={(event) => setPriority(event.target.value as "low" | "medium" | "high")}
                    className="auth-input"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                Title
                <input
                  className="auth-input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="Exam reminder or event alert"
                  required
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                Message
                <textarea
                  className="auth-input min-h-[90px]"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={300}
                  placeholder="Add context and what action to take"
                  required
                />
              </label>

              <label className="space-y-1 text-xs font-semibold text-[var(--text-secondary)]">
                Link
                <input
                  className="auth-input"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  maxLength={120}
                  placeholder="/tasks or /placement"
                />
              </label>

              {formError ? <p className="text-xs text-rose-300">{formError}</p> : null}

              <button
                type="submit"
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow transition-all duration-200 hover:translate-y-[-1px] hover:shadow-lg disabled:opacity-70"
              >
                <Bell size={15} /> {saving ? "Creating..." : "Create Notification"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
