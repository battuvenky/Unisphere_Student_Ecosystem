import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { voteAnswer } from "@/lib/doubts-store";
import { emitRealtimeEvent } from "@/lib/realtime";

type Context = {
  params: Promise<{ id: string; answerId: string }>;
};

const voteSchema = z.object({
  vote: z.enum(["up", "down", "clear"]),
});

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, answerId } = await context.params;
    const payload = await request.json();
    const parsed = voteSchema.safeParse(payload);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid vote action" }, { status: 400 });
    }

    const result = await voteAnswer({
      questionId: id,
      answerId,
      userId: user.id,
      action: parsed.data.vote,
    });

    if (!result) {
      return NextResponse.json({ error: "Answer not found" }, { status: 404 });
    }

    emitRealtimeEvent("doubts:changed", { questionId: id, reason: "answer_voted" });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("Vote answer API error", error);
    return NextResponse.json({ error: "Could not register vote" }, { status: 500 });
  }
}
