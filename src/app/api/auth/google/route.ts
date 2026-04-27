import { NextRequest, NextResponse } from "next/server";
import { getRedis } from "@/lib/redis";

export async function GET(req: NextRequest) {
  const redis = getRedis();
  if (!redis) {
    // Auth is disabled — redirect back with a message instead of starting OAuth flow
    return NextResponse.redirect(new URL("/?auth_error=auth_disabled", req.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Google OAuth not configured" }, { status: 500 });
  }

  const origin = new URL(req.url).origin;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${origin}/api/auth/google/callback`;
  const state = crypto.randomUUID();

  // redis is already confirmed non-null by the guard above
  await redis.set(`ce:oauth:state:${state}`, "google", { ex: 600 });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
