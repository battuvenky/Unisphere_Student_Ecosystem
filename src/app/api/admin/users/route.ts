import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import { deleteUserById, listUsers, setUserBlockedState } from "@/lib/users-store";

const updateSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["block", "unblock", "delete"]),
});

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const users = await listUsers();
  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      isBlocked: Boolean(user.isBlocked),
      blockedAt: user.blockedAt ?? null,
      createdAt: user.createdAt,
      profile: user.profile,
    })),
  });
}

export async function PATCH(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { userId, action } = parsed.data;

  if (userId === auth.user.id) {
    return NextResponse.json({ error: "You cannot modify your own admin account" }, { status: 400 });
  }

  if (action === "delete") {
    const deleted = await deleteUserById(userId);
    if (!deleted) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, action: "delete" });
  }

  const updated = await setUserBlockedState(userId, action === "block").catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    action,
    user: {
      id: updated.id,
      isBlocked: Boolean(updated.isBlocked),
      blockedAt: updated.blockedAt ?? null,
    },
  });
}
