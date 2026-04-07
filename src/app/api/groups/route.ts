import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createGroup, joinGroupWithCode, listGroupsForUser } from "@/lib/groups-store";
import { emitRealtimeEvent } from "@/lib/realtime";

const createGroupSchema = z.object({
  action: z.literal("create"),
  name: z.string().min(2, "Group name is required").max(90),
  subject: z.string().min(2, "Subject is required").max(80),
  description: z.string().max(250).optional(),
});

const joinGroupSchema = z.object({
  action: z.literal("join"),
  accessCode: z.string().min(4, "Access code is required").max(12),
});

const groupsPayloadSchema = z.discriminatedUnion("action", [createGroupSchema, joinGroupSchema]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const groups = await listGroupsForUser(user.id);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error("Groups GET API error", error);
    return NextResponse.json({ error: "Could not fetch groups" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = groupsPayloadSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (parsed.data.action === "create") {
      const group = await createGroup({
        userId: user.id,
        name: parsed.data.name,
        subject: parsed.data.subject,
        description: parsed.data.description,
      });

      emitRealtimeEvent("groups:changed", { groupId: group.id, reason: "group_created" });

      return NextResponse.json({ success: true, group }, { status: 201 });
    }

    const joined = await joinGroupWithCode({
      userId: user.id,
      accessCode: parsed.data.accessCode,
    });

    if ("error" in joined) {
      return NextResponse.json({ error: joined.error }, { status: 404 });
    }

    emitRealtimeEvent("groups:changed", { groupId: joined.group.id, reason: "group_joined" });

    return NextResponse.json({ success: true, group: joined.group }, { status: 200 });
  } catch (error) {
    console.error("Groups POST API error", error);
    return NextResponse.json({ error: "Could not update groups" }, { status: 500 });
  }
}
