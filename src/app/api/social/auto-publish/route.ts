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

/**
 * POST /api/social/auto-publish
 * Body: { accountId, text, mediaUrl, platform, scheduledTime? }
 *
 * This route handles the full publish flow:
 * 1. Upload media to Blotato
 * 2. Create the post (immediate or scheduled)
 * 3. Return the postSubmissionId
 */
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
      mediaUrl,
      platform,
      presetId,
      scheduledTime,
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

    // Step 1: Upload media if provided
    let finalMediaUrl = mediaUrl;
    if (mediaUrl) {
      try {
        const mediaRes = await fetch(`${BLOTATO_BASE}/media`, {
          method: "POST",
          headers: headers(apiKey),
          body: JSON.stringify({ url: mediaUrl }),
        });
        const mediaData = await mediaRes.json();
        if (mediaRes.ok && mediaData.url) {
          finalMediaUrl = mediaData.url;
        }
      } catch {
        // Use original URL if media upload fails
      }
    }

    // Step 2: Create the post
    const numericAccountId = typeof accountId === "string" ? parseInt(accountId, 10) : accountId;

    const resolvedTarget = buildBlotatoTarget({
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
          mediaUrls: finalMediaUrl ? [finalMediaUrl] : [],
          platform: contentPlatform,
        },
        target: resolvedTarget,
      },
    };

    // Blotato's worker only publishes posts that carry a `scheduledTime`,
    // and it rejects timestamps already in the past when it validates the
    // request. If the caller didn't pass one, default to 15 seconds in the
    // future — the worker still picks it up on the next tick (effectively
    // immediate) but Blotato's past-time check always passes.
    payload.scheduledTime = scheduledTime || new Date(Date.now() + 15_000).toISOString();

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
