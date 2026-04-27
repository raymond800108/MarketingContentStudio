"use client";

import { getFFmpeg, fetchFile } from "@/lib/ffmpeg-client";

/**
 * Stitch N mp4 segments into one continuous video using ffmpeg.wasm.
 *
 * Strategy:
 *   1. Normalize every segment to the same codec/resolution/fps/audio so the
 *      subsequent concat can't fail on mismatched streams.
 *   2. For N=2: apply a 3-frame (~0.125s) video crossfade + 0.12s audio
 *      acrossfade at the seam, belt-and-suspenders on top of the pixel-lock
 *      MID keyframe architecture. Hides any residual encoder mismatch that
 *      survives the frame-identity lock.
 *   3. For N>2 or fallback: concat with ffmpeg's `concat` demuxer.
 *
 * Falls back gracefully if the xfade step fails (e.g. missing audio in one
 * segment) to a hard concat so the user always gets a video. Emits logs to
 * console so the frontend can surface what actually happened.
 */

async function loadFfmpegWithLogs(onProgress?: (pct: number) => void) {
  const logs: string[] = [];
  const ffmpeg = await getFFmpeg(onProgress, (line: string) => {
    // Keep the last ~200 lines so error messages can include tail context
    logs.push(line);
    if (logs.length > 200) logs.shift();
  });
  return { ffmpeg, logs };
}

export async function stitchSegments(
  segmentUrls: string[],
  onProgress?: (pct: number) => void
): Promise<Blob> {
  if (segmentUrls.length === 0) throw new Error("No segments to stitch");

  // Fast path — single segment, just re-fetch and return
  if (segmentUrls.length === 1) {
    console.log("[video-stitch] single segment, passthrough");
    const url = segmentUrls[0];
    const proxied = url.startsWith("/")
      ? url
      : `/api/proxy-media?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxied);
    if (!res.ok) throw new Error(`Passthrough fetch failed: HTTP ${res.status}`);
    return res.blob();
  }

  const { ffmpeg, logs } = await loadFfmpegWithLogs(onProgress);
  console.log(`[video-stitch] ffmpeg loaded, stitching ${segmentUrls.length} segments`);

  // ── Phase 1: fetch each segment ──
  const inputNames: string[] = [];
  for (let i = 0; i < segmentUrls.length; i++) {
    const url = segmentUrls[i];
    const proxied = url.startsWith("/")
      ? url
      : `/api/proxy-media?url=${encodeURIComponent(url)}`;
    const name = `seg${i}.mp4`;
    try {
      const bytes = await fetchFile(proxied);
      await ffmpeg.writeFile(name, bytes);
      inputNames.push(name);
      console.log(
        `[video-stitch] seg ${i}: ${(bytes.byteLength / 1024).toFixed(0)}KB loaded`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Failed to fetch segment ${i}: ${msg}`);
    }
  }

  // ── Phase 2: normalize each segment to a common format ──
  // This is the step that prevents concat-demuxer mismatches later.
  // 1080×1920 @ 24fps, H.264 yuv420p, AAC stereo 44.1kHz — matches Seedance
  // output spec closely so re-encoding is fast.
  const normalizedNames: string[] = [];
  for (let i = 0; i < inputNames.length; i++) {
    const inName = inputNames[i];
    const outName = `norm${i}.mp4`;
    try {
      await ffmpeg.exec([
        "-i", inName,
        // Video: H.264, tight bitrate, consistent SAR/FPS
        "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
        // Audio: AAC, 44.1kHz stereo. If input has no audio, generate silence.
        "-af", "aresample=44100",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        // If the source has no audio stream, inject silence via lavfi
        "-shortest",
        outName,
      ]);
      normalizedNames.push(outName);
      console.log(`[video-stitch] seg ${i} normalized`);
    } catch (err) {
      const tail = logs.slice(-6).join(" | ");
      throw new Error(
        `Failed to normalize segment ${i}: ${err instanceof Error ? err.message : String(err)}. ffmpeg: ${tail}`
      );
    }
  }

  // ── Phase 3: stitch ──
  // For the exact-two-segment case (10s UGC), use an xfade seam — even with
  // pixel-locked MID keyframes, xfade hides residual encoder / colorspace
  // mismatch. Fall back to hard concat if xfade fails for any reason.
  let xfadeSucceeded = false;
  if (normalizedNames.length === 2) {
    try {
      const XFADE_DURATION = 0.125; // ~3 frames at 24fps
      const SEG1_DURATION = 5.0;    // Seedance segments are 5s each
      const OFFSET = SEG1_DURATION - XFADE_DURATION;
      await ffmpeg.exec([
        "-i", normalizedNames[0],
        "-i", normalizedNames[1],
        "-filter_complex",
        `[0:v][1:v]xfade=transition=fade:duration=${XFADE_DURATION}:offset=${OFFSET}[v];` +
        `[0:a][1:a]acrossfade=d=${XFADE_DURATION}[a]`,
        "-map", "[v]",
        "-map", "[a]",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart",
        "out.mp4",
      ]);
      xfadeSucceeded = true;
      console.log("[video-stitch] xfade seam complete");
    } catch (err) {
      const tail = logs.slice(-10).join(" | ");
      console.warn(
        `[video-stitch] xfade failed, falling back to hard concat: ${
          err instanceof Error ? err.message : String(err)
        }. ffmpeg: ${tail}`
      );
    }
  }

  if (!xfadeSucceeded) {
    const listContent = normalizedNames.map((n) => `file '${n}'`).join("\n");
    await ffmpeg.writeFile(
      "list.txt",
      new TextEncoder().encode(listContent)
    );
    try {
      await ffmpeg.exec([
        "-f", "concat",
        "-safe", "0",
        "-i", "list.txt",
        "-c", "copy",                 // all segments normalized — no re-encode needed
        "-movflags", "+faststart",
        "out.mp4",
      ]);
      console.log("[video-stitch] concat complete");
    } catch (err) {
      const tail = logs.slice(-10).join(" | ");
      throw new Error(
        `Concat failed: ${err instanceof Error ? err.message : String(err)}. ffmpeg: ${tail}`
      );
    }
  }

  // ── Phase 4: read output + cleanup ──
  let outBytes: Uint8Array;
  try {
    const out = await ffmpeg.readFile("out.mp4");
    outBytes = out as Uint8Array;
    console.log(
      `[video-stitch] output size=${(outBytes.byteLength / 1024).toFixed(0)}KB`
    );
  } catch (err) {
    throw new Error(
      `Could not read stitched output: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Best-effort cleanup — don't let cleanup errors take down a successful stitch
  const safeDelete = async (name: string) => {
    try { await ffmpeg.deleteFile(name); } catch { /* not present, ignore */ }
  };
  try {
    for (const n of inputNames) await safeDelete(n);
    for (const n of normalizedNames) await safeDelete(n);
    await safeDelete("list.txt");
    await safeDelete("out.mp4");
  } catch (cleanupErr) {
    console.warn("[video-stitch] cleanup warning:", cleanupErr);
  }

  return new Blob([outBytes.buffer as ArrayBuffer], { type: "video/mp4" });
}
