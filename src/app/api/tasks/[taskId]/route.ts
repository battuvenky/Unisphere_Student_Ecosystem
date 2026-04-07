import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { updateTask } from "@/lib/tasks-store";

const patchSchema = z
  .object({
    title: z.string().min(2).max(120).optional(),
    description: z.string().max(500).optional(),
    course: z.string().max(80).optional(),
    deadline: z.string().date().optional(),
    priority: z.enum(["low", "medium", "high"]).optional(),
    status: z.enum(["todo", "in_progress", "done"]).optional(),
    estimatedMinutes: z.number().int().min(10).max(720).optional(),
    completed: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.description !== undefined ||
      value.course !== undefined ||
      value.deadline !== undefined ||
      value.priority !== undefined ||
      value.status !== undefined ||
      value.estimatedMinutes !== undefined ||
      value.completed !== undefined,
    "No updates provided"
  );

type Params = {
  params: Promise<{ taskId: string }>;
};

export async function PATCH(request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const { taskId } = await params;

    const task = await updateTask({
      userId: user.id,
      taskId,
      patch: {
        title: parsed.data.title,
        description: parsed.data.description,
        course: parsed.data.course,
        deadline: parsed.data.deadline,
        priority: parsed.data.priority,
        status: parsed.data.status,
        estimatedMinutes: parsed.data.estimatedMinutes,
      },
      markCompleted: parsed.data.completed,
    });

    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error("Tasks PATCH API error", error);
    return NextResponse.json({ error: "Could not update task" }, { status: 500 });
  }
}
