"use client";

/**
 * High-end social media ad overlay — modern minimalist premium aesthetic.
 * Users just type the text (ideally 2–4 words for the headline); we handle
 * everything else.
 *
 * Design rules (from user spec):
 *   — Large bold sans-serif headline (Inter / Helvetica-style)
 *   — White text, slightly lower-center placement
 *   — Oversized headline, optional smaller subtext on a 2nd line
 *   — Tight letter-spacing (-0.01em) for modern feel
 *   — Soft dark gradient at the bottom of the frame for text readability
 *   — No divider lines, no decoration — pure typography
 *   — High contrast, sleek, tech-forward
 *
 * Input format (single string):
 *   "HEADLINE"
 *   "HEADLINE\nsubtext in smaller weight"
 */

const FONT_FAMILY = "Inter";
const FONT_URL =
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2";
const FONT_URL_REGULAR =
  "https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIa2JL7SUc.woff2";
const HEADLINE_WEIGHT = 800;
const SUBTEXT_WEIGHT = 400;
const HEADLINE_TRACKING = -0.01; // em — tight modern
const SUBTEXT_TRACKING = 0.05; // em — slightly open for small text
const VERTICAL_POSITION = 0.78; // 78% down — slightly lower-center
const HEADLINE_SIZE_RATIO = 0.072; // 7.2% of min dimension
const SUBTEXT_SIZE_RATIO = 0.022; // 2.2% — much smaller, supporting
const GRADIENT_HEIGHT_RATIO = 0.5; // bottom 50% gets the soft dark fade

let fontLoadPromise: Promise<void> | null = null;

async function ensureFontsLoaded(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!fontLoadPromise) {
    fontLoadPromise = (async () => {
      const bold = new FontFace(FONT_FAMILY, `url(${FONT_URL})`, {
        weight: String(HEADLINE_WEIGHT),
        style: "normal",
      });
      const regular = new FontFace(FONT_FAMILY, `url(${FONT_URL_REGULAR})`, {
        weight: String(SUBTEXT_WEIGHT),
        style: "normal",
      });
      const [b, r] = await Promise.all([bold.load(), regular.load()]);
      document.fonts.add(b);
      document.fonts.add(r);
    })();
  }
  await fontLoadPromise;
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split("\n")) {
    const words = rawLine.split(" ");
    let current = "";
    for (const word of words) {
      const test = current ? current + " " + word : word;
      if (ctx.measureText(test).width > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
  }
  return lines.filter(Boolean);
}

function drawTrackedLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  centerX: number,
  y: number,
  trackingPx: number
): number {
  const chars = Array.from(line);
  const widths = chars.map((c) => ctx.measureText(c).width);
  const totalWidth =
    widths.reduce((a, b) => a + b, 0) +
    Math.max(0, chars.length - 1) * trackingPx;
  let x = centerX - totalWidth / 2;
  for (let i = 0; i < chars.length; i++) {
    ctx.fillText(chars[i], x + widths[i] / 2, y);
    x += widths[i] + trackingPx;
  }
  return totalWidth;
}

/**
 * Bake the modern sans-serif overlay into an image. Returns a PNG Blob.
 * - First line → bold oversized headline
 * - Second+ lines → lighter supporting subtext
 */
export async function applyLuxuryOverlayToImage(
  imageUrl: string,
  text: string
): Promise<Blob> {
  if (!text.trim()) throw new Error("text is required");

  await ensureFontsLoaded();

  const proxied = imageUrl.startsWith("/")
    ? imageUrl
    : `/api/proxy-media?url=${encodeURIComponent(imageUrl)}`;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("image load failed"));
    el.src = proxied;
  });

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas context unavailable");

  // 1) Draw the source image
  ctx.drawImage(img, 0, 0);

  const W = canvas.width;
  const H = canvas.height;
  const minDim = Math.min(W, H);

  // 2) Soft bottom gradient for text readability
  const gradH = H * GRADIENT_HEIGHT_RATIO;
  const grad = ctx.createLinearGradient(0, H - gradH, 0, H);
  grad.addColorStop(0, "rgba(0, 0, 0, 0)");
  grad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0.6)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, H - gradH, W, gradH);

  // 3) Split text: first line → headline, remainder → subtext
  const normalized = text.trim();
  const parts = normalized.split("\n").map((s) => s.trim()).filter(Boolean);
  const headline = parts[0] || "";
  const subtext = parts.slice(1).join(" ").trim();

  // ── Headline (bold, oversized) ──
  const headlineSize = Math.round(minDim * HEADLINE_SIZE_RATIO);
  const headlineTrackingPx = headlineSize * HEADLINE_TRACKING;
  ctx.font = `${HEADLINE_WEIGHT} ${headlineSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // subtle shadow for readability over busy backgrounds
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = headlineSize * 0.2;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = headlineSize * 0.04;

  const maxTextWidth = W * 0.82;
  const headlineLines = wrapLines(ctx, headline, maxTextWidth);
  const headlineLineHeight = headlineSize * 1.05; // tight modern line height
  const headlineBlockHeight = headlineLineHeight * headlineLines.length;

  // ── Subtext (small, regular weight, above or below headline) ──
  let subtextLines: string[] = [];
  let subtextLineHeight = 0;
  let subtextBlockHeight = 0;
  let subtextSize = 0;
  let subtextTrackingPx = 0;
  if (subtext) {
    subtextSize = Math.round(minDim * SUBTEXT_SIZE_RATIO);
    subtextTrackingPx = subtextSize * SUBTEXT_TRACKING;
    ctx.font = `${SUBTEXT_WEIGHT} ${subtextSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    subtextLines = wrapLines(ctx, subtext.toUpperCase(), maxTextWidth);
    subtextLineHeight = subtextSize * 1.4;
    subtextBlockHeight = subtextLineHeight * subtextLines.length;
  }

  // Vertical positioning — center the combined block around VERTICAL_POSITION.
  // Order: subtext (small, above) → gap → headline (big).
  const gap = subtext ? headlineSize * 0.3 : 0;
  const totalHeight = subtextBlockHeight + gap + headlineBlockHeight;
  const centerY = H * VERTICAL_POSITION;
  const startY = centerY - totalHeight / 2;
  const centerX = W / 2;

  // Draw subtext (if any) first
  if (subtext) {
    ctx.font = `${SUBTEXT_WEIGHT} ${subtextSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
    ctx.shadowBlur = subtextSize * 0.3;
    ctx.shadowOffsetY = subtextSize * 0.06;
    for (let i = 0; i < subtextLines.length; i++) {
      const y = startY + subtextLineHeight / 2 + i * subtextLineHeight;
      drawTrackedLine(ctx, subtextLines[i], centerX, y, subtextTrackingPx);
    }
  }

  // Draw headline
  ctx.font = `${HEADLINE_WEIGHT} ${headlineSize}px "${FONT_FAMILY}", "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
  ctx.shadowBlur = headlineSize * 0.2;
  ctx.shadowOffsetY = headlineSize * 0.04;
  const headlineStartY = startY + subtextBlockHeight + gap + headlineLineHeight / 2;
  for (let i = 0; i < headlineLines.length; i++) {
    const y = headlineStartY + i * headlineLineHeight;
    drawTrackedLine(ctx, headlineLines[i], centerX, y, headlineTrackingPx);
  }

  // Reset shadow
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png", 0.95)
  );
  if (!blob) throw new Error("failed to export canvas");
  return blob;
}

/**
 * Upload a Blob via /api/upload and return the CDN URL.
 */
export async function uploadBlob(blob: Blob, fileName: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, fileName);
  const res = await fetch("/api/upload", { method: "POST", body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "upload failed");
  }
  const { url } = await res.json();
  return url;
}

export async function overlayImageAndUpload(
  imageUrl: string,
  text: string
): Promise<string> {
  if (!text.trim()) return imageUrl;
  try {
    const blob = await applyLuxuryOverlayToImage(imageUrl, text);
    return await uploadBlob(blob, `lux-${Date.now()}.png`);
  } catch (err) {
    console.error("[luxury-overlay] image failed, returning original:", err);
    return imageUrl;
  }
}

/**
 * Video version — ffmpeg.wasm renders Inter Bold headline + optional subtext
 * with the same bottom gradient overlay.
 */
export async function overlayVideoAndUpload(
  videoUrl: string,
  text: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  if (!text.trim()) return videoUrl;

  try {
    const { getFFmpeg, loadFont, escapeDrawText, fetchFile } = await import(
      "./ffmpeg-client"
    );
    const ffmpeg = await getFFmpeg((p) => onProgress?.(Math.min(0.95, p)));
    const fontPath = await loadFont(ffmpeg);

    const proxied = videoUrl.startsWith("/")
      ? videoUrl
      : `/api/proxy-media?url=${encodeURIComponent(videoUrl)}`;

    const inputName = "input.mp4";
    const outputName = "output.mp4";

    await ffmpeg.writeFile(inputName, await fetchFile(proxied));

    const parts = text
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const headline = parts[0] || "";
    const subtext = parts.slice(1).join(" ").trim();

    // Soft bottom gradient — a semi-transparent drawbox fading darker.
    // drawbox alone can't do gradients, so we stack 3 bands of increasing opacity.
    const gradientFilters = [
      `drawbox=x=0:y=h*0.50:w=iw:h=h*0.16:color=black@0.08:t=fill`,
      `drawbox=x=0:y=h*0.66:w=iw:h=h*0.17:color=black@0.22:t=fill`,
      `drawbox=x=0:y=h*0.83:w=iw:h=h*0.17:color=black@0.4:t=fill`,
    ];

    const headlineSizeExpr = "min(w\\,h)*0.072";
    const subtextSizeExpr = "min(w\\,h)*0.022";
    const centerY = "h*0.78";

    const drawtextFilters: string[] = [];

    // Headline — big, bold, white
    // Split long headline into 2 lines at spaces if it's too long (approx 18 chars)
    const headlineLines =
      headline.length > 22
        ? [headline.slice(0, headline.lastIndexOf(" ", 22) || 22), headline.slice((headline.lastIndexOf(" ", 22) || 22) + 1)]
        : [headline];

    for (let i = 0; i < headlineLines.length; i++) {
      const yOffset = `${centerY}+(${i}-${(headlineLines.length - 1) / 2})*${headlineSizeExpr}*1.05`;
      drawtextFilters.push(
        [
          `drawtext=fontfile=${fontPath}`,
          `text='${escapeDrawText(headlineLines[i])}'`,
          `fontcolor=white`,
          `fontsize=${headlineSizeExpr}`,
          `x=(w-text_w)/2`,
          `y=${yOffset}-(text_h/2)`,
          `shadowcolor=black@0.5`,
          `shadowx=0`,
          `shadowy=2`,
        ].join(":")
      );
    }

    // Subtext — small, above headline
    if (subtext) {
      const subtextY = `${centerY}-${headlineSizeExpr}*${headlineLines.length * 0.55}-${subtextSizeExpr}*1.4`;
      drawtextFilters.push(
        [
          `drawtext=fontfile=${fontPath}`,
          `text='${escapeDrawText(subtext.toUpperCase())}'`,
          `fontcolor=white@0.85`,
          `fontsize=${subtextSizeExpr}`,
          `x=(w-text_w)/2`,
          `y=${subtextY}`,
          `shadowcolor=black@0.4`,
          `shadowx=0`,
          `shadowy=1`,
        ].join(":")
      );
    }

    const vf = [...gradientFilters, ...drawtextFilters].join(",");

    await ffmpeg.exec([
      "-i",
      inputName,
      "-vf",
      vf,
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "22",
      "-c:a",
      "copy",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    const data = (await ffmpeg.readFile(outputName)) as Uint8Array;
    const blob = new Blob([data.buffer as ArrayBuffer], { type: "video/mp4" });
    const url = await uploadBlob(blob, `lux-${Date.now()}.mp4`);
    onProgress?.(1);

    try {
      await ffmpeg.deleteFile(inputName);
      await ffmpeg.deleteFile(outputName);
    } catch {}

    return url;
  } catch (err) {
    console.error("[luxury-overlay] video failed, returning original:", err);
    return videoUrl;
  }
}
