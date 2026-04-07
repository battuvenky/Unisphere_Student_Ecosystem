import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { clearAllNotifications } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await clearAllNotifications(user.id);

    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notifications_cleared_all",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Notifications clear-all API error", error);
    return NextResponse.json({ error: "Could not clear all notifications" }, { status: 500 });
  }
}
