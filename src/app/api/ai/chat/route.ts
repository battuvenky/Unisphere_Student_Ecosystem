import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { getQuestionThread, suggestQuestions } from "@/lib/doubts-store";

const aiChatSchema = z.object({
  message: z.string().min(2, "Message is required").max(1600),
  draftTitle: z.string().max(220).optional(),
  draftBody: z.string().max(4000).optional(),
  questionId: z.string().max(120).optional(),
  mode: z.enum(["chat", "draft-help", "thread-answer"]).default("chat"),
});

type AIChatResponse = {
  reply: string;
  suggestions: string[];
  relatedQuestions: Array<{
    id: string;
    title: string;
    subject: string;
  }>;
};

function fallbackReply(input: {
  message: string;
  draftTitle?: string;
  draftBody?: string;
  mode: "chat" | "draft-help" | "thread-answer";
  topAnswer?: string | null;
  related: Awaited<ReturnType<typeof suggestQuestions>>;
}): AIChatResponse {
  const suggestions: string[] = [];

  if (input.related.length > 0) {
    suggestions.push("A similar discussion already exists. Check related threads before posting.");
  }

  if ((input.draftBody ?? "").trim().length < 90) {
    suggestions.push("Add what you already tried so the answer can be more precise.");
  }

  suggestions.push("Mention expected output or exact error text for faster help.");
  suggestions.push("Include 2-3 specific tags to improve discovery.");

  const topic = input.draftTitle?.trim() || input.message;
  const contextual =
    input.mode === "thread-answer"
      ? "For this existing thread, begin with concept clarification, then explain the practical fix with a compact example."
      : "A strong doubt should include context, attempt, and the exact confusion point.";

  const topAnswerHint = input.topAnswer
    ? `Top community insight: ${input.topAnswer}`
    : "Suggested answer structure: definition, approach, edge case, and quick recap.";

  return {
    reply: [`Topic: ${topic}`, contextual, topAnswerHint].join("\n\n"),
    suggestions: suggestions.slice(0, 4),
    relatedQuestions: input.related.slice(0, 4).map((item) => ({
      id: item.id,
      title: item.title,
      subject: item.subject,
    })),
  };
}

async function callOpenAI(input: {
  message: string;
  draftTitle?: string;
  draftBody?: string;
  mode: "chat" | "draft-help" | "thread-answer";
  topAnswer?: string | null;
  related: Awaited<ReturnType<typeof suggestQuestions>>;
  questionContext?: { title: string; body: string; subject: string } | null;
}): Promise<AIChatResponse | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  const payload = {
    mode: input.mode,
    userMessage: input.message,
    draftTitle: input.draftTitle ?? "",
    draftBody: input.draftBody ?? "",
    questionContext: input.questionContext ?? null,
    topAnswer: input.topAnswer ?? null,
    relatedQuestions: input.related.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      subject: item.subject,
      snippet: item.snippet,
      recommendedAnswer: item.recommendedAnswer,
    })),
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.25,
        input: [
          {
            role: "system",
            content:
              "You are UniSphere AI, an academic doubt assistant. Be concise and practical. Return strict JSON with keys reply (string), suggestions (string[] max 4), relatedQuestions ({id,title,subject}[] max 4).",
          },
          {
            role: "user",
            content: JSON.stringify(payload),
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "unisphere_ai_chat_response",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                reply: { type: "string" },
                suggestions: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 4,
                },
                relatedQuestions: {
                  type: "array",
                  maxItems: 4,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      id: { type: "string" },
                      title: { type: "string" },
                      subject: { type: "string" },
                    },
                    required: ["id", "title", "subject"],
                  },
                },
              },
              required: ["reply", "suggestions", "relatedQuestions"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { output_text?: string };
    if (!data.output_text) {
      return null;
    }

    const parsed = JSON.parse(data.output_text) as AIChatResponse;
    return {
      reply: parsed.reply,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
      relatedQuestions: Array.isArray(parsed.relatedQuestions) ? parsed.relatedQuestions.slice(0, 4) : [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = aiChatSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    let questionContext: { title: string; body: string; subject: string } | null = null;
    let topAnswer: string | null = null;

    if (parsed.data.questionId) {
      const thread = await getQuestionThread(parsed.data.questionId);
      if (thread) {
        questionContext = {
          title: thread.question.title,
          body: thread.question.body,
          subject: thread.question.subject,
        };

        const sorted = [...thread.answers].sort((a, b) => b.votes.score - a.votes.score);
        topAnswer = sorted[0]?.body ?? null;
      }
    }

    const related = await suggestQuestions({
      query: parsed.data.draftTitle?.trim() || parsed.data.message,
      body: `${parsed.data.draftBody ?? ""} ${questionContext?.body ?? ""}`.trim(),
      limit: 5,
    });

    const aiResult = await callOpenAI({
      message: parsed.data.message,
      draftTitle: parsed.data.draftTitle,
      draftBody: parsed.data.draftBody,
      mode: parsed.data.mode,
      topAnswer,
      questionContext,
      related,
    });

    const fallback = fallbackReply({
      message: parsed.data.message,
      draftTitle: parsed.data.draftTitle,
      draftBody: parsed.data.draftBody,
      mode: parsed.data.mode,
      topAnswer,
      related,
    });

    return NextResponse.json({
      success: true,
      ...(aiResult ?? fallback),
      source: aiResult ? "openai" : "fallback",
    });
  } catch {
    return NextResponse.json({ error: "Could not process AI chat request" }, { status: 500 });
  }
}
