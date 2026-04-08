import { NextRequest, NextResponse } from "next/server";

const BLOTATO_BASE = "https://backend.blotato.com/v2";

function getKey(req: NextRequest): string | null {
  return req.headers.get("x-blotato-key") || process.env.BLOTATO_API_KEY || null;
}

function headers(apiKey: string) {
  return {
    "blotato-api-key": apiKey,
    "Content-Type": "application/json",
  };
}

// GET — list scheduled posts
export async function GET(req: NextRequest) {
  try {
    const apiKey = getKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Blotato API key not configured" },
        { status: 401 }
      );
    }

    const limit = req.nextUrl.searchParams.get("limit") || "20";
    const cursor = req.nextUrl.searchParams.get("cursor");
    const url = cursor
      ? `${BLOTATO_BASE}/schedules?limit=${limit}&cursor=${cursor}`
      : `${BLOTATO_BASE}/schedules?limit=${limit}`;

    const res = await fetch(url, { headers: headers(apiKey) });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to fetch schedules" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE — cancel a scheduled post
export async function DELETE(req: NextRequest) {
  try {
    const apiKey = getKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Blotato API key not configured" },
        { status: 401 }
      );
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BLOTATO_BASE}/schedules/${id}`, {
      method: "DELETE",
      headers: headers(apiKey),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: (data as Record<string, string>).message || "Failed to cancel scheduled post" },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
