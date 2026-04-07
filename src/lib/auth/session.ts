import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/auth/types";

export const AUTH_COOKIE_NAME = "unisphere_auth";

const encoder = new TextEncoder();

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET is required in production");
    }

    return encoder.encode("dev-only-unisphere-secret-change-me");
  }

  return encoder.encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ email: payload.email, role: payload.role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, getJwtSecret(), {
    algorithms: ["HS256"],
  });

  if (!payload.sub || typeof payload.email !== "string" || (payload.role !== "student" && payload.role !== "admin")) {
    throw new Error("Invalid token payload");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role,
  };
}
