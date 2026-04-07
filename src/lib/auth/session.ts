import { SignJWT, jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/auth/types";

export const AUTH_COOKIE_NAME = "unisphere_auth";

const encoder = new TextEncoder();
const fallbackSecret = "dev-only-unisphere-secret-change-me";
let didWarnMissingSecret = false;

function resolveJwtSecret(): string | undefined {
  const candidates = [process.env.JWT_SECRET, process.env.AUTH_SECRET, process.env.NEXTAUTH_SECRET];
  return candidates.find((item) => typeof item === "string" && item.trim().length > 0)?.trim();
}

function getJwtSecret(): Uint8Array {
  const secret = resolveJwtSecret();

  if (!secret) {
    if (!didWarnMissingSecret) {
      didWarnMissingSecret = true;
      console.warn(
        "[auth] No JWT secret found (JWT_SECRET / AUTH_SECRET / NEXTAUTH_SECRET). Using fallback secret."
      );
    }

    return encoder.encode(fallbackSecret);
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
