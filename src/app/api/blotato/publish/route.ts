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

// POST — publish or schedule a post
export async function POST(req: NextRequest) {
  try {
    const apiKey = getKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Blotato API key not configured" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { accountId, text, mediaUrls, platform, target, scheduledTime, useNextFreeSlot } = body;

    if (!accountId || !text) {
      return NextResponse.json(
        { error: "accountId and text are required" },
        { status: 400 }
      );
    }

    const payload: Record<string, unknown> = {
      post: {
        accountId,
        content: {
          text,
          mediaUrls: mediaUrls || [],
          platform: platform || target?.targetType || "twitter",
        },
        target: target || { targetType: platform || "twitter" },
      },
    };

    if (scheduledTime) payload.scheduledTime = scheduledTime;
    if (useNextFreeSlot) payload.useNextFreeSlot = true;

    const res = await fetch(`${BLOTATO_BASE}/posts`, {
      method: "POST",
      headers: headers(apiKey),
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to publish post" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — poll post status
export async function GET(req: NextRequest) {
  try {
    const apiKey = getKey(req);
    if (!apiKey) {
      return NextResponse.json(
        { error: "Blotato API key not configured" },
        { status: 401 }
      );
    }

    const postSubmissionId = req.nextUrl.searchParams.get("id");
    if (!postSubmissionId) {
      return NextResponse.json(
        { error: "id is required" },
        { status: 400 }
      );
    }

    const res = await fetch(`${BLOTATO_BASE}/posts/${postSubmissionId}`, {
      headers: headers(apiKey),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data.message || "Failed to get post status" },
        { status: res.status }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
