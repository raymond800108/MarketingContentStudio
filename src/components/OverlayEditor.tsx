"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Type, Save, Download, Loader2, Bold, Sun, Moon, Move, Sparkles, RefreshCw } from "lucide-react";
import { useGenerationStore, type HistoryItem } from "@/lib/stores/generation-store";
import { useI18nStore, useTMaybe } from "@/lib/i18n";
import { trackApiCall } from "@/lib/stores/api-usage-store";

interface OverlayEditorProps {
  item: HistoryItem;
  onClose: () => void;
}

type PositionPreset = "top" | "middle" | "bottom";
const PRESET_COORDS: Record<PositionPreset, { x: number; y: number }> = {
  top: { x: 0.5, y: 0.12 },
  middle: { x: 0.5, y: 0.5 },
  bottom: { x: 0.5, y: 0.88 },
};

const FONT_FAMILIES = [
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "Menlo, monospace" },
  { label: "Impact", value: "Impact, 'Arial Black', sans-serif" },
];

// ── Color palette ────────────────────────────────────────────────
// Full color-wheel (12 hues × 5 tint/shade steps) + a neutrals row.
// Mirrors the classic Adobe/Figma color-wheel layout so users who know what
// they want can find it at a glance.

const NEUTRALS = [
  "#ffffff", "#e5e7eb", "#9ca3af", "#6b7280",
  "#374151", "#1f2937", "#0f172a", "#000000",
];

// Each row: a hue with 5 shades (lightest → darkest).
const COLOR_WHEEL: { name: string; shades: string[] }[] = [
  { name: "Red",           shades: ["#fee2e2", "#fca5a5", "#ef4444", "#b91c1c", "#7f1d1d"] },
  { name: "Red-Orange",    shades: ["#ffedd5", "#fdba74", "#f97316", "#c2410c", "#7c2d12"] },
  { name: "Orange",        shades: ["#fff7ed", "#fdba74", "#fb923c", "#ea580c", "#9a3412"] },
  { name: "Yellow-Orange", shades: ["#fef3c7", "#fcd34d", "#f59e0b", "#b45309", "#78350f"] },
  { name: "Yellow",        shades: ["#fef9c3", "#fde047", "#eab308", "#a16207", "#713f12"] },
  { name: "Yellow-Green",  shades: ["#ecfccb", "#bef264", "#84cc16", "#4d7c0f", "#365314"] },
  { name: "Green",         shades: ["#dcfce7", "#86efac", "#22c55e", "#15803d", "#14532d"] },
  { name: "Blue-Green",    shades: ["#ccfbf1", "#5eead4", "#14b8a6", "#0f766e", "#134e4a"] },
  { name: "Blue",          shades: ["#dbeafe", "#93c5fd", "#3b82f6", "#1d4ed8", "#1e3a8a"] },
  { name: "Blue-Violet",   shades: ["#e0e7ff", "#a5b4fc", "#6366f1", "#4338ca", "#312e81"] },
  { name: "Violet",        shades: ["#ede9fe", "#c4b5fd", "#8b5cf6", "#6d28d9", "#4c1d95"] },
  { name: "Red-Violet",    shades: ["#fae8ff", "#f0abfc", "#d946ef", "#a21caf", "#701a75"] },
];

function isLightColor(hex: string): boolean {
  const h = hex.replace("#", "");
  if (h.length !== 6) return true;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived brightness (YIQ)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function ColorSwatch({
  c,
  active,
  onPick,
}: {
  c: string;
  active: boolean;
  onPick: (c: string) => void;
}) {
  return (
    <button
      onClick={() => onPick(c)}
      title={c}
      className={`w-4 h-4 rounded-sm border transition-all hover:scale-125 ${
        active
          ? "border-accent ring-1 ring-accent/60 scale-125"
          : "border-border/30"
      }`}
      style={{ background: c }}
    />
  );
}

export default function OverlayEditor({ item, onClose }: OverlayEditorProps) {
  const addHistory = useGenerationStore((s) => s.addHistory);
  const locale = useI18nStore((s) => s.locale);
  const tm = useTMaybe();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  // Bounding box of the rendered text, in canvas-native pixels. Used for
  // drag hit-testing and for drawing the selection outline in the preview.
  const textBoundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  // Drag offset so the text follows the cursor relative to where the user
  // grabbed it (not snap-to-center).
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  const [text, setText] = useState("");
  const [fontSize, setFontSize] = useState(64);
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value);
  const [color, setColor] = useState("#ffffff");
  const [bold, setBold] = useState(false);
  const [stroke, setStroke] = useState(false);
  const [shadow, setShadow] = useState(false);
  // Normalized 0–1 coordinates (fraction of canvas width/height)
  const [textX, setTextX] = useState(0.5);
  const [textY, setTextY] = useState(0.88);
  const [isDragging, setIsDragging] = useState(false);
  const [isHoveringText, setIsHoveringText] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // AI-suggested overlay slogans
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // Load image once — route through /api/proxy-media so the canvas can
  // export without CORS tainting. If the proxy rejects the host, fall back to
  // loading the image directly WITHOUT crossOrigin so at least the preview
  // works (Save-to-Library will still fail via tainted canvas, but Download
  // of the preview image can succeed via screenshot).
  useEffect(() => {
    setImgError(null);
    setImgLoaded(false);

    const isSameOrigin =
      item.resultUrl.startsWith("/") ||
      (typeof window !== "undefined" && item.resultUrl.startsWith(window.location.origin));
    const proxiedSrc = isSameOrigin
      ? item.resultUrl
      : `/api/proxy-media?url=${encodeURIComponent(item.resultUrl)}`;

    let aborted = false;

    // First attempt — via proxy with CORS so canvas export works
    const primary = new Image();
    primary.crossOrigin = "anonymous";
    primary.onload = () => {
      if (aborted) return;
      imgRef.current = primary;
      setImgLoaded(true);
    };
    primary.onerror = () => {
      if (aborted) return;
      console.warn("[OverlayEditor] proxy load failed, trying direct:", item.resultUrl);
      // Fall back — load direct without crossOrigin
      const fallback = new Image();
      fallback.onload = () => {
        if (aborted) return;
        imgRef.current = fallback;
        setImgLoaded(true);
        setImgError(
          "Loaded from original source — Save to Library may fail for cross-origin images. Use Download instead."
        );
      };
      fallback.onerror = () => {
        if (aborted) return;
        setImgError(`Failed to load image. URL: ${item.resultUrl}`);
      };
      fallback.src = item.resultUrl;
    };
    primary.src = proxiedSrc;

    return () => {
      aborted = true;
    };
  }, [item.resultUrl]);

  // Redraw whenever inputs change. Also records the rendered text bounding
  // box into textBoundsRef so drag hit-testing has something to check against.
  // `showHandle` draws a dashed selection outline around the text — we pass
  // `true` for interactive preview, `false` when exporting the final blob.
  const redraw = useCallback(
    (showHandle = true) => {
      const canvas = canvasRef.current;
      const img = imgRef.current;
      if (!canvas || !img) return;

      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);

      if (!text.trim()) {
        textBoundsRef.current = null;
        return;
      }

      const scaledSize = Math.round((fontSize / 1000) * canvas.width);
      ctx.font = `${bold ? "bold" : "normal"} ${scaledSize}px ${fontFamily}`;
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Wrap
      const maxWidth = canvas.width * 0.9;
      const lines: string[] = [];
      for (const rawLine of text.split("\n")) {
        const words = rawLine.split(" ");
        let currentLine = "";
        for (const word of words) {
          const test = currentLine ? currentLine + " " + word : word;
          if (ctx.measureText(test).width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = test;
          }
        }
        if (currentLine) lines.push(currentLine);
      }

      const lineHeight = scaledSize * 1.15;
      const totalHeight = lineHeight * lines.length;

      // Compute center point from normalized coords, then clamp so the whole
      // text block stays on-canvas.
      const widestLine = lines.reduce(
        (w, l) => Math.max(w, ctx.measureText(l).width),
        0
      );
      const halfW = widestLine / 2;
      const halfH = totalHeight / 2;
      const minX = halfW + 4;
      const maxX = canvas.width - halfW - 4;
      const minY = halfH + 4;
      const maxY = canvas.height - halfH - 4;
      const centerX = Math.min(maxX, Math.max(minX, textX * canvas.width));
      const centerY = Math.min(maxY, Math.max(minY, textY * canvas.height));

      // Shadow
      if (shadow) {
        ctx.shadowColor = "rgba(0,0,0,0.7)";
        ctx.shadowBlur = scaledSize * 0.15;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = scaledSize * 0.05;
      } else {
        ctx.shadowColor = "transparent";
        ctx.shadowBlur = 0;
      }

      const startY = centerY - totalHeight / 2 + lineHeight / 2;
      for (let i = 0; i < lines.length; i++) {
        const ly = startY + i * lineHeight;
        if (stroke) {
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.lineWidth = Math.max(2, scaledSize * 0.08);
          ctx.lineJoin = "round";
          ctx.strokeText(lines[i], centerX, ly);
        }
        ctx.fillText(lines[i], centerX, ly);
      }

      // Reset shadow before drawing the selection handle
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;

      // Record bounding box (in canvas px) for hit-testing
      const pad = scaledSize * 0.25;
      const bx = centerX - halfW - pad;
      const by = centerY - halfH - pad;
      const bw = halfW * 2 + pad * 2;
      const bh = halfH * 2 + pad * 2;
      textBoundsRef.current = { x: bx, y: by, width: bw, height: bh };

      // Selection outline — only in preview (showHandle=true)
      if (showHandle) {
        ctx.save();
        ctx.strokeStyle = isDragging
          ? "rgba(99, 102, 241, 0.95)"    // accent when dragging
          : isHoveringText
          ? "rgba(255, 255, 255, 0.75)"    // white when hovering
          : "rgba(255, 255, 255, 0.28)";   // faint when idle
        ctx.lineWidth = Math.max(2, canvas.width * 0.002);
        ctx.setLineDash([canvas.width * 0.01, canvas.width * 0.008]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }
    },
    [text, fontSize, fontFamily, color, bold, stroke, shadow, textX, textY, isDragging, isHoveringText]
  );

  useEffect(() => {
    if (imgLoaded) redraw(true);
  }, [imgLoaded, redraw]);

  // ── Drag-to-position handlers ─────────────────────────────────
  // Convert a browser pointer event to canvas-native coordinates, accounting
  // for the fact that the canvas is displayed smaller than its natural size.
  function pointerToCanvas(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function isInsideText(x: number, y: number): boolean {
    const b = textBoundsRef.current;
    if (!b) return false;
    return x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height;
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!text.trim()) return;
    const { x, y } = pointerToCanvas(e);
    if (!isInsideText(x, y)) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Track offset from the text center so dragging doesn't snap-jump
    const b = textBoundsRef.current!;
    const centerX = b.x + b.width / 2;
    const centerY = b.y + b.height / 2;
    dragOffsetRef.current = { dx: x - centerX, dy: y - centerY };
    setIsDragging(true);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = pointerToCanvas(e);

    if (isDragging) {
      const nx = (x - dragOffsetRef.current.dx) / canvas.width;
      const ny = (y - dragOffsetRef.current.dy) / canvas.height;
      setTextX(Math.max(0, Math.min(1, nx)));
      setTextY(Math.max(0, Math.min(1, ny)));
    } else {
      // Update cursor hint
      const inside = isInsideText(x, y);
      if (inside !== isHoveringText) setIsHoveringText(inside);
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    setIsDragging(false);
    const canvas = canvasRef.current;
    if (canvas && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
  };

  const handleAiEnhance = async () => {
    setSuggestLoading(true);
    setSuggestError(null);
    try {
      const data = await trackApiCall(
        "openai",
        "overlay_suggest",
        "/api/images/suggest-overlay",
        async () => {
          const res = await fetch("/api/images/suggest-overlay", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image_url: item.resultUrl, locale }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "suggest failed");
          return d as { suggestions: string[] };
        }
      );
      const list = data.suggestions || [];
      setSuggestions(list);
      // Auto-fill the textarea with the first suggestion so user sees instant
      // feedback and can edit from there.
      if (list.length > 0) setText(list[0]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error("[OverlayEditor] AI suggest failed:", msg);
      setSuggestError(msg);
    } finally {
      setSuggestLoading(false);
    }
  };

  // Produce an upload-friendly blob. Tries PNG at native resolution first;
  // if too large for the upstream CDN (fal.ai's ~4.5MB limit), progressively
  // downscales to 1600px longest edge, then falls back to JPEG at decreasing
  // quality until we fit under MAX_UPLOAD_BYTES.
  const MAX_UPLOAD_BYTES = 4_400_000; // stay safely under fal.ai 4.5MB cap

  async function exportBlobForUpload(canvas: HTMLCanvasElement): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
    const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
      new Promise<Blob | null>((resolve, reject) => {
        try {
          c.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob returned null (tainted canvas?)"))), type, q);
        } catch (e) {
          reject(e);
        }
      });

    // 1. Try full-res PNG
    let blob = await toBlob(canvas, "image/png");
    if (blob && blob.size <= MAX_UPLOAD_BYTES) {
      console.log(`[OverlayEditor] PNG at native size fits: ${(blob.size / 1024).toFixed(0)}KB`);
      return { blob, ext: "png" };
    }

    // 2. Downscale to 1600px longest edge and retry PNG
    const maxEdge = 1600;
    const long = Math.max(canvas.width, canvas.height);
    let workCanvas = canvas;
    if (long > maxEdge) {
      const scale = maxEdge / long;
      const tmp = document.createElement("canvas");
      tmp.width = Math.round(canvas.width * scale);
      tmp.height = Math.round(canvas.height * scale);
      const ctx = tmp.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(canvas, 0, 0, tmp.width, tmp.height);
        workCanvas = tmp;
        blob = await toBlob(workCanvas, "image/png");
        if (blob && blob.size <= MAX_UPLOAD_BYTES) {
          console.log(
            `[OverlayEditor] PNG at ${tmp.width}x${tmp.height} fits: ${(blob.size / 1024).toFixed(0)}KB`
          );
          return { blob, ext: "png" };
        }
      }
    }

    // 3. JPEG at decreasing quality until it fits
    for (const q of [0.92, 0.85, 0.78, 0.7]) {
      blob = await toBlob(workCanvas, "image/jpeg", q);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        console.log(
          `[OverlayEditor] JPEG q=${q} @ ${workCanvas.width}x${workCanvas.height} fits: ${(blob.size / 1024).toFixed(0)}KB`
        );
        return { blob, ext: "jpg" };
      }
    }

    // 4. Give up with the smallest we got
    if (!blob) throw new Error("Failed to export image (empty blob)");
    console.warn(`[OverlayEditor] blob still ${(blob.size / 1024).toFixed(0)}KB — may exceed upload limit`);
    return { blob, ext: "jpg" };
  }

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!text.trim()) {
      alert("Add some text first");
      return;
    }

    setSaving(true);
    try {
      // Redraw without the selection handle so the exported image is clean
      redraw(false);

      let blob: Blob;
      let ext: "png" | "jpg";
      try {
        const result = await exportBlobForUpload(canvas);
        blob = result.blob;
        ext = result.ext;
      } catch (exportErr) {
        const m = exportErr instanceof Error ? exportErr.message : String(exportErr);
        if (/tainted|SecurityError|cross-origin/i.test(m)) {
          throw new Error(
            "This image was loaded cross-origin without CORS and can't be re-uploaded. Use Download PNG instead."
          );
        }
        throw exportErr;
      }

      console.log(`[OverlayEditor] uploading ${ext.toUpperCase()} size=${(blob.size / 1024).toFixed(0)}KB`);

      const formData = new FormData();
      formData.append("file", blob, `overlay-${Date.now()}.${ext}`);

      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({} as { error?: string }));
        const serverMsg = errBody?.error || `HTTP ${res.status} ${res.statusText}`;
        throw new Error(`Upload failed: ${serverMsg}`);
      }
      const { url } = await res.json();

      addHistory({
        id: crypto.randomUUID(),
        sourceUrl: item.resultUrl,
        resultUrl: url,
        profileId: item.profileId,
        mode: "image",
        prompt: `Overlay: "${text.slice(0, 60)}"`,
        timestamp: Date.now(),
        source: item.source || "studio",
      });

      onClose();
    } catch (err) {
      console.error("[OverlayEditor] save failed:", err);
      alert("Save failed — " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Redraw without the selection handle so the downloaded PNG is clean
    redraw(false);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/png", 0.95)
    );
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `overlay-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Type className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold">Add Text Overlay</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-muted/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Canvas preview */}
          <div className="flex-1 bg-black/40 p-4 flex items-center justify-center overflow-auto">
            {!imgLoaded && !imgError ? (
              <div className="flex flex-col items-center gap-2 text-muted">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="text-xs">Loading image…</span>
              </div>
            ) : imgError && !imgLoaded ? (
              <div className="max-w-md text-center text-xs text-red-400 space-y-2">
                <p className="font-semibold">Couldn&apos;t load image</p>
                <p className="text-muted break-all">{imgError}</p>
                <p className="text-muted text-[11px]">
                  Tip: this CDN may not be in the proxy allowlist. Copy the URL above so it can be added.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <canvas
                  ref={canvasRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  className="max-w-full max-h-[60vh] rounded-lg shadow-xl object-contain touch-none select-none"
                  style={{
                    imageRendering: "auto",
                    cursor: isDragging
                      ? "grabbing"
                      : isHoveringText
                      ? "grab"
                      : "default",
                  }}
                />
                <p className="text-[10px] text-muted flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  Drag the text to position it anywhere on the image
                </p>
                {imgError && (
                  <p className="text-[10px] text-amber-500/90 max-w-md text-center">
                    ⚠ {imgError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="w-full md:w-80 p-4 border-t md:border-t-0 md:border-l border-border overflow-y-auto space-y-4">
            {/* Text input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] uppercase font-semibold tracking-wider text-muted">
                  {tm("overlayEditor.text", "Overlay Text")}
                </label>
                <button
                  onClick={handleAiEnhance}
                  disabled={suggestLoading || !imgLoaded}
                  className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md bg-accent/10 text-accent hover:bg-accent/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={tm("overlayEditor.aiEnhanceHint", "Generate catchy slogans based on this image")}
                >
                  {suggestLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {suggestLoading
                    ? tm("overlayEditor.thinking", "Thinking…")
                    : suggestions.length > 0
                    ? tm("overlayEditor.regenerate", "Regenerate")
                    : tm("overlayEditor.aiEnhance", "AI Enhance")}
                </button>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={tm("overlayEditor.textPh", "Type your text here…")}
                rows={3}
                className="w-full px-3 py-2 text-sm bg-muted/5 border border-border rounded-lg focus:outline-none focus:border-accent/50 resize-none"
              />
              <p className="text-[10px] text-muted mt-1">
                {tm("overlayEditor.textHint", "Press Enter for new line")}
              </p>

              {suggestError && (
                <p className="mt-1.5 text-[10px] text-red-400">⚠ {suggestError}</p>
              )}

              {/* AI suggestions — clickable pills */}
              {suggestions.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <p className="text-[10px] text-muted flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-accent" />
                    {tm("overlayEditor.suggestionsLabel", "Tap a suggestion to use it:")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => setText(s)}
                        className={`px-2.5 py-1 text-[11px] rounded-full border transition-all ${
                          text === s
                            ? "bg-accent/15 border-accent/40 text-accent"
                            : "bg-card border-border text-foreground/80 hover:border-accent/30 hover:text-accent"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                    <button
                      onClick={handleAiEnhance}
                      disabled={suggestLoading}
                      className="px-2 py-1 text-[11px] rounded-full border border-dashed border-border/60 text-muted hover:text-accent hover:border-accent/40 flex items-center gap-1 transition-colors disabled:opacity-50"
                      title={tm("overlayEditor.moreIdeas", "Get more ideas")}
                    >
                      <RefreshCw className={`w-2.5 h-2.5 ${suggestLoading ? "animate-spin" : ""}`} />
                      {tm("overlayEditor.more", "More")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Font family */}
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted block mb-1.5">
                Font
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm bg-muted/5 border border-border rounded-lg focus:outline-none focus:border-accent/50"
              >
                {FONT_FAMILIES.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Font size */}
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted flex items-center justify-between mb-1.5">
                <span>Size</span>
                <span className="font-mono text-[10px]">{fontSize}</span>
              </label>
              <input
                type="range"
                min={20}
                max={200}
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                className="w-full accent-accent"
              />
            </div>

            {/* Color — full palette (color-wheel hues × tint/shade steps) */}
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted flex items-center justify-between mb-1.5">
                <span>Color</span>
                <span
                  className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-border"
                  style={{ background: color, color: isLightColor(color) ? "#000" : "#fff" }}
                >
                  {color.toUpperCase()}
                </span>
              </label>

              {/* Neutrals row */}
              <div className="flex flex-wrap gap-0.5 mb-1">
                {NEUTRALS.map((c) => (
                  <ColorSwatch key={c} c={c} active={color === c} onPick={setColor} />
                ))}
              </div>

              {/* Color wheel — 12 hues × 5 shades */}
              <div className="space-y-0.5">
                {COLOR_WHEEL.map((row) => (
                  <div key={row.name} className="flex gap-0.5" title={row.name}>
                    {row.shades.map((c) => (
                      <ColorSwatch
                        key={c}
                        c={c}
                        active={color === c}
                        onPick={setColor}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Custom picker */}
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-8 rounded-md cursor-pointer border border-border"
                  title="Pick any color"
                />
                <span className="text-[10px] text-muted">Any color</span>
              </div>
            </div>

            {/* Style toggles */}
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted block mb-1.5">
                Style
              </label>
              <div className="flex gap-1.5">
                <button
                  onClick={() => setBold(!bold)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-colors ${
                    bold
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-muted/5 border-border text-muted hover:text-foreground"
                  }`}
                >
                  <Bold className="w-3 h-3" />
                  Bold
                </button>
                <button
                  onClick={() => setStroke(!stroke)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                    stroke
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-muted/5 border-border text-muted hover:text-foreground"
                  }`}
                >
                  Outline
                </button>
                <button
                  onClick={() => setShadow(!shadow)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1 transition-colors ${
                    shadow
                      ? "bg-accent text-accent-foreground border-accent"
                      : "bg-muted/5 border-border text-muted hover:text-foreground"
                  }`}
                >
                  {shadow ? <Moon className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                  Shadow
                </button>
              </div>
            </div>

            {/* Position presets — drag on the canvas for fine control */}
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted block mb-1.5">
                Quick Position
              </label>
              <div className="flex gap-1.5">
                {(["top", "middle", "bottom"] as PositionPreset[]).map((p) => {
                  const coords = PRESET_COORDS[p];
                  const isActive =
                    Math.abs(textX - coords.x) < 0.01 &&
                    Math.abs(textY - coords.y) < 0.01;
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setTextX(coords.x);
                        setTextY(coords.y);
                      }}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors capitalize ${
                        isActive
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-muted/5 border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted mt-1">
                Or drag the text on the image for any position.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 space-y-2 border-t border-border">
              <button
                onClick={handleSave}
                disabled={saving || !imgLoaded || !text.trim()}
                className="w-full py-2 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save to Library
                  </>
                )}
              </button>
              <button
                onClick={handleDownload}
                disabled={!imgLoaded}
                className="w-full py-2 bg-muted/5 border border-border text-foreground rounded-lg text-sm font-semibold hover:bg-muted/10 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download PNG
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
