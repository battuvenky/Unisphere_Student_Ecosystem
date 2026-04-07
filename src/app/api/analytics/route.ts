import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createStudySession, listAnalytics } from "@/lib/analytics-store";

const createSessionSchema = z.object({
  date: z.string().date().optional(),
  subject: z.string().min(2, "Subject is required").max(100),
  minutes: z.number().int().min(10).max(600),
  dsaProblemsSolved: z.number().int().min(0).max(30).optional(),
  focusScore: z.number().int().min(1).max(100).optional(),
  notes: z.string().max(300).optional(),
});

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const analytics = await listAnalytics(user.id);
    return NextResponse.json(analytics);
  } catch (error) {
    console.error("Analytics GET API error", error);
    return NextResponse.json({ error: "Could not fetch analytics" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const session = await createStudySession({
      userId: user.id,
      ...parsed.data,
    });

    return NextResponse.json({ success: true, session }, { status: 201 });
  } catch (error) {
    console.error("Analytics POST API error", error);
    return NextResponse.json({ error: "Could not log study session" }, { status: 500 });
  }
}
