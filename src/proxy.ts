import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that require authentication — unauthenticated users are redirected to /
const PROTECTED_PAGES = ["/studio", "/social", "/dashboard", "/tasks", "/ugc"];

export async function proxy(request: NextRequest) {
  // Skip auth entirely when Redis is not configured
  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;
  if (!kvUrl || !kvToken) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const token = request.cookies.get("ce-session")?.value;

  // ── Protected page routes (redirect to landing if no session) ──
  const isProtectedPage = PROTECTED_PAGES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isProtectedPage) {
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth_error", "login_required");
      return NextResponse.redirect(url);
    }

    const { verifySessionToken } = await import("@/lib/auth");
    const valid = await verifySessionToken(token);
    if (!valid) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.searchParams.set("auth_error", "session_expired");
      // Clear stale cookie
      const res = NextResponse.redirect(url);
      res.cookies.delete("ce-session");
      return res;
    }

    return NextResponse.next();
  }

  // ── Protected API routes (return 401 JSON) ──
  if (!token) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  const { verifySessionToken } = await import("@/lib/auth");
  const valid = await verifySessionToken(token);
  if (!valid) {
    return NextResponse.json(
      { error: "Session expired — please sign in again" },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protected pages
    "/studio/:path*",
    "/social/:path*",
    "/dashboard/:path*",
    "/tasks/:path*",
    "/ugc/:path*",
    // Protected API routes
    "/api/kie/:path*",
    "/api/analyze/:path*",
    "/api/upload/:path*",
    "/api/ugc/:path*",
  ],
};
