import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { deleteExpense, updateExpenseSettlement } from "@/lib/expenses-store";

const patchSchema = z.object({
  friendName: z.string().min(1).max(40),
  settled: z.boolean(),
});

type RouteContext = {
  params: Promise<{ expenseId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { expenseId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const updated = await updateExpenseSettlement({
      userId: user.id,
      expenseId,
      friendName: parsed.data.friendName,
      settled: parsed.data.settled,
    });

    if (!updated) {
      return NextResponse.json({ error: "Expense or friend not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, expense: updated });
  } catch (error) {
    console.error("Expenses PATCH API error", error);
    return NextResponse.json({ error: "Could not update settlement" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { expenseId } = await context.params;
    const removed = await deleteExpense({ userId: user.id, expenseId });

    if (!removed) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Expenses DELETE API error", error);
    return NextResponse.json({ error: "Could not delete expense" }, { status: 500 });
  }
}
