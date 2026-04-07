import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";

export async function requireAdminUser() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) } as const;
  }

  if (user.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required" }, { status: 403 }) } as const;
  }

  return { user } as const;
}
