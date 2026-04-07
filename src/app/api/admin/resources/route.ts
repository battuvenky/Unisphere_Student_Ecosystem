import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import { deleteResourceById, listResources } from "@/lib/resources-store";
import { emitRealtimeEvent } from "@/lib/realtime";

const deleteSchema = z.object({
  resourceId: z.string().min(1),
});

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const resources = await listResources();
  return NextResponse.json({ resources });
}

export async function DELETE(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = deleteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const deleted = await deleteResourceById(parsed.data.resourceId);
  if (!deleted) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  emitRealtimeEvent("resources:changed", {
    resourceId: parsed.data.resourceId,
    reason: "resource_removed_by_admin",
  });

  return NextResponse.json({ success: true });
}
