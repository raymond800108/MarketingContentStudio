"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Upload,
  Loader2,
  Sparkles,
  RotateCcw,
  X,
  Camera,
} from "lucide-react";
import OrbitCameraControl, { type OrbitParams } from "@/components/OrbitCameraControl";
import { useT, useTMaybe } from "@/lib/i18n";
import { trackApiCall } from "@/lib/stores/api-usage-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
import { compressImageForUpload } from "@/lib/image-compress";

// Resolution presets with live cost (×5 margin over $0.035/MP raw)
const RESOLUTIONS = [
  { label: "1024 × 1024", w: 1024, h: 1024 },
  { label: "1536 × 1536", w: 1536, h: 1536 },
  { label: "2048 × 2048", w: 2048, h: 2048 },
  { label: "1024 × 1536 · Portrait", w: 1024, h: 1536 },
  { label: "1536 × 1024 · Landscape", w: 1536, h: 1024 },
];

function resolutionCost(w: number, h: number): number {
  return (w * h / 1_000_000) * 0.035 * 5;
}

const PRESETS: { label: string; params: OrbitParams }[] = [
  { label: "Front", params: { horizontalAngle: 0, verticalAngle: 0, zoom: 5 } },
  { label: "Front-Right", params: { horizontalAngle: 45, verticalAngle: 15, zoom: 5 } },
  { label: "Side (R)", params: { horizontalAngle: 90, verticalAngle: 0, zoom: 5 } },
  { label: "Top-Down", params: { horizontalAngle: 0, verticalAngle: 85, zoom: 6 } },
  { label: "Low Angle", params: { horizontalAngle: 0, verticalAngle: -25, zoom: 4 } },
  { label: "3/4 Hero", params: { horizontalAngle: 30, verticalAngle: 20, zoom: 4 } },
];

export default function OrbitPage() {
  const t = useT();
  const tm = useTMaybe();
  const addHistory = useGenerationStore((s) => s.addHistory);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orbit, setOrbit] = useState<OrbitParams>({
    horizontalAngle: 45,
    verticalAngle: 15,
    zoom: 5,
  });
  const [resolution, setResolution] = useState(RESOLUTIONS[0]);

  const [loading, setLoading] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cost = resolutionCost(resolution.w, resolution.h);

  // ── Upload handlers ──
  const handleFile = async (rawFile: File) => {
    if (!rawFile) return;
    // Reset any stale state from the previous generation so a fresh upload
    // doesn't appear broken when the old result image + error are still visible.
    setUploading(true);
    setError(null);
    setResultUrl(null);
    setSourceUrl(null);
    try {
      // Client-side compress BEFORE hitting /api/upload. Vercel serverless
      // functions cap request bodies at 4.5 MB — modern phone photos are
      // often 6-12 MB, which would trigger FUNCTION_PAYLOAD_TOO_LARGE before
      // our route even runs. 2048px long-edge JPEG at q=0.92 stays well
      // under the limit with no visible quality loss for generation.
      const file = await compressImageForUpload(rawFile);
      const formData = new FormData();
      formData.append("file", file);
      const res = await trackApiCall("fal", "file_upload", "/api/upload", async () => {
        const r = await fetch("/api/upload", { method: "POST", body: formData });
        if (!r.ok) {
          // Friendly error for the 4.5 MB limit that slipped through compression
          if (r.status === 413) {
            throw new Error(
              "Image too large even after compression. Try a smaller image (under ~10 MB)."
            );
          }
          throw new Error(await r.text());
        }
        return r.json();
      });
      setSourceUrl(res.url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      // Catch the raw Vercel FUNCTION_PAYLOAD_TOO_LARGE text that fetch
      // surfaces before JSON parsing would normally happen.
      if (/413|payload too large/i.test(msg)) {
        setError("Image too large even after compression. Try a smaller image (under ~10 MB).");
      } else {
        setError(msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  // Triggers the hidden file input programmatically. Resets `value` first so
  // selecting the SAME filename twice still fires `onChange` (HTML quirk).
  const openFilePicker = () => {
    const el = fileInputRef.current;
    if (!el) return;
    el.value = "";
    el.click();
  };

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Clear immediately so subsequent selections (including the same file)
    // always trigger change events.
    e.target.value = "";
  };

  // ── Generate via fal-ai/qwen-image-edit-2511-multiple-angles ──────
  // This model takes the orbit's numeric angles DIRECTLY (no prompt
  // engineering needed) and renders the reference product from the
  // requested viewpoint. It's 3D-aware rather than treating the source
  // as a style cue, so it actually rotates the product instead of
  // generating a vaguely-related scene.
  const handleGenerate = async () => {
    if (!sourceUrl) {
      setError("Upload a product image first");
      return;
    }
    setLoading(true);
    setError(null);
    setResultUrl(null);

    try {
      // 1) Submit — returns request_id (fal queue)
      const submit = await trackApiCall(
        "fal",
        "image_generation",
        "/api/fal/orbit",
        async () => {
          const r = await fetch("/api/fal/orbit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url: sourceUrl,
              horizontal_angle: orbit.horizontalAngle,
              vertical_angle: orbit.verticalAngle,
              zoom: orbit.zoom,
              output_format: "png",
              num_images: 1,
            }),
          });
          if (!r.ok) throw new Error((await r.json()).error || "submit failed");
          return r.json();
        },
        { costOverride: cost }
      );

      const requestId = submit.request_id as string;
      if (!requestId) throw new Error("No request_id returned");

      // 2) Poll every 2.5s until the job completes or we time out
      const deadline = Date.now() + 3 * 60 * 1000; // 3 min budget
      let done = false;
      let consecutiveNetworkErrors = 0;

      while (!done && Date.now() < deadline) {
        await new Promise((res) => setTimeout(res, 2500));

        // Protect against transient network errors during polling — don't
        // fail immediately, but bail after a few consecutive failures so
        // we never spin forever on a permanent network fault.
        let pollData: {
          status: string;
          images?: { url: string }[];
          error?: string;
        };
        try {
          const pollRes = await fetch(
            `/api/fal/orbit?request_id=${encodeURIComponent(requestId)}`
          );
          pollData = await pollRes.json();
          consecutiveNetworkErrors = 0;
        } catch (netErr) {
          consecutiveNetworkErrors++;
          console.warn(
            `[orbit] poll network error ${consecutiveNetworkErrors}/3:`,
            netErr
          );
          if (consecutiveNetworkErrors >= 3) {
            setError("Network error while checking generation status. Try again.");
            done = true;
            break;
          }
          continue;
        }

        console.log(`[orbit] poll status=${pollData.status}`, pollData);

        if (pollData.status === "success") {
          const imgUrl = pollData.images?.[0]?.url;
          if (imgUrl) {
            setResultUrl(imgUrl);
            addHistory({
              id: crypto.randomUUID(),
              sourceUrl: sourceUrl || "",
              resultUrl: imgUrl,
              profileId: "",
              mode: "image",
              prompt: `Orbit ${orbit.horizontalAngle}°/${orbit.verticalAngle}° · ${orbit.zoom.toFixed(1)}×`,
              timestamp: Date.now(),
              source: "studio",
            });
          } else {
            setError("No image returned from the model.");
          }
          done = true;
        } else if (pollData.status === "fail") {
          // Surface fal's actual error message (content policy, safety filter,
          // validation failure, etc.) instead of a generic "failed" string.
          setError(pollData.error || "Generation failed");
          done = true;
        } else if (pollData.status !== "pending" && pollData.status !== "processing") {
          // Unknown status — treat as fail with the raw value so we stop
          // polling instead of spinning forever.
          console.error("[orbit] unknown status from /api/fal/orbit:", pollData);
          setError(`Unexpected status: ${pollData.status || "unknown"}`);
          done = true;
        }
        // else: "pending" | "processing" — keep polling
      }

      if (!done) {
        setError(
          "Timed out after 3 minutes. The job may still finish on fal.ai — try again or check your fal dashboard."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const resetOrbit = () => setOrbit({ horizontalAngle: 0, verticalAngle: 0, zoom: 5 });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">{tm("orbit.title", "Orbit Camera")}</h1>
        <span className="text-xs text-muted">
          {tm("orbit.subtitle", "Drag the camera to pick any angle, then generate.")}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Left: Source image + orbit control + settings ── */}
        <div className="space-y-4">
          {/* Upload */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {tm("orbit.source", "Product Image")}
            </h2>

            {/* Single hidden input — stays mounted the whole session so the
                ref never detaches. This is the key to making re-uploads work
                without a page refresh. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onFileInputChange}
            />

            {sourceUrl ? (
              <div
                className="relative aspect-square w-40 rounded-xl overflow-hidden border border-border group cursor-pointer"
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={openFilePicker}
                title={tm("orbit.replace", "Click or drop to replace")}
              >
                <Image src={sourceUrl} alt="" fill className="object-cover" unoptimized />
                {/* Hover overlay — shows "Replace" affordance */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <div className="text-white text-xs font-medium flex items-center gap-1.5">
                    <Upload className="w-4 h-4" />
                    {tm("orbit.replace", "Replace")}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSourceUrl(null);
                    setResultUrl(null);
                    setError(null);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 rounded bg-black/60 text-white hover:bg-red-500/80 z-10"
                  title={tm("orbit.remove", "Remove")}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={openFilePicker}
                className="aspect-square w-40 rounded-xl border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-accent/40 transition-colors"
              >
                {uploading ? (
                  <Loader2 className="w-6 h-6 animate-spin text-muted" />
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted text-xs">
                    <Upload className="w-5 h-5" />
                    {tm("orbit.upload", "Upload")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Orbit camera control */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
                {tm("orbit.camera", "Camera Angle")}
              </h2>
              <button
                onClick={resetOrbit}
                className="flex items-center gap-1 text-[11px] text-muted hover:text-foreground"
              >
                <RotateCcw className="w-3 h-3" />
                {tm("orbit.reset", "Reset")}
              </button>
            </div>

            <OrbitCameraControl
              value={orbit}
              onChange={setOrbit}
              productImageUrl={sourceUrl}
            />

            {/* Preset pills */}
            <div className="mt-3">
              <div className="text-[10px] uppercase font-semibold text-muted mb-1.5 tracking-wider">
                {tm("orbit.presets", "Presets")}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((p) => {
                  const active =
                    p.params.horizontalAngle === orbit.horizontalAngle &&
                    p.params.verticalAngle === orbit.verticalAngle &&
                    p.params.zoom === orbit.zoom;
                  return (
                    <button
                      key={p.label}
                      onClick={() => setOrbit(p.params)}
                      className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                        active
                          ? "bg-accent text-white border-accent"
                          : "bg-card border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Numeric fallback for accessibility */}
            <details className="mt-3 text-[11px]">
              <summary className="cursor-pointer text-muted hover:text-foreground">
                {tm("orbit.numeric", "Numeric controls")}
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <label className="block">
                  <div className="text-muted mb-0.5">Horizontal (0–360)</div>
                  <input
                    type="number"
                    min={0}
                    max={359}
                    step={5}
                    value={orbit.horizontalAngle}
                    onChange={(e) =>
                      setOrbit({ ...orbit, horizontalAngle: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                  />
                </label>
                <label className="block">
                  <div className="text-muted mb-0.5">Vertical (−30 to 90)</div>
                  <input
                    type="number"
                    min={-30}
                    max={90}
                    step={5}
                    value={orbit.verticalAngle}
                    onChange={(e) =>
                      setOrbit({ ...orbit, verticalAngle: Number(e.target.value) })
                    }
                    className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                  />
                </label>
                <label className="block">
                  <div className="text-muted mb-0.5">Zoom (0–10)</div>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    step={0.5}
                    value={orbit.zoom}
                    onChange={(e) => setOrbit({ ...orbit, zoom: Number(e.target.value) })}
                    className="w-full px-2 py-1 rounded border border-border bg-background text-xs"
                  />
                </label>
              </div>
            </details>
          </div>

          {/* Resolution + extra prompt + generate */}
          <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
            <div>
              <label className="text-[11px] uppercase font-semibold tracking-wider text-muted block mb-1.5">
                {tm("orbit.resolution", "Resolution")}
              </label>
              <select
                value={`${resolution.w}x${resolution.h}`}
                onChange={(e) => {
                  const [w, h] = e.target.value.split("x").map(Number);
                  const found = RESOLUTIONS.find((r) => r.w === w && r.h === h);
                  if (found) setResolution(found);
                }}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/40"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={`${r.w}x${r.h}`} value={`${r.w}x${r.h}`}>
                    {r.label} · ≈${resolutionCost(r.w, r.h).toFixed(2)}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerate}
              disabled={loading || !sourceUrl}
              className="w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-accent text-white text-sm font-semibold hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading
                ? tm("orbit.generating", "Generating…")
                : `${tm("orbit.generate", "Generate")} · $${cost.toFixed(2)}`}
            </button>

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
          </div>
        </div>

        {/* ── Right: Result ── */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            {tm("orbit.result", "Result")}
          </h2>
          <div className="aspect-square w-full rounded-xl border border-border bg-background overflow-hidden flex items-center justify-center">
            {resultUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultUrl} alt="" className="w-full h-full object-contain" />
            ) : error && !loading ? (
              <div className="text-center px-6 max-w-sm">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/15 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <p className="text-sm font-semibold text-red-500 mb-1">
                  {tm("orbit.errorTitle", "Generation failed")}
                </p>
                <p className="text-xs text-red-400/90 leading-relaxed">{error}</p>
              </div>
            ) : loading ? (
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto" />
                <div className="text-xs text-muted mt-2">
                  {tm("orbit.rendering", "Rendering from the selected angle…")}
                </div>
              </div>
            ) : (
              <div className="text-center text-muted text-sm">
                <Camera className="w-10 h-10 mx-auto mb-2 opacity-30" />
                {tm("orbit.placeholder", "Pick an angle and generate")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
