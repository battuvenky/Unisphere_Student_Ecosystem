import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/lib/auth/cookie";

export async function POST() {
  const response = NextResponse.json({ success: true, message: "Logged out" });
  clearAuthCookie(response);
  return response;
}
