import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/guards";
import { listUsers } from "@/lib/users-store";
import { listResources } from "@/lib/resources-store";
import { listQuestions } from "@/lib/doubts-store";
import { listAnnouncements } from "@/lib/announcements-store";

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const [users, resources, doubts, announcements] = await Promise.all([
    listUsers(),
    listResources(),
    listQuestions(),
    listAnnouncements(),
  ]);

  const blockedUsers = users.filter((user) => user.isBlocked).length;

  return NextResponse.json({
    stats: {
      users: users.length,
      blockedUsers,
      resources: resources.length,
      doubts: doubts.length,
      announcements: announcements.length,
    },
    recentAnnouncements: announcements.slice(0, 5),
  });
}
