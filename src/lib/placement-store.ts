import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";

export type ApplicationStatus = "applied" | "interview" | "rejected" | "offered";
export type PracticeDifficulty = "easy" | "medium" | "hard";

export type PracticeLogRecord = {
  id: string;
  userId: string;
  date: string;
  topic: string;
  problemsSolved: number;
  timeSpentMinutes: number;
  difficulty: PracticeDifficulty;
  notes: string;
  createdAt: string;
};

export type ApplicationRecord = {
  id: string;
  userId: string;
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedOn: string;
  location: string;
  link: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

type PlacementStore = {
  practiceLogs: PracticeLogRecord[];
  applications: ApplicationRecord[];
};

type PlacementFilters = {
  query?: string;
  status?: ApplicationStatus;
  company?: string;
};

const dataDir = path.join(process.cwd(), "data");
const placementFile = path.join(dataDir, "placement.json");

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function nowIso() {
  return new Date().toISOString();
}

function daysAgoIsoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function userHash(userId: string) {
  return userId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(placementFile, "utf8");
  } catch {
    const initial: PlacementStore = {
      practiceLogs: [],
      applications: [],
    };
    await writeFile(placementFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore(): Promise<PlacementStore> {
  await ensureStoreFile();
  const raw = await readFile(placementFile, "utf8");
  return JSON.parse(raw) as PlacementStore;
}

async function writeStore(store: PlacementStore) {
  await writeFile(placementFile, JSON.stringify(store, null, 2), "utf8");
}

async function ensureSeedDataForUser(userId: string): Promise<PlacementStore> {
  const store = await readStore();

  const hasPractice = store.practiceLogs.some((item) => item.userId === userId);
  const hasApplications = store.applications.some((item) => item.userId === userId);

  if (hasPractice && hasApplications) {
    return store;
  }

  const hash = userHash(userId);

  if (!hasPractice) {
    const topics = ["Arrays", "Dynamic Programming", "Graphs", "Trees", "Sliding Window"];

    for (let index = 0; index < 8; index += 1) {
      const solvedBase = 2 + ((hash + index * 5) % 6);
      const minutesBase = 35 + ((hash + index * 13) % 70);
      const difficulty: PracticeDifficulty = index % 3 === 0 ? "hard" : index % 2 === 0 ? "medium" : "easy";

      store.practiceLogs.push({
        id: randomUUID(),
        userId,
        date: daysAgoIsoDate(7 - index),
        topic: topics[index % topics.length],
        problemsSolved: solvedBase,
        timeSpentMinutes: minutesBase,
        difficulty,
        notes: "Focused practice session",
        createdAt: nowIso(),
      });
    }
  }

  if (!hasApplications) {
    const appTemplates: Array<Pick<ApplicationRecord, "company" | "role" | "status" | "location">> = [
      { company: "Google", role: "SDE Intern", status: "interview", location: "Remote" },
      { company: "Microsoft", role: "Software Engineer", status: "applied", location: "Hyderabad" },
      { company: "Amazon", role: "Support Engineer", status: "rejected", location: "Bengaluru" },
      { company: "Atlassian", role: "Graduate Engineer", status: "applied", location: "Remote" },
    ];

    for (let index = 0; index < appTemplates.length; index += 1) {
      const template = appTemplates[index];
      store.applications.push({
        id: randomUUID(),
        userId,
        company: template.company,
        role: template.role,
        status: template.status,
        appliedOn: daysAgoIsoDate(15 - index * 3),
        location: template.location,
        link: "",
        notes: "Auto-seeded starter application",
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }
  }

  await writeStore(store);
  return store;
}

export async function listPlacementData(userId: string, filters?: PlacementFilters) {
  const store = await ensureSeedDataForUser(userId);

  const query = (filters?.query ?? "").trim().toLowerCase();
  const normalizedCompany = (filters?.company ?? "").trim().toLowerCase();
  const status = filters?.status;

  const practiceLogs = store.practiceLogs
    .filter((item) => item.userId === userId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const applications = store.applications
    .filter((item) => item.userId === userId)
    .filter((item) => {
      const queryMatch =
        !query ||
        item.company.toLowerCase().includes(query) ||
        item.role.toLowerCase().includes(query) ||
        item.location.toLowerCase().includes(query);

      const companyMatch = !normalizedCompany || item.company.toLowerCase() === normalizedCompany;
      const statusMatch = !status || item.status === status;

      return queryMatch && companyMatch && statusMatch;
    })
    .sort((a, b) => Date.parse(b.appliedOn) - Date.parse(a.appliedOn));

  return {
    practiceLogs,
    applications,
    companies: Array.from(new Set(store.applications.filter((item) => item.userId === userId).map((item) => item.company))).sort((a, b) =>
      a.localeCompare(b)
    ),
  };
}

export async function createPracticeLog(input: {
  userId: string;
  topic: string;
  date?: string;
  problemsSolved: number;
  timeSpentMinutes: number;
  difficulty: PracticeDifficulty;
  notes?: string;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const record: PracticeLogRecord = {
    id: randomUUID(),
    userId: input.userId,
    date: input.date ?? todayIsoDate(),
    topic: input.topic.trim(),
    problemsSolved: input.problemsSolved,
    timeSpentMinutes: input.timeSpentMinutes,
    difficulty: input.difficulty,
    notes: (input.notes ?? "").trim(),
    createdAt: nowIso(),
  };

  store.practiceLogs.push(record);
  await writeStore(store);
  return record;
}

export async function createApplication(input: {
  userId: string;
  company: string;
  role: string;
  status?: ApplicationStatus;
  appliedOn?: string;
  location?: string;
  link?: string;
  notes?: string;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const application: ApplicationRecord = {
    id: randomUUID(),
    userId: input.userId,
    company: input.company.trim(),
    role: input.role.trim(),
    status: input.status ?? "applied",
    appliedOn: input.appliedOn ?? todayIsoDate(),
    location: (input.location ?? "").trim(),
    link: (input.link ?? "").trim(),
    notes: (input.notes ?? "").trim(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };

  store.applications.push(application);
  await writeStore(store);
  return application;
}

export async function updateApplicationStatus(input: {
  userId: string;
  applicationId: string;
  status: ApplicationStatus;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const application = store.applications.find((item) => item.userId === input.userId && item.id === input.applicationId);
  if (!application) {
    return null;
  }

  application.status = input.status;
  application.updatedAt = nowIso();
  await writeStore(store);
  return application;
}

export function buildPlacementDashboard(practiceLogs: PracticeLogRecord[], applications: ApplicationRecord[]) {
  const totalProblemsSolved = practiceLogs.reduce((sum, item) => sum + item.problemsSolved, 0);
  const totalPracticeMinutes = practiceLogs.reduce((sum, item) => sum + item.timeSpentMinutes, 0);
  const targetProblems = 300;
  const dsaProgress = Math.min(100, Math.round((totalProblemsSolved / targetProblems) * 100));

  const sevenDayBuckets: Record<string, number> = {};
  for (let offset = 6; offset >= 0; offset -= 1) {
    const key = daysAgoIsoDate(offset);
    sevenDayBuckets[key] = 0;
  }

  for (const record of practiceLogs) {
    if (record.date in sevenDayBuckets) {
      sevenDayBuckets[record.date] += record.problemsSolved;
    }
  }

  const weeklyChart = Object.entries(sevenDayBuckets).map(([date, solved]) => ({
    date,
    solved,
    label: new Date(date).toLocaleDateString(undefined, { weekday: "short" }),
  }));

  const statusCounts = {
    applied: applications.filter((item) => item.status === "applied").length,
    interview: applications.filter((item) => item.status === "interview").length,
    rejected: applications.filter((item) => item.status === "rejected").length,
    offered: applications.filter((item) => item.status === "offered").length,
  };

  return {
    targetProblems,
    totalProblemsSolved,
    dsaProgress,
    totalPracticeHours: Math.round((totalPracticeMinutes / 60) * 10) / 10,
    weeklySolved: weeklyChart.reduce((sum, item) => sum + item.solved, 0),
    activeApplications: statusCounts.applied + statusCounts.interview,
    statusCounts,
    weeklyChart,
  };
}
