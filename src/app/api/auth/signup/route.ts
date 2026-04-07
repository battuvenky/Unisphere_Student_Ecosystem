import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookie } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import type { UserRole } from "@/lib/auth/types";
import { createUser, toSessionUser } from "@/lib/users-store";

const signupSchema = z.object({
  email: z.email("Enter a valid email address").toLowerCase(),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must include at least one uppercase letter")
    .regex(/[a-z]/, "Password must include at least one lowercase letter")
    .regex(/[0-9]/, "Password must include at least one number"),
  fullName: z.string().min(2, "Full name is required").max(80),
  department: z.string().min(2, "Department is required").max(80),
  year: z.string().min(1, "Year is required").max(20),
  specializations: z.array(z.string().min(2).max(80)).min(1, "Select at least one specialization").max(12),
  otherSpecialization: z.string().max(80).optional(),
  role: z.enum(["student", "admin"]).default("student"),
  adminInviteCode: z.string().optional(),
});

function resolveRole(role: UserRole, adminInviteCode?: string): UserRole {
  if (role !== "admin") {
    return "student";
  }

  const expectedCode = process.env.ADMIN_INVITE_CODE;
  if (!expectedCode || adminInviteCode !== expectedCode) {
    throw new Error("Invalid admin invite code");
  }

  return "admin";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const [firstIssue] = parsed.error.issues;
      return NextResponse.json({ error: firstIssue?.message ?? "Invalid input" }, { status: 400 });
    }

    const role = resolveRole(parsed.data.role, parsed.data.adminInviteCode);
    const passwordHash = await hash(parsed.data.password, 12);

    const selectedSpecializations = parsed.data.specializations
      .map((item) => item.trim())
      .filter(Boolean);

    if (parsed.data.otherSpecialization?.trim()) {
      selectedSpecializations.push(parsed.data.otherSpecialization.trim());
    }

    const uniqueSpecializations = Array.from(new Set(selectedSpecializations.map((item) => item.toLowerCase()))).map(
      (normalized) => selectedSpecializations.find((value) => value.toLowerCase() === normalized) ?? normalized
    );

    if (uniqueSpecializations.length === 0) {
      return NextResponse.json({ error: "Select at least one specialization" }, { status: 400 });
    }

    const user = await createUser({
      email: parsed.data.email,
      passwordHash,
      role,
      profile: {
        fullName: parsed.data.fullName,
        department: parsed.data.department,
        year: parsed.data.year,
        specialization: uniqueSpecializations.join(", "),
        specializations: uniqueSpecializations,
      },
    });

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: toSessionUser(user),
      message: "Account created successfully",
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create account";
    const status = message === "Email already exists" || message === "Invalid admin invite code" ? 409 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
