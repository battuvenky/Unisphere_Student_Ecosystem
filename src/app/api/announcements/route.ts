import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { listAnnouncements } from "@/lib/announcements-store";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const announcements = await listAnnouncements();
  return NextResponse.json({ announcements });
}
