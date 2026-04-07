import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/auth/session";

const protectedPrefixes = ["/dashboard", "/admin", "/resources", "/doubts", "/placement", "/tasks", "/expenses", "/scheduler", "/analytics", "/groups", "/connections", "/mentorship", "/campus", "/notes", "/notifications", "/profile"];
const authRoutes = ["/login", "/signup"];

function isProtectedPath(pathname: string) {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAuthPath(pathname: string) {
  return authRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedPath(pathname) && !isAuthPath(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    if (isProtectedPath(pathname)) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    return NextResponse.next();
  }

  try {
    const payload = await verifySessionToken(token);
    const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
    const isStudentDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    if (isAdminRoute && payload.role !== "admin") {
      return NextResponse.redirect(new URL("/dashboard?denied=admin", request.url));
    }

    if (payload.role === "admin" && isStudentDashboard) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    if (isAuthPath(pathname)) {
      return NextResponse.redirect(new URL(payload.role === "admin" ? "/admin" : "/dashboard", request.url));
    }

    return NextResponse.next();
  } catch {
    const response = isProtectedPath(pathname)
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();

    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/resources/:path*",
    "/doubts/:path*",
    "/placement/:path*",
    "/tasks/:path*",
    "/expenses/:path*",
    "/scheduler/:path*",
    "/analytics/:path*",
    "/groups/:path*",
    "/connections/:path*",
    "/mentorship/:path*",
    "/campus/:path*",
    "/notes/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/login",
    "/signup",
  ],
};
