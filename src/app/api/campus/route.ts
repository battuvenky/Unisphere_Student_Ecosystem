import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import {
  createCampusTicket,
  listCampusData,
  type CampusIssueCategory,
  type CampusTicketStatus,
} from "@/lib/campus-store";

const statusValues = ["open", "in_progress", "resolved"] as const;
const categoryValues = ["hostel", "mess", "cleanliness", "electricity", "water"] as const;

const createTicketSchema = z.object({
  title: z.string().min(3, "Title is required").max(140),
  description: z.string().min(8, "Description is too short").max(1000),
  category: z.enum(categoryValues),
  hostelBlock: z.string().max(60).optional(),
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
      ? (rawStatus as CampusTicketStatus)
      : undefined;

    const rawCategory = url.searchParams.get("category") ?? "";
    const category = categoryValues.includes(rawCategory as (typeof categoryValues)[number])
      ? (rawCategory as CampusIssueCategory)
      : undefined;

    const data = await listCampusData(user.id, {
      query,
      status,
      category,
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Campus GET API error", error);
    return NextResponse.json({ error: "Could not fetch campus data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createTicketSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const ticket = await createCampusTicket({
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      hostelBlock: parsed.data.hostelBlock,
    });

    return NextResponse.json({ success: true, ticket }, { status: 201 });
  } catch (error) {
    console.error("Campus POST API error", error);
    return NextResponse.json({ error: "Could not create complaint" }, { status: 500 });
  }
}
