import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteNote, updateNote } from "@/lib/notes-store";

const patchSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  content: z.string().max(20_000).optional(),
  category: z.enum(["general", "class", "project", "placement", "personal"]).optional(),
  tags: z.array(z.string().max(30)).max(20).optional(),
  isPinned: z.boolean().optional(),
});

type Params = {
  params: Promise<{ noteId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { noteId } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const note = await updateNote({
      userId: user.id,
      noteId,
      patch: parsed.data,
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, note });
  } catch (error) {
    console.error("Notes PATCH API error", error);
    return NextResponse.json({ error: "Could not update note" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { noteId } = await params;
    const removed = await deleteNote({ userId: user.id, noteId });

    if (!removed) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notes DELETE API error", error);
    return NextResponse.json({ error: "Could not delete note" }, { status: 500 });
  }
}
