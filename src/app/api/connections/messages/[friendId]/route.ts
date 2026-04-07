import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { findUserById } from "@/lib/users-store";
import {
  listConversation,
  markConversationSeen,
  markMessageDelivered,
  sendDirectMessage,
} from "@/lib/connections-store";
import { createNotification } from "@/lib/notifications-store";
import { emitRealtimeToRoom } from "@/lib/realtime";

const messageSchema = z.object({
  type: z.enum(["text", "note", "file"]),
  text: z.string().max(1000).optional(),
  title: z.string().max(180).optional(),
  url: z.string().url("Shared link must be a valid URL").optional(),
});

const receiptSchema = z.object({
  action: z.enum(["delivered", "seen"]),
  messageId: z.string().optional(),
});

export async function GET(_: Request, context: { params: Promise<{ friendId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    const friend = await findUserById(friendId);
    if (!friend) {
      return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    const result = await listConversation({ userId: user.id, friendUserId: friendId });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    const messages = result.messages.map((message) => ({
      ...message,
      isOwn: message.senderUserId === user.id,
    }));

    return NextResponse.json({
      conversationId: result.conversationId,
      friend: {
        id: friend.id,
        fullName: friend.profile.fullName,
        role: friend.role,
      },
      messages,
    });
  } catch (error) {
    console.error("Connection messages GET API error", error);
    return NextResponse.json({ error: "Could not load conversation" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ friendId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    const friend = await findUserById(friendId);
    if (!friend) {
      return NextResponse.json({ error: "Friend not found" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = messageSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const result = await sendDirectMessage({
      senderUserId: user.id,
      recipientUserId: friendId,
      type: parsed.data.type,
      text: parsed.data.text,
      title: parsed.data.title,
      url: parsed.data.url,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    const messageSnippet =
      result.message.type === "text"
        ? result.message.text.slice(0, 90)
        : result.message.type === "note"
          ? `Shared note: ${result.message.title}`
          : `Shared file: ${result.message.title}`;

    await createNotification({
      userId: friendId,
      type: "message",
      title: `New message from ${user.profile.fullName}`,
      message: messageSnippet,
      link: "/connections",
      priority: "medium",
    });

    emitRealtimeToRoom(`user:${friendId}`, "notifications:changed", {
      userId: friendId,
      reason: "direct_message_received",
    });

    for (const userId of [user.id, friendId]) {
      emitRealtimeToRoom(`user:${userId}`, "connections:message", {
        senderUserId: user.id,
        recipientUserId: friendId,
        messageId: result.message.id,
        conversationId: result.message.conversationId,
      });

      emitRealtimeToRoom(`user:${userId}`, "connections:friends", {
        userIds: [user.id, friendId],
      });
    }

    return NextResponse.json({
      success: true,
      message: {
        ...result.message,
        isOwn: true,
      },
    });
  } catch (error) {
    console.error("Connection messages POST API error", error);
    return NextResponse.json({ error: "Could not send message" }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ friendId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { friendId } = await context.params;

  try {
    const body = await request.json();
    const parsed = receiptSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (parsed.data.action === "delivered") {
      if (!parsed.data.messageId) {
        return NextResponse.json({ error: "Message id is required" }, { status: 400 });
      }

      const result = await markMessageDelivered({
        messageId: parsed.data.messageId,
        recipientUserId: user.id,
      });

      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 403 });
      }

      emitRealtimeToRoom(`user:${result.message.senderUserId}`, "connections:message-status", {
        conversationId: result.message.conversationId,
        messageId: result.message.id,
        deliveredAt: result.message.deliveredAt,
        seenAt: result.message.seenAt,
      });

      return NextResponse.json({ success: true, message: result.message });
    }

    const seenResult = await markConversationSeen({
      viewerUserId: user.id,
      friendUserId: friendId,
    });

    if ("error" in seenResult) {
      return NextResponse.json({ error: seenResult.error }, { status: 403 });
    }

    for (const updated of seenResult.updates) {
      emitRealtimeToRoom(`user:${updated.senderUserId}`, "connections:message-status", {
        conversationId: updated.conversationId,
        messageId: updated.id,
        deliveredAt: updated.deliveredAt,
        seenAt: updated.seenAt,
      });
    }

    return NextResponse.json({
      success: true,
      updates: seenResult.updates.map((item) => ({
        id: item.id,
        deliveredAt: item.deliveredAt,
        seenAt: item.seenAt,
      })),
    });
  } catch (error) {
    console.error("Connection messages PATCH API error", error);
    return NextResponse.json({ error: "Could not update message receipt" }, { status: 500 });
  }
}
