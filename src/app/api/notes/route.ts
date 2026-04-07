import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createNote, listNotes, type NoteCategory } from "@/lib/notes-store";

const categoryValues = ["general", "class", "project", "placement", "personal"] as const;

const createNoteSchema = z.object({
  title: z.string().min(1, "Title is required").max(140),
  content: z.string().max(20_000).optional(),
  category: z.enum(categoryValues).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";

    const rawCategory = url.searchParams.get("category") ?? "";
    const category = categoryValues.includes(rawCategory as (typeof categoryValues)[number])
      ? (rawCategory as NoteCategory)
      : undefined;

    const tag = url.searchParams.get("tag") ?? "";

    const data = await listNotes(user.id, {
      query,
      category,
      tag,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Notes GET API error", error);
    return NextResponse.json({ error: "Could not fetch notes" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const note = await createNote({
      userId: user.id,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      tags: parsed.data.tags,
      isPinned: parsed.data.isPinned,
    });

    return NextResponse.json({ success: true, note }, { status: 201 });
  } catch (error) {
    console.error("Notes POST API error", error);
    return NextResponse.json({ error: "Could not create note" }, { status: 500 });
  }
}
