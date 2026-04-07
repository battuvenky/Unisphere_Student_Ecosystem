import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createComment, getQuestionThread } from "@/lib/doubts-store";
import { createNotification } from "@/lib/notifications-store";
import { emitRealtimeEvent, emitRealtimeToRoom } from "@/lib/realtime";

type Context = {
  params: Promise<{ id: string }>;
};

const createCommentSchema = z.object({
  body: z.string().min(2, "Comment should be at least 2 characters").max(1500),
  parentId: z.string().optional(),
});

export async function POST(request: Request, context: Context) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const thread = await getQuestionThread(id);

    if (!thread) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const payload = await request.json();
    const parsed = createCommentSchema.safeParse(payload);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const comment = await createComment({
      questionId: id,
      body: parsed.data.body,
      parentId: parsed.data.parentId,
      author: {
        id: user.id,
        name: user.profile.fullName,
        role: user.role,
      },
    });

    if (!comment) {
      return NextResponse.json({ error: "Thread context not found" }, { status: 404 });
    }

    let recipientUserId: string | null = null;
    let notificationType: "comment" | "reply" = "comment";
    let notificationTitle = "New comment on your doubt";
    let notificationMessage = `${user.profile.fullName} commented on your doubt.`;

    if (parsed.data.parentId) {
      const parentComment = thread.comments.find((item) => item.id === parsed.data.parentId);
      if (parentComment) {
        recipientUserId = parentComment.userId;
        notificationType = "reply";
        notificationTitle = "New reply to your comment";
        notificationMessage = `${user.profile.fullName} replied to your comment.`;
      }
    } else if (parsed.data.parentId === undefined && comment.answerId) {
      const answer = thread.answers.find((item) => item.id === comment.answerId);
      if (answer) {
        recipientUserId = answer.userId;
        notificationType = "comment";
        notificationTitle = "New comment on your answer";
        notificationMessage = `${user.profile.fullName} commented on your answer.`;
      }
    } else {
      recipientUserId = thread.question.userId;
    }

    if (recipientUserId && recipientUserId !== user.id) {
      await createNotification({
        userId: recipientUserId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        link: `/doubts/${id}`,
        priority: "medium",
      });

      emitRealtimeToRoom(`user:${recipientUserId}`, "notifications:changed", {
        userId: recipientUserId,
        reason: notificationType === "reply" ? "doubt_reply_created" : "doubt_comment_created",
      });
    }

    emitRealtimeEvent("doubts:changed", { questionId: id, reason: "comment_created" });

    return NextResponse.json({ success: true, comment }, { status: 201 });
  } catch (error) {
    console.error("Create comment API error", error);
    return NextResponse.json({ error: "Could not post comment" }, { status: 500 });
  }
}
