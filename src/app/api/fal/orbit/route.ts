import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

/**
 * POST /api/fal/orbit
 * Body: {
 *   image_url: string,
 *   horizontal_angle: number (0-360),
 *   vertical_angle: number (-30 to 90),
 *   zoom: number (0-10),
 *   output_format?: "png" | "jpeg",
 *   num_images?: number (default 1),
 * }
 * Returns: { request_id: string }
 *
 * GET /api/fal/orbit?request_id=XXX
 * Returns: { status: "pending" | "in_progress" | "success" | "fail",
 *            images?: [{ url }],
 *            error?: string }
 *
 * Wraps fal-ai/qwen-image-edit-2511-multiple-angles — a specialized
 * multi-angle image-edit model that takes a reference image and renders
 * it from the requested horizontal/vertical/zoom viewpoint without
 * re-interpreting the product. Unlike a general image generator (gpt-image-2),
 * it actually rotates the 3D object rather than generating a vaguely-related scene.
 */

const MODEL_ID = "fal-ai/qwen-image-edit-2511-multiple-angles";

function configureFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY environment variable is not set");
  fal.config({ credentials: key });
}

export async function POST(req: NextRequest) {
  try {
    configureFal();
    const body = await req.json();
    const {
      image_url,
      horizontal_angle,
      vertical_angle,
      zoom,
      output_format = "png",
      num_images = 1,
    } = body;

    if (!image_url) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }
    if (
      typeof horizontal_angle !== "number" ||
      typeof vertical_angle !== "number" ||
      typeof zoom !== "number"
    ) {
      return NextResponse.json(
        { error: "horizontal_angle, vertical_angle, and zoom are required numbers" },
        { status: 400 }
      );
    }

    const input = {
      image_urls: [image_url],
      horizontal_angle,
      vertical_angle,
      zoom,
      output_format,
      num_images,
    };

    console.log(`[fal/orbit] submit:`, JSON.stringify(input).slice(0, 400));

    const { request_id } = await fal.queue.submit(MODEL_ID, { input });

    console.log(`[fal/orbit] queued request_id=${request_id}`);
    return NextResponse.json({ request_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[fal/orbit] submit error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    configureFal();
    const request_id = req.nextUrl.searchParams.get("request_id");
    if (!request_id) {
      return NextResponse.json({ error: "request_id required" }, { status: 400 });
    }

    const status = await fal.queue.status(MODEL_ID, { requestId: request_id });
    // Possible fal queue status strings we've observed:
    //   IN_QUEUE, IN_PROGRESS, COMPLETED, FAILED, ERROR, CANCELLED
    const raw = (status as { status?: string }).status || "";
    const normalized =
      raw === "COMPLETED"
        ? "success"
        : raw === "FAILED" || raw === "ERROR" || raw === "CANCELLED"
        ? "fail"
        : raw === "IN_PROGRESS"
        ? "processing"
        : "pending";

    // Always fetch the result on a terminal state so we can dig out any error
    // details fal embedded in the response body (safety filter rejections
    // often come back as COMPLETED with no images + an error message).
    if (normalized === "success" || normalized === "fail") {
      const result = await fal.queue
        .result(MODEL_ID, { requestId: request_id })
        .catch((err) => {
          // result() itself can throw when fal hit content policy — the thrown
          // error object often carries the user-facing message.
          console.warn(`[fal/orbit] ${request_id} result() threw:`, err);
          return { error: err } as unknown;
        });

      // The fal SDK wraps the raw response in a `data` envelope. But the shape
      // varies — safety-filter responses have sometimes been observed at the
      // top level too. Check both.
      const resultAny = result as Record<string, unknown>;
      const dataAny = (resultAny.data ?? resultAny) as Record<string, unknown>;
      const images = (dataAny.images as { url?: string }[] | undefined) || [];

      // Explicit error fields fal uses in various failure modes
      const explicitError = extractErrorMessage(resultAny) || extractErrorMessage(dataAny);

      // Safety-filter heuristics: empty images + (nsfw flag | content-policy text)
      const hasNsfw =
        dataAny.has_nsfw_concepts === true ||
        dataAny.nsfw_detected === true ||
        (Array.isArray(dataAny.has_nsfw_concepts) &&
          (dataAny.has_nsfw_concepts as unknown[]).some(Boolean));

      // No usable images back? Treat it as a failure and surface any message
      if (images.length === 0 || normalized === "fail") {
        const reason =
          explicitError ||
          (hasNsfw
            ? "The image was rejected by fal.ai's safety filter. Please try a different product photo."
            : null) ||
          "Generation failed. Try a different image or angle.";

        console.error(
          `[fal/orbit] ${request_id} failed (status=${raw}, images=${images.length}) → ${reason}`,
          JSON.stringify(resultAny).slice(0, 500)
        );
        return NextResponse.json({
          status: "fail",
          error: reason,
          request_id,
        });
      }

      console.log(`[fal/orbit] ${request_id} success, ${images.length} image(s)`);
      return NextResponse.json({ status: "success", images });
    }

    return NextResponse.json({ status: normalized });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[fal/orbit] status error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Try a handful of common error-message shapes that fal responses use.
 * Returns the first non-empty string found, or null.
 */
function extractErrorMessage(obj: Record<string, unknown> | null | undefined): string | null {
  if (!obj) return null;
  const candidates = [
    (obj as { error?: string }).error,
    (obj as { error?: { message?: string } }).error?.message,
    (obj as { error?: { detail?: string } }).error?.detail,
    (obj as { detail?: string }).detail,
    (obj as { message?: string }).message,
    // Sometimes fal returns a nested detail array of {loc, msg, type}
    Array.isArray((obj as { detail?: { msg?: string }[] }).detail)
      ? ((obj as { detail?: { msg?: string }[] }).detail as { msg?: string }[])
          .map((d) => d.msg)
          .filter(Boolean)
          .join("; ")
      : null,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c;
  }
  return null;
}
