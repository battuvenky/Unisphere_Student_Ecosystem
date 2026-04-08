import { randomUUID } from "crypto";
import path from "path";
import { listTasks } from "@/lib/tasks-store";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type NotificationType = "task" | "exam" | "event" | "friend" | "message" | "comment" | "reply";
export type NotificationPriority = "low" | "medium" | "high";

export type NotificationRecord = {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  priority: NotificationPriority;
  isRead: boolean;
  sourceKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type NotificationsStore = {
  notifications: NotificationRecord[];
};

type ListOptions = {
  onlyUnread?: boolean;
  type?: NotificationType;
  limit?: number;
};

const dataDir = path.join(process.cwd(), "data");
const notificationsFile = path.join(dataDir, "notifications.json");
const READ_RETENTION_DAYS = 14;
const MAX_NOTIFICATIONS_PER_USER = 400;

function nowIso() {
  return new Date().toISOString();
}

function hoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

function daysUntil(deadlineIsoDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  const diffMs = Date.parse(deadlineIsoDate) - Date.parse(today);
  return Math.floor(diffMs / 86_400_000);
}

async function readStore(): Promise<NotificationsStore> {
  return loadStore<NotificationsStore>({
    collectionName: "notifications",
    legacyFilePath: notificationsFile,
    initialValue: { notifications: [] },
  });
}

async function writeStore(store: NotificationsStore) {
  await saveStore({
    collectionName: "notifications",
    legacyFilePath: notificationsFile,
    value: store,
  });
}

function userHash(userId: string) {
  return userId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

async function ensureSeedDataForUser(userId: string) {
  const store = await readStore();
  const existing = store.notifications.some((item) => item.userId === userId);

  if (existing) {
    return store;
  }

  const hash = userHash(userId);
  const starter: Array<Omit<NotificationRecord, "id" | "userId" | "createdAt" | "updatedAt">> = [
    {
      type: "exam",
      title: "Upcoming Mid-Semester Exam",
      message: "DBMS mid-sem is this Friday. Revise joins and normalization.",
      link: "/dashboard",
      priority: "high",
      isRead: false,
      sourceKey: null,
    },
    {
      type: "event",
      title: "Campus Hiring Talk",
      message: "Placement orientation starts tomorrow at 10:00 AM in auditorium.",
      link: "/placement",
      priority: "medium",
      isRead: hash % 2 === 0,
      sourceKey: null,
    },
  ];

  for (let index = 0; index < starter.length; index += 1) {
    const item = starter[index];
    const created = hoursAgoIso((index + 1) * 6);

    store.notifications.push({
      id: randomUUID(),
      userId,
      type: item.type,
      title: item.title,
      message: item.message,
      link: item.link,
      priority: item.priority,
      isRead: item.isRead,
      sourceKey: item.sourceKey,
      createdAt: created,
      updatedAt: created,
    });
  }

  await writeStore(store);
  return store;
}

async function syncTaskAlerts(userId: string, store: NotificationsStore) {
  const tasksData = await listTasks(userId);
  const activeTaskAlerts = new Set<string>();

  for (const task of tasksData.tasks) {
    if (task.status === "done") {
      continue;
    }

    const diff = daysUntil(task.deadline);
    if (diff > 2 || diff < 0) {
      continue;
    }

    const sourceKey = `task:${task.id}`;
    activeTaskAlerts.add(sourceKey);

    const existing = store.notifications.find(
      (item) => item.userId === userId && item.sourceKey === sourceKey
    );

    const title = diff === 0 ? `Deadline today: ${task.title}` : `Upcoming deadline: ${task.title}`;
    const message =
      diff === 0
        ? `${task.course} task is due today.`
        : `${task.course} task is due in ${diff} day${diff === 1 ? "" : "s"}.`;

    if (existing) {
      existing.title = title;
      existing.message = message;
      existing.priority = diff === 0 ? "high" : "medium";
      existing.link = "/tasks";
      existing.updatedAt = nowIso();
      continue;
    }

    const created = nowIso();
    store.notifications.push({
      id: randomUUID(),
      userId,
      type: "task",
      title,
      message,
      link: "/tasks",
      priority: diff === 0 ? "high" : "medium",
      isRead: false,
      sourceKey,
      createdAt: created,
      updatedAt: created,
    });
  }

  store.notifications = store.notifications.filter((item) => {
    if (item.userId !== userId) {
      return true;
    }

    if (!item.sourceKey || !item.sourceKey.startsWith("task:")) {
      return true;
    }

    return activeTaskAlerts.has(item.sourceKey);
  });

  await writeStore(store);
  return store;
}

async function cleanupNotifications(userId: string, store: NotificationsStore) {
  const cutoff = Date.now() - READ_RETENTION_DAYS * 86_400_000;

  store.notifications = store.notifications.filter((item) => {
    if (item.userId !== userId) {
      return true;
    }

    if (!item.isRead) {
      return true;
    }

    return Date.parse(item.updatedAt || item.createdAt) >= cutoff;
  });

  const perUser = store.notifications
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  if (perUser.length > MAX_NOTIFICATIONS_PER_USER) {
    const keepIds = new Set(perUser.slice(0, MAX_NOTIFICATIONS_PER_USER).map((item) => item.id));
    store.notifications = store.notifications.filter((item) => item.userId !== userId || keepIds.has(item.id));
  }

  await writeStore(store);
  return store;
}

export async function listNotifications(userId: string, options?: ListOptions) {
  let store = await ensureSeedDataForUser(userId);
  store = await syncTaskAlerts(userId, store);
  store = await cleanupNotifications(userId, store);

  const notifications = store.notifications
    .filter((item) => item.userId === userId)
    .filter((item) => (options?.onlyUnread ? !item.isRead : true))
    .filter((item) => (options?.type ? item.type === options.type : true))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));

  const limited = typeof options?.limit === "number" ? notifications.slice(0, options.limit) : notifications;

  const unreadCount = store.notifications.filter((item) => item.userId === userId && !item.isRead).length;

  return {
    notifications: limited,
    unreadCount,
    total: store.notifications.filter((item) => item.userId === userId).length,
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
  priority?: NotificationPriority;
}) {
  let store = await ensureSeedDataForUser(input.userId);
  const created = nowIso();

  const notification: NotificationRecord = {
    id: randomUUID(),
    userId: input.userId,
    type: input.type,
    title: input.title.trim(),
    message: input.message.trim(),
    link: input.link?.trim() || "/dashboard",
    priority: input.priority ?? "medium",
    isRead: false,
    sourceKey: null,
    createdAt: created,
    updatedAt: created,
  };

  store.notifications.push(notification);
  store = await cleanupNotifications(input.userId, store);
  await writeStore(store);

  return notification;
}

export async function updateNotificationReadState(input: {
  userId: string;
  notificationId: string;
  isRead: boolean;
}) {
  const store = await ensureSeedDataForUser(input.userId);
  const target = store.notifications.find(
    (item) => item.userId === input.userId && item.id === input.notificationId
  );

  if (!target) {
    return null;
  }

  target.isRead = input.isRead;
  target.updatedAt = nowIso();
  await writeStore(store);

  return target;
}

export async function markAllNotificationsRead(userId: string) {
  const store = await ensureSeedDataForUser(userId);
  const timestamp = nowIso();

  for (const item of store.notifications) {
    if (item.userId === userId && !item.isRead) {
      item.isRead = true;
      item.updatedAt = timestamp;
    }
  }

  await writeStore(store);

  return {
    unreadCount: 0,
  };
}

export async function deleteNotification(input: { userId: string; notificationId: string }) {
  const store = await ensureSeedDataForUser(input.userId);
  const initialLength = store.notifications.length;

  store.notifications = store.notifications.filter(
    (item) => !(item.userId === input.userId && item.id === input.notificationId)
  );

  if (store.notifications.length === initialLength) {
    return null;
  }

  await writeStore(store);

  return {
    success: true,
  };
}

export async function clearReadNotifications(userId: string) {
  const store = await ensureSeedDataForUser(userId);
  const before = store.notifications.length;

  store.notifications = store.notifications.filter((item) => !(item.userId === userId && item.isRead));
  const removed = before - store.notifications.length;

  await writeStore(store);

  return {
    removed,
  };
}

export async function clearAllNotifications(userId: string) {
  const store = await ensureSeedDataForUser(userId);
  const before = store.notifications.length;

  store.notifications = store.notifications.filter((item) => item.userId !== userId);
  const removed = before - store.notifications.length;

  await writeStore(store);

  return {
    removed,
  };
}
