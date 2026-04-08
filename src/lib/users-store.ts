import { randomUUID } from "crypto";
import type { SessionUser, UserProfile, UserRecord, UserRole } from "@/lib/auth/types";
import { connectMongoose } from "@/lib/mongoose";
import { UserModel } from "@/lib/models/user";

const demoUsers: Array<{
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  year: string;
  skills: string[];
  profileImage: string;
  specialization: string;
  specializations: string[];
  headline: string;
  bio: string;
  experience: string;
  achievements: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  createdAtIso: string;
}> = [
  {
    id: "demo-student-a",
    name: "Ananya Sharma",
    email: "ananya.sharma@unisphere.edu",
    password: "$2b$12$4nlStIdqsOzkA.Lx/dhECeoERHqbyAY6wtWhmGztvQhj9TZKxhtCO",
    role: "student",
    department: "Computer Science",
    year: "3rd Year",
    skills: ["TypeScript", "Next.js", "Data Structures"],
    profileImage: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=400&q=80",
    specialization: "AI & Machine Learning",
    specializations: ["AI & Machine Learning"],
    headline: "Building full-stack projects and preparing for product interviews.",
    bio: "Focused on DSA, system design basics, and collaborative campus tech projects.",
    experience: "",
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
    createdAtIso: "2026-01-09T09:00:00.000Z",
  },
  {
    id: "demo-student-b",
    name: "Rahul Verma",
    email: "rahul.verma@unisphere.edu",
    password: "$2b$12$4nlStIdqsOzkA.Lx/dhECeoERHqbyAY6wtWhmGztvQhj9TZKxhtCO",
    role: "student",
    department: "Information Technology",
    year: "4th Year",
    skills: ["Node.js", "SQL", "Graph Algorithms"],
    profileImage: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80",
    specialization: "Cloud Computing",
    specializations: ["Cloud Computing"],
    headline: "Final-year student focused on backend systems and interview prep.",
    bio: "Enjoys solving graph problems and mentoring juniors for placements.",
    experience: "",
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
    createdAtIso: "2025-12-21T08:30:00.000Z",
  },
  {
    id: "demo-admin-1",
    name: "Dr. Kavya Menon",
    email: "admin@unisphere.edu",
    password: "$2b$12$WNRQqGiljVDznzF76FeEH.HYak929bJ.ijntGTc5gysKAM6ahY.2q",
    role: "admin",
    department: "Administration",
    year: "Staff",
    skills: ["Campus Operations", "Academic Analytics"],
    profileImage: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    specialization: "Student Success",
    specializations: ["Student Success"],
    headline: "Platform administrator and student success coordinator.",
    bio: "Oversees campus operations, mentorship programs, and analytics reporting.",
    experience: "12 years in student success and campus operations",
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
    createdAtIso: "2025-08-01T07:15:00.000Z",
  },
];

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

function toSkillObjects(skills: string[]) {
  return skills.map((skillName) => ({
    id: `skill-${skillName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    name: skillName,
    category: "General",
    level: 3,
  }));
}

function toStringArraySkills(profile: UserProfile) {
  if (!Array.isArray(profile.skills)) {
    return [];
  }

  return profile.skills
    .map((skill) => skill.name.trim())
    .filter(Boolean)
    .slice(0, 50);
}

type MongoUserShape = {
  appId: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
  department: string;
  year: string;
  skills: string[];
  profileImage: string;
  specialization: string;
  specializations: string[];
  experience: string;
  headline: string;
  bio: string;
  achievements: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  auth?: {
    lastLoginAt?: string | null;
    loginCount?: number;
    loginHistory?: Array<{
      at?: string;
      ip?: string;
      userAgent?: string;
      source?: string;
    }>;
  };
  isBlocked: boolean;
  blockedAt: string | null;
  createdAtIso: string;
};

function toUserRecord(source: MongoUserShape): UserRecord {
  const profile: UserProfile = {
    fullName: source.name,
    profileImageUrl: source.profileImage ?? "",
    department: source.department,
    year: source.year,
    specialization: source.specialization,
    specializations: source.specializations ?? [],
    experience: source.experience ?? "",
    headline: source.headline ?? "",
    bio: source.bio ?? "",
    skills: toSkillObjects(source.skills ?? []),
    achievements: source.achievements as UserProfile["achievements"],
    projects: source.projects as UserProfile["projects"],
  };

  return {
    id: source.appId,
    email: source.email,
    passwordHash: source.password,
    role: source.role,
    isBlocked: Boolean(source.isBlocked),
    blockedAt: source.isBlocked ? source.blockedAt ?? new Date().toISOString() : null,
    profile: normalizeProfile(profile),
    createdAt: source.createdAtIso,
  };
}

function mapFromDocument(document: Record<string, unknown>): UserRecord {
  return toUserRecord({
    appId: String(document.appId),
    name: String(document.name ?? ""),
    email: String(document.email ?? ""),
    password: String(document.password ?? ""),
    role: (document.role as UserRole) ?? "student",
    department: String(document.department ?? ""),
    year: String(document.year ?? ""),
    skills: Array.isArray(document.skills) ? document.skills.map((item) => String(item)) : [],
    profileImage: String(document.profileImage ?? ""),
    specialization: String(document.specialization ?? ""),
    specializations: Array.isArray(document.specializations)
      ? document.specializations.map((item) => String(item))
      : [],
    experience: String(document.experience ?? ""),
    headline: String(document.headline ?? ""),
    bio: String(document.bio ?? ""),
    achievements: Array.isArray(document.achievements)
      ? (document.achievements as Array<Record<string, unknown>>)
      : [],
    projects: Array.isArray(document.projects)
      ? (document.projects as Array<Record<string, unknown>>)
      : [],
    isBlocked: Boolean(document.isBlocked),
    blockedAt: typeof document.blockedAt === "string" ? document.blockedAt : null,
    createdAtIso: String(document.createdAtIso ?? new Date().toISOString()),
  });
}

async function ensureDemoUsersSeeded() {
  await connectMongoose();

  for (const demo of demoUsers) {
    await UserModel.updateOne(
      { appId: demo.id },
      {
        $setOnInsert: {
          appId: demo.id,
          name: demo.name,
          email: demo.email.toLowerCase(),
          password: demo.password,
          role: demo.role,
          department: demo.department,
          year: demo.year,
          skills: demo.skills,
          profileImage: demo.profileImage,
          specialization: demo.specialization,
          specializations: demo.specializations,
          experience: demo.experience,
          headline: demo.headline,
          bio: demo.bio,
          achievements: demo.achievements,
          projects: demo.projects,
          auth: {
            lastLoginAt: null,
            loginCount: 0,
            loginHistory: [],
          },
          isBlocked: false,
          blockedAt: null,
          createdAtIso: demo.createdAtIso,
        },
      },
      { upsert: true }
    );
  }
}

export function toSessionUser(user: UserRecord): SessionUser {
  const normalizedProfile = normalizeProfile(user.profile);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profile: normalizedProfile,
  };
}

export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  await ensureDemoUsersSeeded();

  const document = await UserModel.findOne({ email: email.toLowerCase().trim() }).lean<Record<string, unknown> | null>();
  if (!document) {
    return null;
  }

  return mapFromDocument(document);
}

export async function findUserById(id: string): Promise<UserRecord | null> {
  await ensureDemoUsersSeeded();

  const document = await UserModel.findOne({ appId: id }).lean<Record<string, unknown> | null>();
  if (!document) {
    return null;
  }

  return mapFromDocument(document);
}

export async function listUsers(): Promise<UserRecord[]> {
  await ensureDemoUsersSeeded();

  const documents = await UserModel.find({}).lean<Array<Record<string, unknown>>>();
  return documents.map(mapFromDocument);
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: UserRole;
  profile: UserProfile;
}): Promise<UserRecord> {
  await ensureDemoUsersSeeded();

  const normalizedEmail = input.email.trim().toLowerCase();
  const exists = await UserModel.findOne({ email: normalizedEmail }).lean();
  if (exists) {
    throw new Error("Email already exists");
  }

  const profile = normalizeProfile(input.profile);
  const createdAt = new Date().toISOString();
  const appId = randomUUID();

  await UserModel.create({
    appId,
    name: profile.fullName,
    email: normalizedEmail,
    password: input.passwordHash,
    role: input.role,
    department: profile.department,
    year: profile.year,
    skills: toStringArraySkills(profile),
    profileImage: profile.profileImageUrl ?? "",
    specialization: profile.specialization ?? "",
    specializations: profile.specializations ?? [],
    experience: profile.experience ?? "",
    headline: profile.headline ?? "",
    bio: profile.bio ?? "",
    achievements: profile.achievements ?? [],
    projects: profile.projects ?? [],
    auth: {
      lastLoginAt: null,
      loginCount: 0,
      loginHistory: [],
    },
    isBlocked: false,
    blockedAt: null,
    createdAtIso: createdAt,
  });

  const created = await UserModel.findOne({ appId }).lean<Record<string, unknown> | null>();
  if (!created) {
    throw new Error("Could not create user");
  }

  return mapFromDocument(created);
}

export async function recordUserLogin(input: {
  userId: string;
  ip?: string;
  userAgent?: string;
  source: "login" | "signup";
}) {
  await ensureDemoUsersSeeded();

  const at = new Date().toISOString();
  const nextEntry = {
    at,
    ip: input.ip?.trim() ?? "",
    userAgent: input.userAgent?.trim() ?? "",
    source: input.source,
  };

  const existing = await UserModel.findOne({ appId: input.userId })
    .select({ auth: 1 })
    .lean<{ auth?: { loginHistory?: Array<typeof nextEntry> } } | null>();

  if (!existing) {
    throw new Error("User not found");
  }

  const previousHistory = Array.isArray(existing.auth?.loginHistory) ? existing.auth.loginHistory : [];
  const nextHistory = [nextEntry, ...previousHistory].slice(0, 25);

  await UserModel.updateOne(
    { appId: input.userId },
    {
      $set: {
        "auth.lastLoginAt": at,
        "auth.loginHistory": nextHistory,
      },
      $inc: {
        "auth.loginCount": 1,
      },
    }
  );
}

export async function updateUserProfile(userId: string, patch: Partial<UserProfile>): Promise<UserRecord> {
  await ensureDemoUsersSeeded();

  const existing = await UserModel.findOne({ appId: userId }).lean<Record<string, unknown> | null>();
  if (!existing) {
    throw new Error("User not found");
  }

  const mergedProfile = normalizeProfile({
    fullName: String(existing.name ?? ""),
    profileImageUrl: String(existing.profileImage ?? ""),
    department: String(existing.department ?? ""),
    year: String(existing.year ?? ""),
    specialization: String(existing.specialization ?? ""),
    specializations: Array.isArray(existing.specializations)
      ? existing.specializations.map((item) => String(item))
      : [],
    experience: String(existing.experience ?? ""),
    headline: String(existing.headline ?? ""),
    bio: String(existing.bio ?? ""),
    skills: toSkillObjects(Array.isArray(existing.skills) ? existing.skills.map((item) => String(item)) : []),
    achievements: Array.isArray(existing.achievements)
      ? (existing.achievements as UserProfile["achievements"])
      : [],
    projects: Array.isArray(existing.projects) ? (existing.projects as UserProfile["projects"]) : [],
    ...patch,
  });

  await UserModel.updateOne(
    { appId: userId },
    {
      $set: {
        name: mergedProfile.fullName,
        department: mergedProfile.department,
        year: mergedProfile.year,
        skills: toStringArraySkills(mergedProfile),
        profileImage: mergedProfile.profileImageUrl ?? "",
        specialization: mergedProfile.specialization ?? "",
        specializations: mergedProfile.specializations ?? [],
        experience: mergedProfile.experience ?? "",
        headline: mergedProfile.headline ?? "",
        bio: mergedProfile.bio ?? "",
        achievements: mergedProfile.achievements ?? [],
        projects: mergedProfile.projects ?? [],
      },
    }
  );

  const updated = await UserModel.findOne({ appId: userId }).lean<Record<string, unknown> | null>();
  if (!updated) {
    throw new Error("User not found");
  }

  return mapFromDocument(updated);
}

export async function setUserBlockedState(userId: string, isBlocked: boolean): Promise<UserRecord> {
  await ensureDemoUsersSeeded();

  await UserModel.updateOne(
    { appId: userId },
    {
      $set: {
        isBlocked,
        blockedAt: isBlocked ? new Date().toISOString() : null,
      },
    }
  );

  const updated = await UserModel.findOne({ appId: userId }).lean<Record<string, unknown> | null>();
  if (!updated) {
    throw new Error("User not found");
  }

  return mapFromDocument(updated);
}

export async function deleteUserById(userId: string): Promise<boolean> {
  await ensureDemoUsersSeeded();

  const result = await UserModel.deleteOne({ appId: userId });
  return Boolean(result.deletedCount);
}
