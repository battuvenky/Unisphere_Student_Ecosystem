import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { listPlacementData } from "@/lib/placement-store";

export type StudySession = {
  id: string;
  userId: string;
  date: string;
  subject: string;
  minutes: number;
  dsaProblemsSolved: number;
  focusScore: number;
  notes: string;
  createdAt: string;
};

type AnalyticsStore = {
  sessions: StudySession[];
};

const dataDir = path.join(process.cwd(), "data");
const analyticsFile = path.join(dataDir, "analytics.json");

function nowIso() {
  return new Date().toISOString();
}

function daysAgoIsoDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

function monthLabel(dateIso: string) {
  return new Date(dateIso).toLocaleDateString(undefined, {
    month: "short",
    year: "2-digit",
  });
}

function weekdayLabel(dateIso: string) {
  return new Date(dateIso).toLocaleDateString(undefined, {
    weekday: "short",
  });
}

function userHash(userId: string) {
  return userId.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(analyticsFile, "utf8");
  } catch {
    const initial: AnalyticsStore = { sessions: [] };
    await writeFile(analyticsFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(analyticsFile, "utf8");
  return JSON.parse(raw) as AnalyticsStore;
}

async function writeStore(store: AnalyticsStore) {
  await writeFile(analyticsFile, JSON.stringify(store, null, 2), "utf8");
}

async function ensureSeedDataForUser(userId: string) {
  const store = await readStore();
  const hasSessions = store.sessions.some((session) => session.userId === userId);

  if (hasSessions) {
    return store;
  }

  const subjects = ["DSA", "DBMS", "OS", "CN", "System Design"];
  const hash = userHash(userId);

  for (let index = 0; index < 18; index += 1) {
    const minutes = 40 + ((hash + index * 9) % 100);
    const problems = index % 2 === 0 ? 1 + ((hash + index) % 4) : 0;
    const focusScore = 65 + ((hash + index * 3) % 31);

    store.sessions.push({
      id: randomUUID(),
      userId,
      date: daysAgoIsoDate(20 - index),
      subject: subjects[index % subjects.length],
      minutes,
      dsaProblemsSolved: problems,
      focusScore,
      notes: "Focused study block",
      createdAt: nowIso(),
    });
  }

  await writeStore(store);
  return store;
}

export async function createStudySession(input: {
  userId: string;
  date?: string;
  subject: string;
  minutes: number;
  dsaProblemsSolved?: number;
  focusScore?: number;
  notes?: string;
}) {
  const store = await ensureSeedDataForUser(input.userId);

  const session: StudySession = {
    id: randomUUID(),
    userId: input.userId,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    subject: input.subject.trim(),
    minutes: Math.max(10, Math.round(input.minutes)),
    dsaProblemsSolved: Math.max(0, Math.round(input.dsaProblemsSolved ?? 0)),
    focusScore: Math.min(100, Math.max(1, Math.round(input.focusScore ?? 75))),
    notes: (input.notes ?? "").trim(),
    createdAt: nowIso(),
  };

  store.sessions.push(session);
  await writeStore(store);

  return session;
}

export async function listAnalytics(userId: string) {
  const store = await ensureSeedDataForUser(userId);
  const sessions = store.sessions
    .filter((session) => session.userId === userId)
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const { practiceLogs } = await listPlacementData(userId);

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - 6);
  startOfWeek.setHours(0, 0, 0, 0);

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfMonthMs = startOfMonth.getTime();
  const startOfWeekMs = startOfWeek.getTime();

  const weeklySessions = sessions.filter((session) => Date.parse(session.date) >= startOfWeekMs);
  const monthlySessions = sessions.filter((session) => Date.parse(session.date) >= startOfMonthMs);

  const weeklyMinutes = weeklySessions.reduce((sum, session) => sum + session.minutes, 0);
  const monthlyMinutes = monthlySessions.reduce((sum, session) => sum + session.minutes, 0);

  const weeklyProblems = weeklySessions.reduce((sum, session) => sum + session.dsaProblemsSolved, 0);
  const monthlyProblems = monthlySessions.reduce((sum, session) => sum + session.dsaProblemsSolved, 0);

  const weeklyFocus =
    weeklySessions.length > 0
      ? Math.round(weeklySessions.reduce((sum, session) => sum + session.focusScore, 0) / weeklySessions.length)
      : 0;

  const weeklyStudyChart = Array.from({ length: 7 }).map((_, index) => {
    const date = daysAgoIsoDate(6 - index);
    const daySessions = sessions.filter((session) => session.date === date);
    return {
      date,
      label: weekdayLabel(date),
      minutes: daySessions.reduce((sum, session) => sum + session.minutes, 0),
      problems: daySessions.reduce((sum, session) => sum + session.dsaProblemsSolved, 0),
    };
  });

  const monthlyStudyChart = Array.from({ length: 6 }).map((_, index) => {
    const date = new Date();
    date.setMonth(date.getMonth() - (5 - index));
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const points = sessions.filter((session) => session.date.startsWith(monthKey));

    return {
      key: monthKey,
      label: monthLabel(`${monthKey}-01`),
      hours: Math.round((points.reduce((sum, session) => sum + session.minutes, 0) / 60) * 10) / 10,
      problems: points.reduce((sum, session) => sum + session.dsaProblemsSolved, 0),
    };
  });

  const subjectMap = new Map<string, number>();
  for (const session of sessions) {
    subjectMap.set(session.subject, (subjectMap.get(session.subject) ?? 0) + session.minutes);
  }

  const subjectBreakdown = Array.from(subjectMap.entries())
    .map(([subject, minutes]) => ({
      subject,
      hours: Math.round((minutes / 60) * 10) / 10,
    }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);

  const difficultyCounts = {
    easy: practiceLogs.filter((log) => log.difficulty === "easy").reduce((sum, log) => sum + log.problemsSolved, 0),
    medium: practiceLogs.filter((log) => log.difficulty === "medium").reduce((sum, log) => sum + log.problemsSolved, 0),
    hard: practiceLogs.filter((log) => log.difficulty === "hard").reduce((sum, log) => sum + log.problemsSolved, 0),
  };

  return {
    dashboard: {
      weeklyMinutes,
      monthlyMinutes,
      weeklyHours: Math.round((weeklyMinutes / 60) * 10) / 10,
      monthlyHours: Math.round((monthlyMinutes / 60) * 10) / 10,
      weeklyProblems,
      monthlyProblems,
      weeklyFocus,
      sessionsThisWeek: weeklySessions.length,
    },
    reports: {
      weeklyStudyChart,
      monthlyStudyChart,
      subjectBreakdown,
      dsaDifficulty: [
        { level: "Easy", solved: difficultyCounts.easy },
        { level: "Medium", solved: difficultyCounts.medium },
        { level: "Hard", solved: difficultyCounts.hard },
      ],
      latestSessions: sessions.slice(0, 10),
    },
  };
}
