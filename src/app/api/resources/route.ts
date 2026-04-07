import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/server";
import { createResource, listResources } from "@/lib/resources-store";
import { emitRealtimeEvent } from "@/lib/realtime";

export const runtime = "nodejs";

const uploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(140),
  description: z.string().min(6, "Description must be at least 6 characters").max(500),
  subject: z.string().min(2, "Subject is required").max(80),
});

const allowedFileExtensions = ["pdf", "doc", "docx", "txt", "ppt", "pptx", "zip", "rar", "7z", "png", "jpg", "jpeg", "webp"];
const maxFileBytes = 15 * 1024 * 1024;

function toSerializableResource(resource: Awaited<ReturnType<typeof listResources>>[number]) {
  return {
    ...resource,
    downloadUrl: `/api/resources/${resource.id}/download`,
  };
}

function hasAllowedExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension ? allowedFileExtensions.includes(extension) : false;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("query")?.trim().toLowerCase() ?? "";
  const subject = url.searchParams.get("subject")?.trim().toLowerCase() ?? "";
  const type = url.searchParams.get("type")?.trim().toLowerCase() ?? "all";

  const resources = await listResources();
  const filtered = resources.filter((resource) => {
    const matchesQuery =
      !query ||
      resource.title.toLowerCase().includes(query) ||
      resource.description.toLowerCase().includes(query) ||
      resource.subject.toLowerCase().includes(query);

    const matchesSubject = !subject || resource.subject.toLowerCase() === subject;
    const matchesType = type === "all" || resource.type === type;

    return matchesQuery && matchesSubject && matchesType;
  });

  const subjects = Array.from(new Set(resources.map((resource) => resource.subject))).sort((a, b) => a.localeCompare(b));

  return NextResponse.json({
    resources: filtered.map(toSerializableResource),
    subjects,
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    const parsed = uploadSchema.safeParse({
      title: formData.get("title"),
      description: formData.get("description"),
      subject: formData.get("subject"),
    });

    if (!parsed.success) {
      const [issue] = parsed.error.issues;
      return NextResponse.json({ error: issue?.message ?? "Invalid payload" }, { status: 400 });
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A valid file is required" }, { status: 400 });
    }

    if (!hasAllowedExtension(file.name)) {
      return NextResponse.json(
        { error: "Unsupported file format. Upload PDF, DOC, PPT, TXT, ZIP, or image files." },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: "File cannot be empty" }, { status: 400 });
    }

    if (file.size > maxFileBytes) {
      return NextResponse.json({ error: "File exceeds 15MB limit" }, { status: 400 });
    }

    const resource = await createResource({
      ...parsed.data,
      file,
      uploader: {
        id: user.id,
        name: user.profile.fullName,
        email: user.email,
      },
    });

    emitRealtimeEvent("resources:changed", { resourceId: resource.id, reason: "resource_uploaded" });

    return NextResponse.json({ success: true, resource: toSerializableResource(resource) }, { status: 201 });
  } catch (error) {
    console.error("Resources upload API error", error);
    return NextResponse.json({ error: "Could not upload file" }, { status: 500 });
  }
}
