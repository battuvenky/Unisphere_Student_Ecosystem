import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createAnswer, getQuestionThread, withUserVote } from "@/lib/doubts-store";
import { createNotification } from "@/lib/notifications-store";
import { emitRealtimeEvent, emitRealtimeToRoom } from "@/lib/realtime";

type Context = {
  params: Promise<{ id: string }>;
};

const createAnswerSchema = z.object({
  body: z.string().min(10, "Answer should be at least 10 characters").max(4000),
});

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const existingThread = await getQuestionThread(id);

    if (!existingThread) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const payload = await request.json();
    const parsed = createAnswerSchema.safeParse(payload);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const answer = await createAnswer({
      questionId: id,
      body: parsed.data.body,
      author: {
        id: user.id,
        name: user.profile.fullName,
        role: user.role,
      },
    });

    if (!answer) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const ownerUserId = existingThread.question.userId;
    if (ownerUserId !== user.id) {
      await createNotification({
        userId: ownerUserId,
        type: "reply",
        title: `New answer on: ${existingThread.question.title}`,
        message: `${user.profile.fullName} posted an answer to your doubt.`,
        link: `/doubts/${id}`,
        priority: "medium",
      });

      emitRealtimeToRoom(`user:${ownerUserId}`, "notifications:changed", {
        userId: ownerUserId,
        reason: "doubt_answer_created",
      });
    }

    emitRealtimeEvent("doubts:changed", { questionId: id, reason: "answer_created" });

    return NextResponse.json({ success: true, answer: withUserVote(answer, user.id) }, { status: 201 });
  } catch (error) {
    console.error("Create answer API error", error);
    return NextResponse.json({ error: "Could not post answer" }, { status: 500 });
  }
}
