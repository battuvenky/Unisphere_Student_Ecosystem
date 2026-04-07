"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Ban, FileText, MessageSquareWarning, RefreshCcw, ShieldCheck, Trash2, Users } from "lucide-react";

type AdminOverview = {
  stats: {
    users: number;
    blockedUsers: number;
    resources: number;
    doubts: number;
    announcements: number;
  };
  recentAnnouncements: AnnouncementRecord[];
};

type UserRecordLite = {
  id: string;
  email: string;
  role: "student" | "admin";
  isBlocked: boolean;
  blockedAt: string | null;
  createdAt: string;
  profile: {
    fullName: string;
    department: string;
    year: string;
    specialization?: string;
  };
};

type ResourceRecordLite = {
  id: string;
  title: string;
  subject: string;
  downloads: number;
  uploadedBy: {
    name: string;
  };
  createdAt: string;
};

type DoubtRecordLite = {
  id: string;
  title: string;
  subject: string;
  votes: {
    score: number;
  };
  answersCount: number;
  author: {
    name: string;
  };
  createdAt: string;
};

type AnnouncementRecord = {
  id: string;
  title: string;
  message: string;
  isPinned: boolean;
  createdAt: string;
  createdBy: {
    name: string;
  };
};

type LoadState = "idle" | "loading" | "ready" | "error";

function formatDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

async function jsonRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data;
}

export function AdminDashboard() {
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<UserRecordLite[]>([]);
  const [resources, setResources] = useState<ResourceRecordLite[]>([]);
  const [doubts, setDoubts] = useState<DoubtRecordLite[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>([]);

  const [announcementTitle, setAnnouncementTitle] = useState("");
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementPinned, setAnnouncementPinned] = useState(false);

  const [busyKey, setBusyKey] = useState<string | null>(null);

  const loadAll = async () => {
    setLoadState("loading");
    setError(null);

    try {
      const [overviewData, usersData, resourcesData, doubtsData, announcementsData] = await Promise.all([
        jsonRequest<{ stats: AdminOverview["stats"]; recentAnnouncements: AnnouncementRecord[] }>("/api/admin/overview"),
        jsonRequest<{ users: UserRecordLite[] }>("/api/admin/users"),
        jsonRequest<{ resources: ResourceRecordLite[] }>("/api/admin/resources"),
        jsonRequest<{ doubts: DoubtRecordLite[] }>("/api/admin/doubts"),
        jsonRequest<{ announcements: AnnouncementRecord[] }>("/api/admin/announcements"),
      ]);

      setOverview({
        stats: overviewData.stats,
        recentAnnouncements: overviewData.recentAnnouncements,
      });
      setUsers(usersData.users);
      setResources(resourcesData.resources);
      setDoubts(doubtsData.doubts);
      setAnnouncements(announcementsData.announcements);
      setLoadState("ready");
    } catch (loadError) {
      setLoadState("error");
      setError(loadError instanceof Error ? loadError.message : "Failed to load admin data");
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const studentCount = useMemo(
    () => users.filter((user) => user.role === "student").length,
    [users]
  );

  const adminCount = users.length - studentCount;

  const manageUser = async (userId: string, action: "block" | "unblock" | "delete") => {
    setBusyKey(`user-${userId}-${action}`);
    try {
      await jsonRequest("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ userId, action }),
      });
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  const removeResource = async (resourceId: string) => {
    setBusyKey(`resource-${resourceId}`);
    try {
      await jsonRequest("/api/admin/resources", {
        method: "DELETE",
        body: JSON.stringify({ resourceId }),
      });
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  const removeDoubt = async (doubtId: string) => {
    setBusyKey(`doubt-${doubtId}`);
    try {
      await jsonRequest("/api/admin/doubts", {
        method: "DELETE",
        body: JSON.stringify({ doubtId }),
      });
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  const createAnnouncement = async () => {
    if (!announcementTitle.trim() || !announcementMessage.trim()) {
      return;
    }

    setBusyKey("announcement-create");
    try {
      await jsonRequest("/api/admin/announcements", {
        method: "POST",
        body: JSON.stringify({
          title: announcementTitle,
          message: announcementMessage,
          isPinned: announcementPinned,
        }),
      });
      setAnnouncementTitle("");
      setAnnouncementMessage("");
      setAnnouncementPinned(false);
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  const togglePin = async (announcement: AnnouncementRecord) => {
    setBusyKey(`announcement-pin-${announcement.id}`);
    try {
      await jsonRequest("/api/admin/announcements", {
        method: "PATCH",
        body: JSON.stringify({
          announcementId: announcement.id,
          action: "update",
          isPinned: !announcement.isPinned,
          title: announcement.title,
          message: announcement.message,
        }),
      });
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  const deleteAnnouncement = async (announcementId: string) => {
    setBusyKey(`announcement-delete-${announcementId}`);
    try {
      await jsonRequest("/api/admin/announcements", {
        method: "PATCH",
        body: JSON.stringify({ announcementId, action: "delete" }),
      });
      await loadAll();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">Admin Control Center</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Manage users, moderate content, and publish announcements from one dashboard.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadAll()}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]"
          disabled={loadState === "loading"}
        >
          <RefreshCcw size={14} className={loadState === "loading" ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Total Users" value={overview?.stats.users ?? users.length} icon={<Users size={16} />} />
        <StatCard title="Blocked Users" value={overview?.stats.blockedUsers ?? users.filter((user) => user.isBlocked).length} icon={<Ban size={16} />} />
        <StatCard title="Resources" value={overview?.stats.resources ?? resources.length} icon={<FileText size={16} />} />
        <StatCard title="Doubts" value={overview?.stats.doubts ?? doubts.length} icon={<MessageSquareWarning size={16} />} />
        <StatCard title="Announcements" value={overview?.stats.announcements ?? announcements.length} icon={<ShieldCheck size={16} />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-12">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 xl:col-span-7">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">User Management</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Role</th>
                  <th className="pb-2">Department</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-[var(--border)]/70">
                    <td className="py-2.5">
                      <p className="font-medium text-[var(--text-primary)]">{user.profile.fullName}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{user.email}</p>
                    </td>
                    <td className="py-2.5 text-[var(--text-secondary)]">{user.role}</td>
                    <td className="py-2.5 text-[var(--text-secondary)]">{user.profile.department}</td>
                    <td className="py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${user.isBlocked ? "bg-rose-500/15 text-rose-300" : "bg-emerald-500/15 text-emerald-300"}`}>
                        {user.isBlocked ? "Blocked" : "Active"}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      {user.role === "admin" ? (
                        <span className="text-xs text-[var(--text-secondary)]">Protected</span>
                      ) : (
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => void manageUser(user.id, user.isBlocked ? "unblock" : "block")}
                            disabled={busyKey !== null}
                            className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs font-medium text-[var(--text-primary)]"
                          >
                            {busyKey === `user-${user.id}-${user.isBlocked ? "unblock" : "block"}` ? "..." : user.isBlocked ? "Unblock" : "Block"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void manageUser(user.id, "delete")}
                            disabled={busyKey !== null}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-400/40 px-2 py-1 text-xs font-medium text-rose-300"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-[var(--text-secondary)]">Students: {studentCount} · Admins: {adminCount}</p>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 xl:col-span-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Announcements</h2>
          <div className="space-y-2 rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
            <input
              value={announcementTitle}
              onChange={(event) => setAnnouncementTitle(event.target.value)}
              placeholder="Announcement title"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            />
            <textarea
              value={announcementMessage}
              onChange={(event) => setAnnouncementMessage(event.target.value)}
              placeholder="Write announcement details..."
              className="min-h-[90px] w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none"
            />
            <label className="inline-flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={announcementPinned}
                onChange={(event) => setAnnouncementPinned(event.target.checked)}
              />
              Pin announcement
            </label>
            <button
              type="button"
              onClick={() => void createAnnouncement()}
              className="w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white"
              disabled={busyKey === "announcement-create"}
            >
              {busyKey === "announcement-create" ? "Publishing..." : "Publish Announcement"}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {announcements.map((announcement) => (
              <article key={announcement.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-muted)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{announcement.title}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{announcement.message}</p>
                  </div>
                  {announcement.isPinned ? <span className="rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-200">Pinned</span> : null}
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span>{formatDate(announcement.createdAt)}</span>
                  <div className="inline-flex gap-2">
                    <button type="button" onClick={() => void togglePin(announcement)} className="underline decoration-dotted underline-offset-2">
                      {announcement.isPinned ? "Unpin" : "Pin"}
                    </button>
                    <button type="button" onClick={() => void deleteAnnouncement(announcement.id)} className="text-rose-300">
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Resource Moderation</h2>
          <div className="space-y-2">
            {resources.slice(0, 8).map((resource) => (
              <div key={resource.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{resource.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{resource.subject} · {resource.uploadedBy.name} · {resource.downloads} downloads</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeResource(resource.id)}
                  className="rounded-lg border border-rose-400/40 px-2 py-1 text-xs font-medium text-rose-300"
                  disabled={busyKey === `resource-${resource.id}`}
                >
                  {busyKey === `resource-${resource.id}` ? "..." : "Remove"}
                </button>
              </div>
            ))}
            {resources.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No resources available.</p> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Doubt Moderation</h2>
          <div className="space-y-2">
            {doubts.slice(0, 8).map((doubt) => (
              <div key={doubt.id} className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-muted)] px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-[var(--text-primary)]">{doubt.title}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{doubt.subject} · {doubt.author.name} · {doubt.answersCount} answers</p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeDoubt(doubt.id)}
                  className="rounded-lg border border-rose-400/40 px-2 py-1 text-xs font-medium text-rose-300"
                  disabled={busyKey === `doubt-${doubt.id}`}
                >
                  {busyKey === `doubt-${doubt.id}` ? "..." : "Remove"}
                </button>
              </div>
            ))}
            {doubts.length === 0 ? <p className="text-xs text-[var(--text-secondary)]">No doubts available.</p> : null}
          </div>
        </section>
      </div>

      {loadState === "loading" ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          Loading admin insights...
        </div>
      ) : null}

      {loadState === "error" ? (
        <div className="rounded-xl border border-amber-300/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <span className="inline-flex items-center gap-2">
            <AlertCircle size={14} /> Could not load the latest admin data.
          </span>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.12em] text-[var(--text-secondary)]">{title}</p>
        <span className="text-[var(--text-secondary)]">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{value}</p>
    </article>
  );
}
