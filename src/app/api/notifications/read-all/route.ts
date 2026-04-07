import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { markAllNotificationsRead } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await markAllNotificationsRead(user.id);
    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notifications_read_all",
    });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Notifications read-all API error", error);
    return NextResponse.json({ error: "Could not mark all notifications as read" }, { status: 500 });
  }
}
