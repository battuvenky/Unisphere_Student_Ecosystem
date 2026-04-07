import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { findUserById, toSessionUser, updateUserProfile } from "@/lib/users-store";

const skillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(60),
  category: z.string().min(1).max(40),
  level: z.number().int().min(1).max(100),
});

const achievementSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(100),
  issuer: z.string().min(2).max(80),
  date: z.string().min(4).max(20),
  description: z.string().max(240).default(""),
});

const projectSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(2).max(100),
  summary: z.string().max(320).default(""),
  techStack: z.array(z.string().min(1).max(40)).max(12),
  link: z.string().max(240).default(""),
  status: z.enum(["planned", "active", "completed"]),
});

const profileSchema = z
  .object({
    fullName: z.string().min(2, "Full name is required").max(80).optional(),
    profileImageUrl: z.string().max(280).optional(),
    department: z.string().min(2, "Department is required").max(80).optional(),
    year: z.string().min(1, "Year is required").max(20).optional(),
    experience: z.string().max(120).optional(),
    specialization: z.string().min(2, "Branch / Specialization is required").max(80).optional(),
    headline: z.string().max(120).optional(),
    bio: z.string().max(500).optional(),
    skills: z.array(skillSchema).max(30).optional(),
    achievements: z.array(achievementSchema).max(20).optional(),
    projects: z.array(projectSchema).max(20).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "No profile fields provided" });

export async function PATCH(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);

    if (!parsed.success) {
      const [firstIssue] = parsed.error.issues;
      return NextResponse.json({ error: firstIssue?.message ?? "Invalid input" }, { status: 400 });
    }

    const existingUser = await findUserById(payload.sub);
    if (!existingUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updated = await updateUserProfile(payload.sub, parsed.data);

    return NextResponse.json({
      success: true,
      user: toSessionUser(updated),
      message: "Profile updated successfully",
    });
  } catch {
    return NextResponse.json({ error: "Could not update profile" }, { status: 500 });
  }
}
