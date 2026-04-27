import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy cross-origin media (images / videos) through our own domain so the
 * browser sees it as same-origin. Needed for:
 *   1. Canvas exports — `<img crossorigin="anonymous">` taints the canvas when
 *      the CDN omits CORS headers. Routing through here bypasses that.
 *   2. ffmpeg.wasm — needs to fetch the original file as a Blob; cross-origin
 *      fetches from CDNs without CORS fail.
 *
 * Accepts only our known/trusted CDN hosts to prevent using the app as an
 * open proxy.
 */

// Suffix allowlist — host must end with one of these. Covers the major
// AI-generation CDNs our app interacts with.
const ALLOWED_HOST_SUFFIXES = [
  "kie.ai",
  "fal.ai",
  "fal.media",
  "fal.run",
  "aiquickdraw.com",      // Kie.ai tempfile CDN
  "blob.vercel-storage.com",
  "blotato.com",
  "googleusercontent.com",
  "googleapis.com",
  "amazonaws.com",
  "cloudfront.net",
  "openai.com",
  "oaiusercontent.com",
];

function isAllowed(urlStr: string): { ok: boolean; host: string } {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return { ok: false, host };
    }
    const ok = ALLOWED_HOST_SUFFIXES.some(
      (suffix) => host === suffix || host.endsWith("." + suffix)
    );
    return { ok, host };
  } catch {
    return { ok: false, host: "" };
  }
}

export async function GET(req: NextRequest) {
  const target = req.nextUrl.searchParams.get("url");
  if (!target) {
    return NextResponse.json({ error: "url param required" }, { status: 400 });
  }
  const allowCheck = isAllowed(target);
  if (!allowCheck.ok) {
    // Log rejected host so we can easily add it to the allowlist if legitimate.
    console.warn(`[proxy-media] rejected host: "${allowCheck.host}" — url=${target}`);
    return NextResponse.json(
      { error: `host "${allowCheck.host}" not allowed` },
      { status: 403 }
    );
  }

  try {
    const upstream = await fetch(target, {
      // Pass through Range header for video seeking.
      headers: req.headers.get("range")
        ? { range: req.headers.get("range")! }
        : undefined,
    });

    if (!upstream.ok && upstream.status !== 206) {
      return NextResponse.json(
        { error: `Upstream error ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const headers = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) headers.set("content-type", contentType);
    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("content-length", contentLength);
    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("content-range", contentRange);
    const acceptRanges = upstream.headers.get("accept-ranges");
    if (acceptRanges) headers.set("accept-ranges", acceptRanges);
    // Cache aggressively — generated content URLs don't change.
    headers.set("cache-control", "public, max-age=31536000, immutable");
    // Explicit CORS + CORP so ffmpeg.wasm can fetch and canvas export works.
    headers.set("access-control-allow-origin", "*");
    headers.set("cross-origin-resource-policy", "cross-origin");

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "proxy failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
