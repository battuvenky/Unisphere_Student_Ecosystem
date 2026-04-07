import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";
import { findUserById, toSessionUser } from "@/lib/users-store";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await verifySessionToken(token);
    const user = await findUserById(payload.sub);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ success: true, user: toSessionUser(user) });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
