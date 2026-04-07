import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createExpense, listExpenses, type ExpenseCategory } from "@/lib/expenses-store";

const categoryValues = ["food", "travel", "academics", "hostel", "entertainment", "utilities", "other"] as const;
const typeValues = ["all", "personal", "split"] as const;

const createExpenseSchema = z.object({
  title: z.string().min(2, "Expense title is required").max(100),
  amount: z.number().positive("Amount must be greater than 0").max(1_000_000),
  category: z.enum(categoryValues).optional(),
  date: z.string().date().optional(),
  note: z.string().max(300).optional(),
  splitFriends: z.array(z.string().min(1).max(40)).max(12).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    const month = url.searchParams.get("month") ?? "";

    const rawCategory = url.searchParams.get("category") ?? "";
    const category = categoryValues.includes(rawCategory as (typeof categoryValues)[number])
      ? (rawCategory as ExpenseCategory)
      : undefined;

    const rawType = url.searchParams.get("type") ?? "";
    const type = typeValues.includes(rawType as (typeof typeValues)[number])
      ? (rawType as "all" | "personal" | "split")
      : undefined;

    const data = await listExpenses(user.id, {
      query,
      category,
      type,
      month,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Expenses GET API error", error);
    return NextResponse.json({ error: "Could not fetch expenses" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createExpenseSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const expense = await createExpense({
      userId: user.id,
      title: parsed.data.title,
      amount: parsed.data.amount,
      category: parsed.data.category,
      date: parsed.data.date,
      note: parsed.data.note,
      splitFriends: parsed.data.splitFriends,
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error) {
    console.error("Expenses POST API error", error);
    return NextResponse.json({ error: "Could not create expense" }, { status: 500 });
  }
}
