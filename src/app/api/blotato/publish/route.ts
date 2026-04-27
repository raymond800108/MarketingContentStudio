import { NextRequest, NextResponse } from "next/server";
import { buildBlotatoTarget, normalizePlatform } from "@/lib/blotato-target";

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
    const {
      accountId,
      text,
      mediaUrls,
      platform,
      presetId,
      target: callerTarget,
      scheduledTime,
      useNextFreeSlot,
      facebookPageId,
      linkedinPageId,
      pinterestBoardId,
      youtubeTitle,
    } = body;

    if (!accountId || !text) {
      return NextResponse.json(
        { error: "accountId and text are required" },
        { status: 400 }
      );
    }

    // Blotato v2 expects accountId as a number
    const numericAccountId = typeof accountId === "string" ? parseInt(accountId, 10) : accountId;

    // Build target per Blotato spec — derive mediaType/required-fields from
    // presetId + platform. Caller-supplied `target` wins if explicitly set.
    const resolvedTarget = callerTarget && callerTarget.targetType
      ? callerTarget
      : buildBlotatoTarget({
          platform,
          presetId,
          facebookPageId,
          linkedinPageId,
          pinterestBoardId,
          youtubeTitle,
        });

    const contentPlatform = (resolvedTarget.targetType as string) || normalizePlatform(platform);

    const payload: Record<string, unknown> = {
      post: {
        accountId: numericAccountId,
        content: {
          text,
          mediaUrls: mediaUrls || [],
          platform: contentPlatform,
        },
        target: resolvedTarget,
      },
    };

    // Blotato's worker only publishes posts that carry a `scheduledTime`.
    // If the caller didn't supply one, default to 15 seconds in the future so
    // the worker treats this as an immediate post.
    if (useNextFreeSlot) {
      payload.useNextFreeSlot = true;
    } else {
      payload.scheduledTime =
        scheduledTime || new Date(Date.now() + 15_000).toISOString();
    }

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
