import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { getQuestionThread, withUserVote } from "@/lib/doubts-store";
import { listUsers } from "@/lib/users-store";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const [thread, users] = await Promise.all([getQuestionThread(id), listUsers()]);

  if (!thread) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const profileImageMap = new Map(users.map((record) => [record.id, record.profile.profileImageUrl ?? ""]));

  const question = withUserVote(thread.question, user.id);
  const answers = thread.answers.map((answer) => withUserVote(answer, user.id));

  return NextResponse.json({
    question: {
      ...question,
      author: {
        ...question.author,
        profileImageUrl: profileImageMap.get(question.author.id) ?? "",
      },
    },
    answers: answers.map((answer) => ({
      ...answer,
      author: {
        ...answer.author,
        profileImageUrl: profileImageMap.get(answer.author.id) ?? "",
      },
    })),
    comments: thread.comments.map((comment) => ({
      ...comment,
      author: {
        ...comment.author,
        profileImageUrl: profileImageMap.get(comment.author.id) ?? "",
      },
    })),
  });
}
