import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  clearReadNotifications,
  createNotification,
  listNotifications,
  type NotificationType,
} from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

const typeValues = ["task", "exam", "event", "friend", "message", "comment", "reply"] as const;

const createSchema = z.object({
  type: z.enum(typeValues),
  title: z.string().min(2, "Title is required").max(120),
  message: z.string().min(4, "Message is required").max(300),
  link: z.string().max(120).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const onlyUnread = url.searchParams.get("unread") === "true";

    const rawType = url.searchParams.get("type") ?? "";
    const type = typeValues.includes(rawType as (typeof typeValues)[number])
      ? (rawType as NotificationType)
      : undefined;

    const limitValue = Number(url.searchParams.get("limit"));
    const limit = Number.isFinite(limitValue) && limitValue > 0 ? Math.min(limitValue, 50) : undefined;

    const data = await listNotifications(user.id, {
      onlyUnread,
      type,
      limit,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=10, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("Notifications GET API error", error);
    return NextResponse.json({ error: "Could not fetch notifications" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const notification = await createNotification({
      userId: user.id,
      type: parsed.data.type,
      title: parsed.data.title,
      message: parsed.data.message,
      link: parsed.data.link,
      priority: parsed.data.priority,
    });

    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notification_created",
    });

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (error) {
    console.error("Notifications POST API error", error);
    return NextResponse.json({ error: "Could not create notification" }, { status: 500 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await clearReadNotifications(user.id);

    emitRealtimeToRoom(`user:${user.id}`, "notifications:changed", {
      userId: user.id,
      reason: "notifications_cleared_read",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Notifications DELETE API error", error);
    return NextResponse.json({ error: "Could not clear notifications" }, { status: 500 });
  }
}
