import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { listGroupMembers, listGroupMessages, sendGroupMessage } from "@/lib/groups-store";
import { findUserById } from "@/lib/users-store";
import { emitRealtimeEvent } from "@/lib/realtime";

const sendMessageSchema = z.object({
  type: z.enum(["text", "resource"]),
  text: z.string().min(1, "Message is required").max(600),
  resourceTitle: z.string().max(140).optional(),
  resourceUrl: z.union([z.string().url("Resource URL must be valid"), z.literal("")]).optional(),
});

export async function GET(_: Request, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await context.params;

  try {
    const messagesResult = await listGroupMessages({ userId: user.id, groupId });

    if ("error" in messagesResult) {
      return NextResponse.json({ error: messagesResult.error }, { status: 403 });
    }

    const members = await listGroupMembers({ userId: user.id, groupId });
    const memberMap = new Map<string, { fullName: string }>();

    for (const member of members) {
      const userRecord = await findUserById(member.userId);
      memberMap.set(member.userId, {
        fullName: userRecord?.profile.fullName ?? "Unknown User",
      });
    }

    const messages = messagesResult.messages.map((message) => ({
      ...message,
      authorName: memberMap.get(message.userId)?.fullName ?? "Unknown User",
      isOwn: message.userId === user.id,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Group messages GET API error", error);
    return NextResponse.json({ error: "Could not fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ groupId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { groupId } = await context.params;

  try {
    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (parsed.data.type === "resource" && !parsed.data.resourceUrl) {
      return NextResponse.json({ error: "Resource URL is required for resource shares" }, { status: 400 });
    }

    const result = await sendGroupMessage({
      userId: user.id,
      groupId,
      type: parsed.data.type,
      text: parsed.data.text,
      resourceTitle: parsed.data.resourceTitle,
      resourceUrl: parsed.data.resourceUrl,
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 403 });
    }

    const ownName = user.profile.fullName;

    const responsePayload = {
      success: true,
      message: {
        ...result.message,
        authorName: ownName,
        isOwn: true,
      },
    };

    emitRealtimeEvent("groups:message", { groupId, messageId: result.message.id });

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error) {
    console.error("Group messages POST API error", error);
    return NextResponse.json({ error: "Could not send message" }, { status: 500 });
  }
}
