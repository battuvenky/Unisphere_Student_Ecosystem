import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { findUserById, toSessionUser } from "@/lib/users-store";

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return null;
    }

    const payload = await verifySessionToken(token);
    const user = await findUserById(payload.sub);

    return user ? toSessionUser(user) : null;
  } catch {
    return null;
  }
}
