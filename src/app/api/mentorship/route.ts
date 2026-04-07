import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createMentorshipRequest,
  listMentorCardsForUser,
  listMentorshipRequestsForUser,
  updateMentorshipRequestStatus,
} from "@/lib/mentorship-store";

const createRequestSchema = z.object({
  action: z.literal("create"),
  mentorId: z.string().min(1),
  topic: z.string().min(2).max(120),
  message: z.string().min(8).max(600),
  preferredDate: z.string().date(),
  durationMinutes: z.number().int().min(30).max(180),
});

const updateStatusSchema = z.object({
  action: z.literal("update-status"),
  requestId: z.string().min(1),
  status: z.enum(["accepted", "declined", "completed", "cancelled"]),
});

const postSchema = z.union([createRequestSchema, updateStatusSchema]);

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [mentors, requests] = await Promise.all([
      listMentorCardsForUser(user.id),
      listMentorshipRequestsForUser(user.id),
    ]);

    return NextResponse.json({
      mentors,
      requests,
    });
  } catch {
    return NextResponse.json({ error: "Could not load mentorship data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(payload);

  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json({ error: first?.message ?? "Invalid request" }, { status: 400 });
  }

  try {
    if (parsed.data.action === "create") {
      const created = await createMentorshipRequest({
        requesterId: user.id,
        mentorId: parsed.data.mentorId,
        topic: parsed.data.topic,
        message: parsed.data.message,
        preferredDate: parsed.data.preferredDate,
        durationMinutes: parsed.data.durationMinutes,
      });

      return NextResponse.json({ request: created }, { status: 201 });
    }

    const updated = await updateMentorshipRequestStatus({
      requestId: parsed.data.requestId,
      actorId: user.id,
      status: parsed.data.status,
    });

    return NextResponse.json({ request: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not process mentorship request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}