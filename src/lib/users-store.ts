import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { SessionUser, UserProfile, UserRecord, UserRole } from "@/lib/auth/types";

type UsersStore = {
  users: UserRecord[];
};

function normalizeUserRecord(user: UserRecord): UserRecord {
  return {
    ...user,
    isBlocked: Boolean(user.isBlocked),
    blockedAt: user.isBlocked ? user.blockedAt ?? new Date().toISOString() : null,
    profile: normalizeProfile(user.profile),
  };
}

const demoUsers: UserRecord[] = [
  {
    id: "demo-student-a",
    email: "ananya.sharma@unisphere.edu",
    passwordHash: "$2b$12$4nlStIdqsOzkA.Lx/dhECeoERHqbyAY6wtWhmGztvQhj9TZKxhtCO",
    role: "student",
    profile: {
      fullName: "Ananya Sharma",
      profileImageUrl: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
      department: "Computer Science",
      year: "3rd Year",
      specialization: "AI & Machine Learning",
      headline: "Building full-stack projects and preparing for product interviews.",
      bio: "Focused on DSA, system design basics, and collaborative campus tech projects.",
      skills: [
        { id: "skill-ts", name: "TypeScript", category: "Development", level: 4 },
        { id: "skill-next", name: "Next.js", category: "Development", level: 4 },
        { id: "skill-dsa", name: "Data Structures", category: "DSA", level: 3 },
      ],
      achievements: [
        {
          id: "ach-hackathon",
          title: "Top 10 - Smart India Campus Hack",
          issuer: "University Innovation Cell",
          date: "2026-02-14",
          description: "Built a hostel issue triage tool with a small team.",
        },
      ],
      projects: [
        {
          id: "proj-study-buddy",
          title: "Study Buddy Planner",
          summary: "A planner that recommends daily study blocks based on deadlines.",
          techStack: ["Next.js", "TypeScript", "Tailwind CSS"],
          link: "",
          status: "active",
        },
      ],
    },
    createdAt: "2026-01-09T09:00:00.000Z",
  },
  {
    id: "demo-student-b",
    email: "rahul.verma@unisphere.edu",
    passwordHash: "$2b$12$4nlStIdqsOzkA.Lx/dhECeoERHqbyAY6wtWhmGztvQhj9TZKxhtCO",
    role: "student",
    profile: {
      fullName: "Rahul Verma",
      profileImageUrl: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
      department: "Information Technology",
      year: "4th Year",
      specialization: "Cloud Computing",
      headline: "Final-year student focused on backend systems and interview prep.",
      bio: "Enjoys solving graph problems and mentoring juniors for placements.",
      skills: [
        { id: "skill-node", name: "Node.js", category: "Development", level: 4 },
        { id: "skill-sql", name: "SQL", category: "Database", level: 4 },
        { id: "skill-graphs", name: "Graph Algorithms", category: "DSA", level: 4 },
      ],
      achievements: [
        {
          id: "ach-campus-mentor",
          title: "Campus Mentorship Lead",
          issuer: "Training and Placement Cell",
          date: "2025-11-03",
          description: "Mentored 40+ juniors for coding rounds.",
        },
      ],
      projects: [
        {
          id: "proj-job-tracker",
          title: "Placement Pipeline Tracker",
          summary: "Tracks applications and interview stages for graduating students.",
          techStack: ["React", "Express", "PostgreSQL"],
          link: "",
          status: "completed",
        },
      ],
    },
    createdAt: "2025-12-21T08:30:00.000Z",
  },
  {
    id: "demo-admin-1",
    email: "admin@unisphere.edu",
    passwordHash: "$2b$12$WNRQqGiljVDznzF76FeEH.HYak929bJ.ijntGTc5gysKAM6ahY.2q",
    role: "admin",
    profile: {
      fullName: "Dr. Kavya Menon",
      profileImageUrl: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
      department: "Administration",
      year: "Staff",
      experience: "12 years in student success and campus operations",
      specialization: "Student Success",
      headline: "Platform administrator and student success coordinator.",
      bio: "Oversees campus operations, mentorship programs, and analytics reporting.",
      skills: [
        { id: "skill-ops", name: "Campus Operations", category: "Management", level: 5 },
        { id: "skill-analytics", name: "Academic Analytics", category: "Analytics", level: 4 },
      ],
      achievements: [
        {
          id: "ach-retention",
          title: "Improved Retention Metrics",
          issuer: "Academic Council",
          date: "2025-09-18",
          description: "Led cross-department initiative that improved first-year retention.",
        },
      ],
      projects: [
        {
          id: "proj-campus-dashboard",
          title: "Campus Performance Dashboard",
          summary: "Unified analytics dashboard for student engagement and outcomes.",
          techStack: ["Power BI", "SQL", "Python"],
          link: "",
          status: "active",
        },
      ],
    },
    createdAt: "2025-08-01T07:15:00.000Z",
  },
];

const dataDir = path.join(process.cwd(), "data");
const usersFile = path.join(dataDir, "users.json");

async function ensureStoreFile() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(usersFile, "utf8");
  } catch {
    const initial: UsersStore = { users: demoUsers };
    await writeFile(usersFile, JSON.stringify(initial, null, 2), "utf8");
  }
}

function mergeDemoUsers(store: UsersStore): { store: UsersStore; changed: boolean } {
  const existingIds = new Set(store.users.map((user) => user.id));
  const existingEmails = new Set(store.users.map((user) => user.email.toLowerCase()));
  let changed = false;

  for (const demoUser of demoUsers) {
    if (existingIds.has(demoUser.id) || existingEmails.has(demoUser.email.toLowerCase())) {
      continue;
    }

    store.users.push(demoUser);
    changed = true;
  }

  return { store, changed };
}

async function readStore(): Promise<UsersStore> {
  await ensureStoreFile();
  const raw = await readFile(usersFile, "utf8");
  const parsed = JSON.parse(raw) as UsersStore;
  parsed.users = parsed.users.map(normalizeUserRecord);
  const { store, changed } = mergeDemoUsers(parsed);

  if (changed) {
    await writeFile(usersFile, JSON.stringify(store, null, 2), "utf8");
  }

  return store;
}

async function writeStore(store: UsersStore) {
  await writeFile(usersFile, JSON.stringify(store, null, 2), "utf8");
}

function normalizeProfile(profile: UserProfile): UserProfile {
  const normalizedSpecializations = Array.isArray(profile.specializations)
    ? profile.specializations.filter(Boolean).map((item) => item.trim()).filter(Boolean)
    : (profile.specialization ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

  const specializationText =
    profile.specialization && profile.specialization.trim().length > 0
      ? profile.specialization.trim()
      : normalizedSpecializations.join(", ");

  return {
    fullName: profile.fullName,
    profileImageUrl: profile.profileImageUrl ?? "",
    department: profile.department,
    year: profile.year,
    experience: profile.experience ?? "",
    specialization: specializationText,
    specializations: normalizedSpecializations,
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    skills: profile.skills ?? [],
    achievements: profile.achievements ?? [],
    projects: profile.projects ?? [],
  };
}

export function toSessionUser(user: UserRecord): SessionUser {
  const normalizedUser = normalizeUserRecord(user);

  return {
    id: normalizedUser.id,
    email: normalizedUser.email,
    role: normalizedUser.role,
    profile: normalizeProfile(normalizedUser.profile),
  };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const store = await readStore();
  return store.users.find((user) => user.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  const store = await readStore();
  return store.users.find((user) => user.id === id) ?? null;
}

export async function listUsers(): Promise<UserRecord[]> {
  const store = await readStore();
  return store.users.map(normalizeUserRecord);
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: UserRole;
  profile: UserProfile;
}): Promise<UserRecord> {
  const store = await readStore();

  const exists = store.users.some((user) => user.email.toLowerCase() === input.email.toLowerCase());
  if (exists) {
    throw new Error("Email already exists");
  }

  const user: UserRecord = {
    id: randomUUID(),
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role,
    isBlocked: false,
    blockedAt: null,
    profile: normalizeProfile(input.profile),
    createdAt: new Date().toISOString(),
  };

  store.users.push(user);
  await writeStore(store);
  return user;
}

export async function updateUserProfile(userId: string, patch: Partial<UserProfile>): Promise<UserRecord> {
  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  user.profile = normalizeProfile({
    ...normalizeProfile(user.profile),
    ...patch,
  });
  await writeStore(store);
  return normalizeUserRecord(user);
}

export async function setUserBlockedState(userId: string, isBlocked: boolean): Promise<UserRecord> {
  const store = await readStore();
  const user = store.users.find((item) => item.id === userId);

  if (!user) {
    throw new Error("User not found");
  }

  user.isBlocked = isBlocked;
  user.blockedAt = isBlocked ? new Date().toISOString() : null;
  await writeStore(store);
  return normalizeUserRecord(user);
}

export async function deleteUserById(userId: string): Promise<boolean> {
  const store = await readStore();
  const nextUsers = store.users.filter((item) => item.id !== userId);

  if (nextUsers.length === store.users.length) {
    return false;
  }

  store.users = nextUsers;
  await writeStore(store);
  return true;
}
