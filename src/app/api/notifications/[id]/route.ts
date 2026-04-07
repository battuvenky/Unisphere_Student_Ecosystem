import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteNotification, updateNotificationReadState } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

const patchSchema = z.object({
  isRead: z.boolean(),
});

type Params = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const { id } = await params;
    const notification = await updateNotificationReadState({
      userId: user.id,
      notificationId: id,
      isRead: parsed.data.isRead,
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notification_updated",
    });

    return NextResponse.json({ success: true, notification });
  } catch (error) {
    console.error("Notifications PATCH API error", error);
    return NextResponse.json({ error: "Could not update notification" }, { status: 500 });
  }
}

export async function DELETE(_: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const deleted = await deleteNotification({ userId: user.id, notificationId: id });

    if (!deleted) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notification_deleted",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications DELETE by id API error", error);
    return NextResponse.json({ error: "Could not delete notification" }, { status: 500 });
  }
}
