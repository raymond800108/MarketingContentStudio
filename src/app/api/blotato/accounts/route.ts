import { NextRequest, NextResponse } from "next/server";

const BLOTATO_BASE = "https://backend.blotato.com/v2";

function getKey(req: NextRequest): string | null {
  // Accept key from header (set by client from localStorage)
  return req.headers.get("x-blotato-key") || process.env.BLOTATO_API_KEY || null;
}

function headers(apiKey: string) {
  return {
    "blotato-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

// GET — list connected social accounts
export async function GET(req: NextRequest) {
  try {
    const apiKey = getKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Blotato API key not configured" },
        { status: 401 }
      );
    }

    const platform = req.nextUrl.searchParams.get("platform");
    const url = platform
      ? `${BLOTATO_BASE}/users/me/accounts?platform=${platform}`
      : `${BLOTATO_BASE}/users/me/accounts`;

    const res = await fetch(url, { headers: headers(apiKey) });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to fetch accounts" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
