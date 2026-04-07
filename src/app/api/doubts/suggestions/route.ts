import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { suggestQuestions } from "@/lib/doubts-store";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = (url.searchParams.get("query") ?? "").trim();
    const body = (url.searchParams.get("body") ?? "").trim();

    if (query.length < 6 && body.length < 10) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = await suggestQuestions({ query, body, limit: 5 });
    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Suggestion API error", error);
    return NextResponse.json({ error: "Could not fetch suggestions" }, { status: 500 });
  }
}
