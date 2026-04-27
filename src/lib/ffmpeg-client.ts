"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { toBlobURL, fetchFile } from "@ffmpeg/util";

// Pin to a specific ffmpeg-core version so cache is stable.
const CORE_VERSION = "0.12.10";
const CORE_BASE = `https://unpkg.com/@ffmpeg/core-mt@${CORE_VERSION}/dist/esm`;

let ffmpegInstance: FFmpeg | null = null;
let loadingPromise: Promise<FFmpeg> | null = null;
let fontData: Uint8Array | null = null;

/**
 * Returns a singleton ffmpeg.wasm instance, loading it on first call.
 * Heavy — ~25MB download on first use — cached by browser afterwards.
 */
export async function getFFmpeg(
  onProgress?: (progress: number) => void,
  onLog?: (msg: string) => void
): Promise<FFmpeg> {
  if (ffmpegInstance && ffmpegInstance.loaded) return ffmpegInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const ffmpeg = new FFmpeg();

    if (onLog) {
      ffmpeg.on("log", ({ message }) => onLog(message));
    }
    if (onProgress) {
      ffmpeg.on("progress", ({ progress }) => onProgress(progress));
    }

    // Multi-threaded core requires SharedArrayBuffer which we enabled via
    // COOP/COEP headers in next.config.ts.
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.wasm`,
        "application/wasm"
      ),
      workerURL: await toBlobURL(
        `${CORE_BASE}/ffmpeg-core.worker.js`,
        "text/javascript"
      ),
    });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  return loadingPromise;
}

/**
 * Load (and cache) Inter ExtraBold for ffmpeg drawtext — modern bold
 * sans-serif that matches the canvas-side headline typography.
 */
export async function loadFont(ffmpeg: FFmpeg): Promise<string> {
  const FONT_PATH = "/font.ttf";
  if (!fontData) {
    const font = await fetchFile(
      "https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/inter/static/Inter-ExtraBold.ttf"
    );
    fontData = font;
  }
  await ffmpeg.writeFile(FONT_PATH.replace(/^\//, ""), fontData);
  return FONT_PATH;
}

/**
 * Escape text for the ffmpeg drawtext filter.
 * drawtext uses `:` for param separation and `'` as string delimiter, and
 * backslash-escapes special chars like `\`, `:`, `,`, and `'`.
 */
export function escapeDrawText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/:/g, "\\:")
    .replace(/,/g, "\\,")
    .replace(/\[/g, "\\[")
    .replace(/\]/g, "\\]")
    .replace(/%/g, "\\%");
}

export { fetchFile };
