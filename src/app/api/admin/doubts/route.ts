import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import { deleteQuestionThread, listQuestions } from "@/lib/doubts-store";
import { emitRealtimeEvent } from "@/lib/realtime";

const deleteSchema = z.object({
  doubtId: z.string().min(1),
});

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const doubts = await listQuestions({ sort: "new" });
  return NextResponse.json({ doubts });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const deleted = await deleteQuestionThread(parsed.data.doubtId);
  if (!deleted) {
    return NextResponse.json({ error: "Doubt not found" }, { status: 404 });
  }

  emitRealtimeEvent("doubts:changed", {
    questionId: parsed.data.doubtId,
    reason: "question_removed_by_admin",
  });

  return NextResponse.json({ success: true });
}
