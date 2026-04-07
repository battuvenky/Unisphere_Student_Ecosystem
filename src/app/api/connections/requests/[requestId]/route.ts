import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { respondToFriendRequest } from "@/lib/connections-store";
import { createNotification } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

const requestActionSchema = z.object({
  action: z.enum(["accept", "reject", "cancel"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ requestId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { requestId } = await context.params;

  try {
    const body = await request.json();
    const parsed = requestActionSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const result = await respondToFriendRequest({
      requestId,
      userId: user.id,
      action: parsed.data.action,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (parsed.data.action === "accept") {
      const accepterId = user.id;
      const requesterId =
        accepterId === result.request.fromUserId ? result.request.toUserId : result.request.fromUserId;

      await createNotification({
        userId: requesterId,
        type: "friend",
        title: "Friend request accepted",
        message: "Your friend request was accepted. You can now start chatting.",
        link: "/connections",
        priority: "medium",
      });

      emitRealtimeToRoom(`user:${requesterId}`, "notifications:changed", {
        userId: requesterId,
        reason: "friend_request_accepted",
      });
    }

    if (parsed.data.action === "reject") {
      const rejecterId = user.id;
      const requesterId =
        rejecterId === result.request.fromUserId ? result.request.toUserId : result.request.fromUserId;

      await createNotification({
        userId: requesterId,
        type: "friend",
        title: "Friend request declined",
        message: "Your friend request was declined.",
        link: "/connections",
        priority: "low",
      });

      emitRealtimeToRoom(`user:${requesterId}`, "notifications:changed", {
        userId: requesterId,
        reason: "friend_request_rejected",
      });
    }

    for (const userId of [result.request.fromUserId, result.request.toUserId]) {
      emitRealtimeToRoom(`user:${userId}`, "connections:requests", {
        userIds: [result.request.fromUserId, result.request.toUserId],
        requestId: result.request.id,
        action: parsed.data.action,
      });
    }

    if (parsed.data.action === "accept") {
      for (const userId of [result.request.fromUserId, result.request.toUserId]) {
        emitRealtimeToRoom(`user:${userId}`, "connections:friends", {
          userIds: [result.request.fromUserId, result.request.toUserId],
        });
      }
    }

    return NextResponse.json({ success: true, request: result.request });
  } catch (error) {
    console.error("Connection request PATCH API error", error);
    return NextResponse.json({ error: "Could not update request" }, { status: 500 });
  }
}
