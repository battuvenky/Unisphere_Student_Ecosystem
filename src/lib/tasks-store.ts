import { randomUUID } from "crypto";
import path from "path";
import { loadStore, saveStore } from "@/lib/mongo-store";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type TaskRecord = {
  id: string;
  userId: string;
  title: string;
  description: string;
  course: string;
  deadline: string;
  status: TaskStatus;
  priority: TaskPriority;
  estimatedMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

type TasksStore = {
  tasks: TaskRecord[];
};

type TaskFilters = {
  query?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  deadline?: "overdue" | "today" | "week";
};

const dataDir = path.join(process.cwd(), "data");
const tasksFile = path.join(dataDir, "tasks.json");

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIsoDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function userHash(userId: string) {
  return userId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

async function readStore(): Promise<TasksStore> {
  return loadStore<TasksStore>({
    collectionName: "tasks",
    legacyFilePath: tasksFile,
    initialValue: { tasks: [] },
  });
}

async function writeStore(store: TasksStore) {
  await saveStore({
    collectionName: "tasks",
    legacyFilePath: tasksFile,
    value: store,
  });
}

async function ensureSeedDataForUser(userId: string): Promise<TasksStore> {
  const store = await readStore();

  const hasTasks = store.tasks.some((task) => task.userId === userId);
  if (hasTasks) {
    return store;
  }

  const hash = userHash(userId);
  const templates: Array<Omit<TaskRecord, "id" | "userId" | "createdAt" | "updatedAt" | "completedAt">> = [
    {
      title: "OS assignment report",
      description: "Complete process scheduling analysis and submit PDF report.",
      course: "Operating Systems",
      deadline: addDaysIsoDate(1),
      status: "in_progress",
      priority: "high",
      estimatedMinutes: 120,
    },
    {
      title: "Graph BFS practice set",
      description: "Solve 5 BFS/shortest path problems on platform sheet.",
      course: "DSA",
      deadline: addDaysIsoDate(3),
      status: "todo",
      priority: "medium",
      estimatedMinutes: 90,
    },
    {
      title: "DBMS normalization notes",
      description: "Revise 1NF/2NF/3NF and add concise summary notes.",
      course: "DBMS",
      deadline: addDaysIsoDate(5),
      status: "todo",
      priority: "low",
      estimatedMinutes: 60,
    },
    {
      title: "Mock interview reflection",
      description: "Document feedback from technical mock interview.",
      course: "Placement",
      deadline: addDaysIsoDate(-1),
      status: "done",
      priority: "medium",
      estimatedMinutes: 30,
    },
  ];

  for (let index = 0; index < templates.length; index += 1) {
    const template = templates[index];
    const created = new Date(Date.now() - (index + 1) * 86_400_000).toISOString();
    const shouldComplete = template.status === "done";

    store.tasks.push({
      id: randomUUID(),
      userId,
      title: template.title,
      description: template.description,
      course: template.course,
      deadline: template.deadline,
      status: template.status,
      priority: template.priority,
      estimatedMinutes: template.estimatedMinutes + (hash % 20),
      createdAt: created,
      updatedAt: created,
      completedAt: shouldComplete ? new Date(Date.now() - 18_000_000).toISOString() : null,
    });
  }

  await writeStore(store);
  return store;
}

function normalizeQuery(value?: string) {
  return (value ?? "").trim().toLowerCase();
}

function daysDifferenceFromToday(deadline: string) {
  const today = todayIsoDate();
  const deadlineMs = Date.parse(deadline);
  const todayMs = Date.parse(today);
  return Math.floor((deadlineMs - todayMs) / 86_400_000);
}

function matchesDeadlineFilter(task: TaskRecord, deadline?: TaskFilters["deadline"]) {
  if (!deadline) {
    return true;
  }

  const diff = daysDifferenceFromToday(task.deadline);

  if (deadline === "overdue") {
    return diff < 0 && task.status !== "done";
  }

  if (deadline === "today") {
    return diff === 0;
  }

  return diff >= 0 && diff <= 7;
}

export async function listTasks(userId: string, filters?: TaskFilters) {
  const store = await ensureSeedDataForUser(userId);
  const query = normalizeQuery(filters?.query);

  const tasks = store.tasks
    .filter((task) => task.userId === userId)
    .filter((task) => {
      const queryMatch =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.course.toLowerCase().includes(query);
      const statusMatch = !filters?.status || task.status === filters.status;
      const priorityMatch = !filters?.priority || task.priority === filters.priority;
      const deadlineMatch = matchesDeadlineFilter(task, filters?.deadline);
      return queryMatch && statusMatch && priorityMatch && deadlineMatch;
    })
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") {
        return 1;
      }
      if (a.status !== "done" && b.status === "done") {
        return -1;
      }
      return Date.parse(a.deadline) - Date.parse(b.deadline);
    });

  const userTasks = store.tasks.filter((task) => task.userId === userId);
  const statusCounts = {
    todo: userTasks.filter((task) => task.status === "todo").length,
    in_progress: userTasks.filter((task) => task.status === "in_progress").length,
    done: userTasks.filter((task) => task.status === "done").length,
  };

  const total = userTasks.length;
  const completed = statusCounts.done;
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
  const overdue = userTasks.filter((task) => task.status !== "done" && daysDifferenceFromToday(task.deadline) < 0).length;
  const dueToday = userTasks.filter((task) => task.status !== "done" && daysDifferenceFromToday(task.deadline) === 0).length;
  const plannedMinutes = userTasks.filter((task) => task.status !== "done").reduce((sum, task) => sum + task.estimatedMinutes, 0);

  const sevenDays = Array.from({ length: 7 }).map((_, offset) => {
    const date = addDaysIsoDate(offset - 6);
    const doneCount = userTasks.filter((task) => task.completedAt?.slice(0, 10) === date).length;
    return {
      date,
      label: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
      done: doneCount,
    };
  });

  return {
    tasks,
    dashboard: {
      total,
      completed,
      completionRate,
      overdue,
      dueToday,
      plannedMinutes,
      statusCounts,
      weeklyCompletion: sevenDays,
    },
    filterOptions: {
      statuses: ["todo", "in_progress", "done"] as TaskStatus[],
      priorities: ["low", "medium", "high"] as TaskPriority[],
      deadlines: ["overdue", "today", "week"] as Array<"overdue" | "today" | "week">,
    },
  };
}

export async function createTask(input: {
  userId: string;
  title: string;
  description?: string;
  course?: string;
  deadline?: string;
  priority?: TaskPriority;
  estimatedMinutes?: number;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const now = nowIso();
  const task: TaskRecord = {
    id: randomUUID(),
    userId: input.userId,
    title: input.title.trim(),
    description: (input.description ?? "").trim(),
    course: (input.course ?? "General").trim() || "General",
    deadline: input.deadline ?? addDaysIsoDate(2),
    status: "todo",
    priority: input.priority ?? "medium",
    estimatedMinutes: Math.max(10, input.estimatedMinutes ?? 45),
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };

  store.tasks.push(task);
  await writeStore(store);

  return task;
}

export async function updateTask(input: {
  userId: string;
  taskId: string;
  patch: Partial<Pick<TaskRecord, "title" | "description" | "course" | "deadline" | "priority" | "status" | "estimatedMinutes">>;
  markCompleted?: boolean;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const task = store.tasks.find((item) => item.userId === input.userId && item.id === input.taskId);
  if (!task) {
    return null;
  }

  if (typeof input.patch.title === "string") {
    task.title = input.patch.title.trim() || task.title;
  }

  if (typeof input.patch.description === "string") {
    task.description = input.patch.description.trim();
  }

  if (typeof input.patch.course === "string") {
    task.course = input.patch.course.trim() || task.course;
  }

  if (typeof input.patch.deadline === "string") {
    task.deadline = input.patch.deadline;
  }

  if (typeof input.patch.priority === "string") {
    task.priority = input.patch.priority;
  }

  if (typeof input.patch.estimatedMinutes === "number" && Number.isFinite(input.patch.estimatedMinutes)) {
    task.estimatedMinutes = Math.max(10, Math.round(input.patch.estimatedMinutes));
  }

  if (typeof input.patch.status === "string") {
    task.status = input.patch.status;
  }

  if (typeof input.markCompleted === "boolean") {
    task.status = input.markCompleted ? "done" : "todo";
    task.completedAt = input.markCompleted ? nowIso() : null;
  } else if (task.status === "done" && !task.completedAt) {
    task.completedAt = nowIso();
  } else if (task.status !== "done") {
    task.completedAt = null;
  }

  task.updatedAt = nowIso();
  await writeStore(store);
  return task;
}
