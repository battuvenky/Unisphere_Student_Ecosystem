import { NextResponse } from "next/server";

// Backward-compatible alias for existing clients.
export async function POST(request: Request) {
  const clonedBody = await request.json();

  const response = await fetch(new URL("/api/ai/chat", request.url), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: request.headers.get("cookie") ?? "",
    },
    body: JSON.stringify(clonedBody),
    cache: "no-store",
  });

  const payload = await response.json();
  return NextResponse.json(payload, { status: response.status });
}
