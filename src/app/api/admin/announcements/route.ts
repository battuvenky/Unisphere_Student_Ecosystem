import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminUser } from "@/lib/auth/guards";
import {
  createAnnouncement,
  deleteAnnouncementById,
  listAnnouncements,
  updateAnnouncementById,
} from "@/lib/announcements-store";
import { emitRealtimeEvent } from "@/lib/realtime";

const createSchema = z.object({
  title: z.string().min(3).max(140),
  message: z.string().min(10).max(1200),
  isPinned: z.boolean().optional(),
});

const updateSchema = z.object({
  announcementId: z.string().min(1),
  title: z.string().min(3).max(140).optional(),
  message: z.string().min(10).max(1200).optional(),
  isPinned: z.boolean().optional(),
  action: z.enum(["update", "delete"]),
});

export async function GET() {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const announcements = await listAnnouncements();
  return NextResponse.json({ announcements });
}

export async function POST(request: Request) {
  const auth = await requireAdminUser();
  if ("error" in auth) {
    return auth.error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const announcement = await createAnnouncement({
    ...parsed.data,
    createdBy: {
      id: auth.user.id,
      name: auth.user.profile.fullName,
    },
  });

  emitRealtimeEvent("announcements:changed", {
    announcementId: announcement.id,
    reason: "announcement_created",
  });

  return NextResponse.json({ success: true, announcement }, { status: 201 });
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

  if (parsed.data.action === "delete") {
    const deleted = await deleteAnnouncementById(parsed.data.announcementId);
    if (!deleted) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    emitRealtimeEvent("announcements:changed", {
      announcementId: parsed.data.announcementId,
      reason: "announcement_deleted",
    });

    return NextResponse.json({ success: true, action: "delete" });
  }

  const updated = await updateAnnouncementById(parsed.data.announcementId, {
    title: parsed.data.title,
    message: parsed.data.message,
    isPinned: parsed.data.isPinned,
  });

  if (!updated) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  emitRealtimeEvent("announcements:changed", {
    announcementId: updated.id,
    reason: "announcement_updated",
  });

  return NextResponse.json({ success: true, action: "update", announcement: updated });
}
