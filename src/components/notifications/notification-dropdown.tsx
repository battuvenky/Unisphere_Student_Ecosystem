"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BookMarked, CalendarDays, CheckCheck, CircleDot, MessageCircle, Reply, Trash2, UserPlus } from "lucide-react";
import { apiFetchJson, ApiError } from "@/lib/client-api";
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

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false);
  const [bellBounce, setBellBounce] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inflightRef = useRef(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (inflightRef.current) {
      return;
    }

    inflightRef.current = true;
    try {
      const data = await apiFetchJson<NotificationsResponse>("/api/notifications?limit=8", {
        cache: "no-store",
        timeoutMs: 9000,
        signal,
      });
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
      setError(null);
    } catch (requestError) {
      if (signal?.aborted) {
        return;
      }

      if (requestError instanceof ApiError && requestError.status === 408) {
        setError("Notification service is slow. Retrying...");
      } else {
        setError("Could not refresh notifications");
      }
    } finally {
      setLoading(false);
      inflightRef.current = false;
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);

    const socket = getRealtimeSocket();

    const handleNotificationsChanged = () => {
      void load(controller.signal);
    };

    socket?.on("notifications:changed", handleNotificationsChanged);
    socket?.on("connect", handleNotificationsChanged);

    return () => {
      controller.abort();
      socket?.off("notifications:changed", handleNotificationsChanged);
      socket?.off("connect", handleNotificationsChanged);
    };
  }, [load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void load();
  }, [open, load]);

  useEffect(() => {
    const onFocus = () => {
      void load();
    };

    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  useEffect(() => {
    const onOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }

      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  const markReadState = async (id: string, nextIsRead: boolean) => {
    setNotifications((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: nextIsRead } : item)));
    setUnreadCount((prev) => (nextIsRead ? Math.max(0, prev - 1) : prev + 1));

    try {
      await apiFetchJson<{ success: boolean }>(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: nextIsRead }),
      });
    } catch {
      await load();
    }
  };

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    setUnreadCount(0);

    try {
      await apiFetchJson<{ success: boolean }>("/api/notifications/read-all", {
        method: "POST",
      });
    } catch {
      await load();
    }
  };

  const clearRead = async () => {
    setNotifications((prev) => prev.filter((item) => !item.isRead));

    try {
      await apiFetchJson<{ success: boolean; removed: number }>("/api/notifications", {
        method: "DELETE",
      });
      await load();
    } catch {
      await load();
    }
  };

  const clearAll = async () => {
    setExitingIds(notifications.map((item) => item.id));

    window.setTimeout(() => {
      setNotifications([]);
      setUnreadCount(0);
      setExitingIds([]);
    }, 185);

    try {
      await apiFetchJson<{ success: boolean; removed: number }>("/api/notifications/clear-all", {
        method: "DELETE",
      });
    } catch {
      await load();
    }
  };

  const animateRemove = (id: string) => {
    setExitingIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
    window.setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== id));
      setExitingIds((prev) => prev.filter((item) => item !== id));
    }, 185);
  };

  const removeNotification = async (id: string) => {
    const previous = notifications;
    const target = previous.find((item) => item.id === id);

    animateRemove(id);
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    try {
      await apiFetchJson<{ success: boolean }>(`/api/notifications/${id}`, {
        method: "DELETE",
      });
    } catch {
      await load();
    }
  };

  const onOpenNotification = (notification: NotificationItem) => {
    if (!notification.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    animateRemove(notification.id);
    void fetch(`/api/notifications/${notification.id}`, {
      method: "DELETE",
      keepalive: true,
    });
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => {
          setBellBounce(true);
          setOpen((value) => !value);
          window.setTimeout(() => setBellBounce(false), 260);
        }}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--text-primary)] shadow-sm transition-all duration-200 hover:scale-[1.03] hover:shadow-md ${bellBounce ? "bell-bounce" : ""}`}
        aria-label="Open notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1.5 py-0.5 text-[10px] font-bold text-white shadow animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="notification-panel-enter absolute right-0 top-12 z-40 w-[360px] max-w-[92vw] rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-3 shadow-2xl backdrop-blur-lg">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Notifications</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-semibold text-[var(--accent)] hover:opacity-80"
              >
                Mark all read
              </button>
              <button
                type="button"
                onClick={clearRead}
                className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Clear viewed
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-rose-400 hover:text-rose-300"
              >
                Clear all
              </button>
            </div>
          </div>

          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {loading ? (
              <div className="space-y-2">
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
                <div className="skeleton h-16 rounded-xl" />
              </div>
            ) : error ? (
              <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200">
                {error}
              </p>
            ) : notifications.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-3 text-xs text-[var(--text-secondary)]">
                No notifications yet.
              </p>
            ) : (
              notifications.map((notification) => {
                const TypeIcon = typeIcon[notification.type];

                return (
                  <div
                    key={notification.id}
                    className={`rounded-xl border p-3 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      notification.isRead
                        ? "border-[var(--border)] bg-[var(--card)]"
                        : "border-[var(--accent)]/45 bg-[var(--accent)]/5"
                    } ${exitingIds.includes(notification.id) ? "notification-exit" : ""}`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <TypeIcon size={14} className="text-[var(--accent)]" />
                        <p className="text-xs font-semibold text-[var(--text-primary)]">{notification.title}</p>
                      </div>
                      <span className="text-[10px] text-[var(--text-secondary)]">{timeAgo(notification.createdAt)}</span>
                    </div>
                    <p className="mb-2 text-xs text-[var(--text-secondary)]">{notification.message}</p>
                    <div className="flex items-center justify-between">
                      <Link
                        href={notification.link}
                        onClick={() => {
                          onOpenNotification(notification);
                          setOpen(false);
                        }}
                        className="text-xs font-semibold text-[var(--accent)] hover:opacity-80"
                      >
                        View
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void markReadState(notification.id, !notification.isRead)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                        >
                          <CheckCheck size={13} /> {notification.isRead ? "Unread" : "Read"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeNotification(notification.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-400"
                        >
                          <Trash2 size={13} /> Clear
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/notifications"
            onClick={() => setOpen(false)}
            className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] py-2 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--bg-muted)]"
          >
            Open Notification Center
          </Link>
        </div>
      ) : null}
    </div>
  );
}
