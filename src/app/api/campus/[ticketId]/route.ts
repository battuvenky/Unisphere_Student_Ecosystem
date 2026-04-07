import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { updateCampusTicketStatus } from "@/lib/campus-store";

const updateStatusSchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
});

export async function PATCH(request: Request, context: { params: Promise<{ ticketId: string }> }) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const params = await context.params;
    const body = await request.json();
    const parsed = updateStatusSchema.safeParse(body);

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    const ticket = await updateCampusTicketStatus({
      userId: user.id,
      ticketId: params.ticketId,
      status: parsed.data.status,
    });

    if (!ticket) {
      return NextResponse.json({ error: "Complaint not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, ticket });
  } catch (error) {
    console.error("Campus PATCH API error", error);
    return NextResponse.json({ error: "Could not update complaint" }, { status: 500 });
  }
}
