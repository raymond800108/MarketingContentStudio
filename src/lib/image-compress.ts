"use client";

/**
 * Compress a user-uploaded image on the client BEFORE posting to /api/upload.
 *
 * Vercel serverless functions cap incoming request bodies at ~4.5 MB. Modern
 * phones/cameras routinely produce 6-15 MB photos, so the upload request
 * itself fails with FUNCTION_PAYLOAD_TOO_LARGE before our route runs.
 *
 * This helper:
 *   1. Loads the file into an HTMLImageElement
 *   2. Scales the long edge to at most `maxEdge` pixels (default 2048 — more
 *      than enough for gpt-image-2, qwen-multi-angle, or Seedance input)
 *   3. Exports as JPEG at progressively lower quality until it fits under
 *      `maxBytes` (default 3.5 MB — comfortable headroom under the 4.5 MB limit)
 *   4. Returns a new File with a stable name so downstream FormData + fal
 *      upload logic still work
 *
 * If the input is already small + a safe format, we skip re-encoding to avoid
 * degrading quality unnecessarily.
 */

const DEFAULT_MAX_BYTES = 3_500_000;
const DEFAULT_MAX_EDGE = 2048;

export async function compressImageForUpload(
  file: File,
  opts: { maxBytes?: number; maxEdge?: number } = {}
): Promise<File> {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxEdge = opts.maxEdge ?? DEFAULT_MAX_EDGE;

  // Non-images pass through untouched (lets videos/etc. use the same handler).
  if (!file.type.startsWith("image/")) return file;

  // Already small enough — skip re-encoding.
  if (file.size <= maxBytes) return file;

  const img = await loadImage(file);
  const { width: origW, height: origH } = img;

  // Compute target dimensions — preserve aspect ratio, cap long edge.
  const long = Math.max(origW, origH);
  const scale = long > maxEdge ? maxEdge / long : 1;
  const targetW = Math.round(origW * scale);
  const targetH = Math.round(origH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    // Canvas unavailable — hand back the original and let the server fail
    // explicitly rather than silently breaking here.
    return file;
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, targetW, targetH);

  // Try JPEG at decreasing quality until we fit under the limit.
  for (const q of [0.92, 0.85, 0.78, 0.7, 0.6]) {
    const blob = await canvasToBlob(canvas, "image/jpeg", q);
    if (blob && blob.size <= maxBytes) {
      console.log(
        `[image-compress] ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(blob.size / 1024).toFixed(0)}KB ` +
          `(${origW}x${origH} → ${targetW}x${targetH}, jpeg q=${q})`
      );
      // Rebuild as a File so existing FormData flows still see a File.
      const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], renamed, { type: "image/jpeg", lastModified: Date.now() });
    }
  }

  // Last resort — return whatever we got at lowest quality, even if still large.
  const fallback = await canvasToBlob(canvas, "image/jpeg", 0.5);
  if (fallback) {
    console.warn(
      `[image-compress] could not fit under ${maxBytes}B — using ${(fallback.size / 1024).toFixed(0)}KB q=0.5`
    );
    const renamed = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([fallback], renamed, { type: "image/jpeg", lastModified: Date.now() });
  }
  return file;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));
}
