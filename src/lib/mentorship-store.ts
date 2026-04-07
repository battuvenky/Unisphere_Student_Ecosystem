import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { findUserById, listUsers } from "@/lib/users-store";

export type MentorshipRequestStatus = "pending" | "accepted" | "declined" | "completed" | "cancelled";

export type MentorshipRequestRecord = {
  id: string;
  requesterId: string;
  mentorId: string;
  topic: string;
  message: string;
  preferredDate: string;
  durationMinutes: number;
  status: MentorshipRequestStatus;
  createdAt: string;
  updatedAt: string;
};

type MentorshipStore = {
  requests: MentorshipRequestRecord[];
};

export type MentorCard = {
  id: string;
  fullName: string;
  department: string;
  year: string;
  headline: string;
  skills: string[];
  achievements: string[];
  matchScore: number;
};

export type MentorshipRequestView = {
  id: string;
  topic: string;
  message: string;
  preferredDate: string;
  durationMinutes: number;
  status: MentorshipRequestStatus;
  createdAt: string;
  role: "incoming" | "outgoing";
  partner: {
    id: string;
    fullName: string;
    department: string;
    year: string;
  };
};

const dataDir = path.join(process.cwd(), "data");
const mentorshipFile = path.join(dataDir, "mentorship.json");

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(mentorshipFile, "utf8");
  } catch {
    const initial: MentorshipStore = { requests: [] };
    await writeFile(mentorshipFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStoreFile();
  const raw = await readFile(mentorshipFile, "utf8");
  return JSON.parse(raw) as MentorshipStore;
}

async function writeStore(store: MentorshipStore) {
  await writeFile(mentorshipFile, JSON.stringify(store, null, 2), "utf8");
}

function parseYearLevel(yearText: string) {
  const match = yearText.match(/\d+/);
  if (!match) {
    return 0;
  }

  const value = Number.parseInt(match[0], 10);
  return Number.isFinite(value) ? value : 0;
}

function scoreMatch(input: { currentDepartment: string; currentYear: string; mentorDepartment: string; mentorYear: string; }) {
  const currentLevel = parseYearLevel(input.currentYear);
  const mentorLevel = parseYearLevel(input.mentorYear);

  let score = 45;

  if (input.currentDepartment.toLowerCase() === input.mentorDepartment.toLowerCase()) {
    score += 25;
  }

  if (mentorLevel > currentLevel && currentLevel > 0) {
    const diff = mentorLevel - currentLevel;
    if (diff === 1) {
      score += 25;
    } else if (diff === 2) {
      score += 18;
    } else {
      score += 10;
    }
  }

  if (mentorLevel === 0 || currentLevel === 0) {
    score -= 6;
  }

  return Math.max(35, Math.min(98, score));
}

export async function listMentorCardsForUser(userId: string): Promise<MentorCard[]> {
  const users = await listUsers();
  const current = users.find((user) => user.id === userId);

  if (!current) {
    return [];
  }

  const currentLevel = parseYearLevel(current.profile.year);

  const candidates = users.filter((user) => {
    if (user.id === userId) {
      return false;
    }

    if (user.role === "admin") {
      return true;
    }

    const candidateLevel = parseYearLevel(user.profile.year);

    if (currentLevel === 0 || candidateLevel === 0) {
      return true;
    }

    return candidateLevel > currentLevel;
  });

  return candidates
    .map((candidate) => ({
      id: candidate.id,
      fullName: candidate.profile.fullName,
      department: candidate.profile.department,
      year: candidate.profile.year,
      headline: candidate.profile.headline ?? "Happy to mentor and guide juniors.",
      skills: (candidate.profile.skills ?? []).slice(0, 4).map((skill) => skill.name),
      achievements: (candidate.profile.achievements ?? []).slice(0, 2).map((item) => item.title),
      matchScore: scoreMatch({
        currentDepartment: current.profile.department,
        currentYear: current.profile.year,
        mentorDepartment: candidate.profile.department,
        mentorYear: candidate.profile.year,
      }),
    }))
    .sort((a, b) => b.matchScore - a.matchScore);
}

export async function listMentorshipRequestsForUser(userId: string): Promise<MentorshipRequestView[]> {
  const store = await readStore();
  const users = await listUsers();

  const related = store.requests.filter((request) => request.requesterId === userId || request.mentorId === userId);

  return related
    .map((request) => {
      const isIncoming = request.mentorId === userId;
      const partnerId = isIncoming ? request.requesterId : request.mentorId;
      const partner = users.find((user) => user.id === partnerId);

      if (!partner) {
        return null;
      }

      return {
        id: request.id,
        topic: request.topic,
        message: request.message,
        preferredDate: request.preferredDate,
        durationMinutes: request.durationMinutes,
        status: request.status,
        createdAt: request.createdAt,
        role: isIncoming ? "incoming" : "outgoing",
        partner: {
          id: partner.id,
          fullName: partner.profile.fullName,
          department: partner.profile.department,
          year: partner.profile.year,
        },
      } as MentorshipRequestView;
    })
    .filter((item): item is MentorshipRequestView => item !== null)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

export async function createMentorshipRequest(input: {
  requesterId: string;
  mentorId: string;
  topic: string;
  message: string;
  preferredDate: string;
  durationMinutes: number;
}) {
  const requester = await findUserById(input.requesterId);
  const mentor = await findUserById(input.mentorId);

  if (!requester || !mentor) {
    throw new Error("Mentor or requester not found");
  }

  if (input.requesterId === input.mentorId) {
    throw new Error("You cannot request mentorship from yourself");
  }

  const store = await readStore();
  const now = new Date().toISOString();

  const existingPending = store.requests.some(
    (request) =>
      request.requesterId === input.requesterId &&
      request.mentorId === input.mentorId &&
      request.status === "pending"
  );

  if (existingPending) {
    throw new Error("You already have a pending request with this mentor");
  }

  const request: MentorshipRequestRecord = {
    id: randomUUID(),
    requesterId: input.requesterId,
    mentorId: input.mentorId,
    topic: input.topic.trim(),
    message: input.message.trim(),
    preferredDate: input.preferredDate,
    durationMinutes: input.durationMinutes,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  store.requests.push(request);
  await writeStore(store);
  return request;
}

const finalStatuses: MentorshipRequestStatus[] = ["declined", "completed", "cancelled"];

export async function updateMentorshipRequestStatus(input: {
  requestId: string;
  actorId: string;
  status: MentorshipRequestStatus;
}) {
  const store = await readStore();
  const request = store.requests.find((item) => item.id === input.requestId);

  if (!request) {
    throw new Error("Request not found");
  }

  const isMentor = request.mentorId === input.actorId;
  const isRequester = request.requesterId === input.actorId;

  if (!isMentor && !isRequester) {
    throw new Error("You cannot update this request");
  }

  if (finalStatuses.includes(request.status)) {
    throw new Error("This request is already closed");
  }

  if (isRequester && input.status !== "cancelled") {
    throw new Error("Requester can only cancel this request");
  }

  if (isMentor && !["accepted", "declined", "completed"].includes(input.status)) {
    throw new Error("Invalid status update");
  }

  request.status = input.status;
  request.updatedAt = new Date().toISOString();
  await writeStore(store);
  return request;
}