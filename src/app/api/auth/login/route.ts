import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { setAuthCookie } from "@/lib/auth/cookie";
import { createSessionToken } from "@/lib/auth/session";
import { findUserByEmail, recordUserLogin, toSessionUser } from "@/lib/users-store";

const loginSchema = z.object({
  email: z.email("Enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Password is required"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      const [firstIssue] = parsed.error.issues;
      return NextResponse.json({ error: firstIssue?.message ?? "Invalid credentials" }, { status: 400 });
    }

    const user = await findUserByEmail(parsed.data.email);

    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (user.isBlocked) {
      return NextResponse.json({ error: "Your account has been blocked. Contact admin support." }, { status: 403 });
    }

    const isValid = await compare(parsed.data.password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for") ?? "";
    const ip = forwardedFor.split(",")[0]?.trim() ?? "";
    const userAgent = request.headers.get("user-agent") ?? "";

    await recordUserLogin({
      userId: user.id,
      ip,
      userAgent,
      source: "login",
    });

    const token = await createSessionToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      success: true,
      user: toSessionUser(user),
      token,
      message: "Login successful",
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not log in";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
