import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createTask, listTasks, type TaskPriority, type TaskStatus } from "@/lib/tasks-store";

const statusValues = ["todo", "in_progress", "done"] as const;
const priorityValues = ["low", "medium", "high"] as const;
const deadlineValues = ["overdue", "today", "week"] as const;

const createTaskSchema = z.object({
  title: z.string().min(2, "Task title is required").max(120),
  description: z.string().max(500).optional(),
  course: z.string().max(80).optional(),
  deadline: z.string().date().optional(),
  priority: z.enum(priorityValues).optional(),
  estimatedMinutes: z.number().int().min(10).max(720).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";

    const rawStatus = url.searchParams.get("status") ?? "";
    const status = statusValues.includes(rawStatus as (typeof statusValues)[number])
      ? (rawStatus as TaskStatus)
      : undefined;

    const rawPriority = url.searchParams.get("priority") ?? "";
    const priority = priorityValues.includes(rawPriority as (typeof priorityValues)[number])
      ? (rawPriority as TaskPriority)
      : undefined;

    const rawDeadline = url.searchParams.get("deadline") ?? "";
    const deadline = deadlineValues.includes(rawDeadline as (typeof deadlineValues)[number])
      ? (rawDeadline as "overdue" | "today" | "week")
      : undefined;

    const data = await listTasks(user.id, {
      query,
      status,
      priority,
      deadline,
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "private, max-age=20, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Tasks GET API error", error);
    return NextResponse.json({ error: "Could not fetch tasks" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const task = await createTask({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      course: parsed.data.course,
      deadline: parsed.data.deadline,
      priority: parsed.data.priority,
      estimatedMinutes: parsed.data.estimatedMinutes,
    });

    return NextResponse.json({ success: true, task }, { status: 201 });
  } catch (error) {
    console.error("Tasks POST API error", error);
    return NextResponse.json({ error: "Could not create task" }, { status: 500 });
  }
}
