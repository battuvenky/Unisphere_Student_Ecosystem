import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    app: "UniSphere",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
