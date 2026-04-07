import { readFile } from "fs/promises";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { findResourceById, getResourceAbsolutePath, incrementDownloadCount } from "@/lib/resources-store";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const resource = await findResourceById(id);

  if (!resource) {
    return NextResponse.json({ error: "Resource not found" }, { status: 404 });
  }

  try {
    const filePath = getResourceAbsolutePath(resource.storedFileName);
    const fileBuffer = await readFile(filePath);

    await incrementDownloadCount(resource.id);

    return new Response(fileBuffer, {
      headers: {
        "Content-Type": resource.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(resource.originalFileName)}"`,
        "Content-Length": String(fileBuffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "File is no longer available" }, { status: 410 });
  }
}
