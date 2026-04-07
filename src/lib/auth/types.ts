export type UserRole = "student" | "admin";

export type UserSkill = {
  id: string;
  name: string;
  category: string;
  level: number;
};

export type UserAchievement = {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
};

export type UserProject = {
  id: string;
  title: string;
  summary: string;
  techStack: string[];
  link: string;
  status: "planned" | "active" | "completed";
};

export type UserProfile = {
  fullName: string;
  profileImageUrl?: string;
  department: string;
  year: string;
  experience?: string;
  specialization?: string;
  specializations?: string[];
  headline?: string;
  bio?: string;
  skills?: UserSkill[];
  achievements?: UserAchievement[];
  projects?: UserProject[];
};

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  isBlocked?: boolean;
  blockedAt?: string | null;
  profile: UserProfile;
  createdAt: string;
};

export type SessionUser = {
  id: string;
  email: string;
  role: UserRole;
  profile: UserProfile;
};

export type SessionPayload = {
  sub: string;
  email: string;
  role: UserRole;
};
