import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createQuestion, listQuestions, withUserVote } from "@/lib/doubts-store";
import { emitRealtimeEvent } from "@/lib/realtime";
import { listUsers } from "@/lib/users-store";

const createQuestionSchema = z.object({
  title: z.string().min(10, "Title should be at least 10 characters").max(180),
  body: z.string().min(20, "Question details should be at least 20 characters").max(4000),
  subject: z.string().min(2, "Subject is required").max(80),
  tags: z.array(z.string()).max(5).default([]),
});

const sortValues = new Set(["new", "top", "unanswered"]);

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query") ?? "";
  const subject = url.searchParams.get("subject") ?? "";
  const rawSort = url.searchParams.get("sort") ?? "new";
  const sort = sortValues.has(rawSort) ? (rawSort as "new" | "top" | "unanswered") : "new";

  const [questions, users] = await Promise.all([
    listQuestions({ query, subject, sort }),
    listUsers(),
  ]);

  const profileImageMap = new Map(users.map((record) => [record.id, record.profile.profileImageUrl ?? ""]));
  const subjects = Array.from(new Set(questions.map((item) => item.subject))).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    questions: questions.map((question) => {
      const enriched = withUserVote(question, user.id);

      return {
        ...enriched,
        author: {
          ...enriched.author,
          profileImageUrl: profileImageMap.get(enriched.author.id) ?? "",
        },
        topAnswers: enriched.topAnswers.map((answer) => ({
          ...answer,
          author: {
            ...answer.author,
            profileImageUrl: profileImageMap.get(answer.author.id) ?? "",
          },
        })),
      };
    }),
    subjects,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createQuestionSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const question = await createQuestion({
      ...parsed.data,
      author: {
        id: user.id,
        name: user.profile.fullName,
        role: user.role,
      },
    });

    emitRealtimeEvent("doubts:changed", { questionId: question.id, reason: "question_created" });

    return NextResponse.json(
      {
        success: true,
        question: withUserVote(question, user.id),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create question API error", error);
    return NextResponse.json({ error: "Could not post your question" }, { status: 500 });
  }
}
