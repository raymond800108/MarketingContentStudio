"use client";

/**
 * UGC Studio — single-take UGC video pipeline.
 *
 * Flow:
 *   1. Pick family (UGC / Commercial / Cinematic)
 *   2. Pick archetype within family
 *   3. Upload product image
 *   4. Fill minimal brief (audience, benefit, platform, optional script)
 *   5. AI Enhance → generates {hook, script, cta, 3 keyframe prompts}
 *   6. Render 3 storyboard keyframes (nano-banana-2 with product as ref)
 *   7. Pick hero frame → generate video (Kling 3.0 i2v) + TTS voiceover
 *   8. Preview final video + audio
 */

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ARCHETYPES,
  FAMILY_META,
  archetypesByFamily,
  getArchetype,
  type ArchetypeFamily,
} from "@/lib/ugc/archetypes";
import { useUgcStore, type Keyframe, type VideoModel, type VoiceMode, type CreatorGender, type CreatorRace, VIDEO_MODEL_COST_USD, getActiveAngle } from "@/lib/stores/ugc-store";
import { trackApiCall } from "@/lib/stores/api-usage-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
import { pollManager } from "@/lib/poll-manager";
import { useI18nStore, useT, useTMaybe } from "@/lib/i18n";
import {
  Upload,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Loader2,
  Check,
  Film,
  Volume2,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  GripVertical,
  Plus,
  X,
  Image as ImageIcon,
  Clock,
} from "lucide-react";

const PLATFORM_RATIOS: Record<string, string> = {
  tiktok: "9:16",
  reels: "9:16",
  shorts: "9:16",
  "ig-post": "1:1",
};

const MAX_POLL_MS = 5 * 60 * 1000;

export default function UgcStudioPage() {
  const {
    step,
    family,
    archetypeId,
    creatorOverrides,
    productImageUrl,
    endFrameUrl,
    videoModel,
    voiceMode,
    input,
    brief,
    keyframes,
    heroFrameIndex,
    videoTaskId,
    videoUrl,
    videoStatus,
    videoError,
    ttsUrl,
    ttsStatus,
    ttsError,
    setStep,
    setFamily,
    setArchetypeId,
    setCreatorOverrides,
    setProductImageUrl,
    setEndFrameUrl,
    setVideoModel,
    setVoiceMode,
    setInput,
    setBrief,
    setSelectedAngle,
    setKeyframes,
    patchKeyframe,
    setHeroFrameIndex,
    setVideo,
    setTts,
    reset,
  } = useUgcStore();

  const isSeedance = videoModel === "seedance-2" || videoModel === "seedance-2-fast";
  const activeAngle = getActiveAngle(brief);
  const spokenLine = activeAngle?.fullScript || "";

  const { locale } = useI18nStore();
  const t = useT();
  const tM = useTMaybe();
  const archetype = useMemo(() => getArchetype(archetypeId), [archetypeId]);
  // For Kling: 3 narrative beats. For Seedance: 3 multimodal reference roles.
  const frameLabel = (i: number) => {
    const klingKeys = ["ugc.story.hook", "ugc.story.demo", "ugc.story.cta"] as const;
    const seedanceKeys = ["ugc.ref.creator", "ugc.ref.product", "ugc.ref.scene"] as const;
    return t((isSeedance ? seedanceKeys : klingKeys)[i] || klingKeys[0]);
  };
  const [uploading, setUploading] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [showVideoPrompt, setShowVideoPrompt] = useState(false);
  const [editedVideoPrompt, setEditedVideoPrompt] = useState<string | null>(null);
  const [enhancingPrompt, setEnhancingPrompt] = useState(false);
  const [showContentLibrary, setShowContentLibrary] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const contentHistory = useGenerationStore((s) => s.history).filter((h) => h.mode === "image" && h.resultUrl);
  const [editedScript, setEditedScript] = useState<string | null>(null);
  const [enhancingScript, setEnhancingScript] = useState(false);
  // Reset edited script when angle changes
  const activeAngleIdx = brief?.selectedAngleIndex ?? 0;
  useEffect(() => { setEditedScript(null); }, [activeAngleIdx]);
  // Sync editedVideoPrompt when brief changes (new generation or angle switch)
  const currentBasePrompt = brief?.videoPrompt || "";
  useEffect(() => {
    setEditedVideoPrompt(null); // reset to use brief's prompt
  }, [currentBasePrompt]);

  async function enhanceVideoPrompt() {
    if (!archetype || !brief) return;
    setEnhancingPrompt(true);
    try {
      const currentPrompt = editedVideoPrompt ?? brief.videoPrompt ?? "";
      const kfUrls = keyframes.map((k) => k.imageUrl || "").filter(Boolean);
      const res = await fetch("/api/ugc/enhance-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPrompt,
          keyframeUrls: kfUrls,
          videoModel,
          archetypeName: archetype.name,
          archetypeFamily: archetype.family,
          stylePrompt: archetype.stylePrompt,
          motionPrompt: archetype.motionPrompt,
          // Pass the latest script so the video prompt aligns with the voiceover
          script: effectiveScript,
          language: locale === "zh-TW" ? "Traditional Chinese (繁體中文)" : locale === "de" ? "German (Deutsch)" : "English",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      setEditedVideoPrompt(data.prompt);
      setShowVideoPrompt(true);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Enhance failed");
    } finally {
      setEnhancingPrompt(false);
    }
  }

  async function enhanceScript() {
    if (!archetype || !activeAngle) return;
    setEnhancingScript(true);
    try {
      const kfUrls = keyframes.map((k) => k.imageUrl || "").filter(Boolean);
      const res = await fetch("/api/ugc/enhance-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hook: activeAngle.hook,
          benefit: activeAngle.benefit,
          problemSolve: activeAngle.problemSolve,
          cta: activeAngle.cta,
          currentScript: editedScript ?? activeAngle.fullScript,
          keyframeUrls: kfUrls,
          archetypeName: archetype.name,
          archetypeFamily: archetype.family,
          voiceTone: archetype.voiceTone,
          language: locale === "zh-TW" ? "Traditional Chinese (繁體中文)" : locale === "de" ? "German (Deutsch)" : "English",
          // Pass the video prompt so the script aligns with the visual direction
          videoPrompt: editedVideoPrompt ?? brief?.videoPrompt ?? "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enhance failed");
      setEditedScript(data.script);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : "Script enhance failed");
    } finally {
      setEnhancingScript(false);
    }
  }

  // The effective spoken line — use edited script if available
  const effectiveScript = editedScript ?? spokenLine;

  // ─── Frame management helpers ───

  function addFrameFromHistory(resultUrl: string) {
    const newIndex = keyframes.length;
    const newFrame: Keyframe = {
      index: newIndex,
      label: `Added ${newIndex + 1}`,
      prompt: "User-added frame from content library",
      imageUrl: resultUrl,
      imageInputs: [],
      status: "ready" as const,
    };
    setKeyframes([...keyframes, newFrame]);
  }

  function removeFrame(index: number) {
    if (keyframes.length <= 1) return; // keep at least 1
    const updated = keyframes
      .filter((k) => k.index !== index)
      .map((k, i) => ({ ...k, index: i }));
    setKeyframes(updated);
    // Adjust hero frame if needed
    if (heroFrameIndex >= updated.length) {
      setHeroFrameIndex(Math.max(0, updated.length - 1));
    } else if (heroFrameIndex === index) {
      setHeroFrameIndex(0);
    }
  }

  function handleFrameDragStart(index: number) {
    setDragIndex(index);
  }
  function handleFrameDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    setDragOverIndex(index);
  }
  function handleFrameDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const items = [...keyframes];
    const [dragged] = items.splice(dragIndex, 1);
    items.splice(targetIndex, 0, dragged);
    // Re-index and update hero
    const reindexed = items.map((k, i) => ({ ...k, index: i }));
    setKeyframes(reindexed);
    // Track hero: if the hero was the dragged item, follow it
    if (heroFrameIndex === dragIndex) {
      setHeroFrameIndex(targetIndex);
    } else if (dragIndex < heroFrameIndex && targetIndex >= heroFrameIndex) {
      setHeroFrameIndex(heroFrameIndex - 1);
    } else if (dragIndex > heroFrameIndex && targetIndex <= heroFrameIndex) {
      setHeroFrameIndex(heroFrameIndex + 1);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  }
  function handleFrameDragEnd() {
    setDragIndex(null);
    setDragOverIndex(null);
  }

  // ─── Helpers ───

  async function uploadFile(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await trackApiCall("fal", "file_upload", "/api/upload", async () => {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    });
    return res.url as string;
  }

  async function uploadProduct(file: File) {
    setUploading(true);
    setGenError(null);
    try {
      const url = await uploadFile(file);
      setProductImageUrl(url);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("ugc.err.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function uploadEndFrame(file: File) {
    setGenError(null);
    try {
      const url = await uploadFile(file);
      setEndFrameUrl(url);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("ugc.err.uploadFailed"));
    }
  }

  async function runBrief() {
    if (!archetypeId || !productImageUrl) return;
    setBriefing(true);
    setGenError(null);
    try {
      const res = await fetch("/api/ugc/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productImageUrl,
          archetypeId,
          input,
          creatorOverrides,
          locale,
          videoModel,
          voiceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("ugc.err.briefFailed"));
      setBrief(data.brief);
      // Stage keyframes. For Seedance, each role gets a DIFFERENT image-input
      // set — Scene must render without the product ref to avoid Kie's content
      // policy rejecting the "no product, no people" prompt when the product
      // image is passed in.
      // Labels depend on family + video model
      const labelMap: Record<string, string[]> = {
        "ugc-kling": ["Hook", "Demo", "CTA"],
        "ugc-seedance": ["Creator", "Product", "Scene"],
        "commercial-kling": ["Hero", "Action", "Reveal"],
        "commercial-seedance": ["Hero", "Action", "Reveal"],
        "cinematic-kling": ["Scene", "Discovery", "Resolution"],
        "cinematic-seedance": ["Scene", "Discovery", "Resolution"],
      };
      const labelKey = `${family}-${isSeedance ? "seedance" : "kling"}`;
      const labels = labelMap[labelKey] || (isSeedance ? ["Ref 1", "Ref 2", "Ref 3"] : ["Frame 1", "Frame 2", "Frame 3"]);
      // Determine per-frame image inputs based on family + video model.
      // Commercial & cinematic: ALL frames reference the product (they're
      // product-hero macro shots or story beats featuring the product).
      // UGC + Seedance: Scene plate (frame 2) is empty to avoid Kie rejecting
      // the "no product" prompt when product ref is present.
      const isProductFamily = family === "commercial" || family === "cinematic";
      const frames: Keyframe[] = data.brief.keyframePrompts.map(
        (p: string, i: number) => ({
          index: i,
          label: labels[i] || `Frame ${i + 1}`,
          prompt: p,
          imageInputs: isProductFamily
            ? (productImageUrl ? [productImageUrl] : [])
            : isSeedance
              ? (i === 2 ? [] : productImageUrl ? [productImageUrl] : [])
              : productImageUrl ? [productImageUrl] : [],
          status: "idle",
        })
      );
      setKeyframes(frames);
      setStep("storyboard");
      // Fire all 3 keyframe generations in parallel
      frames.forEach((f) => generateKeyframe(f.index, f.prompt, f.imageInputs));
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("ugc.err.briefFailed"));
    } finally {
      setBriefing(false);
    }
  }

  async function generateKeyframe(index: number, prompt: string, imageInputs?: string[]) {
    if (!productImageUrl) return;
    // Default to product ref if caller didn't specify (backcompat for manual retries).
    const inputs = imageInputs ?? [productImageUrl];
    patchKeyframe(index, {
      status: "pending",
      error: undefined,
      imageUrl: undefined,
      prompt,
      imageInputs: inputs,
    });
    try {
      const ratio = PLATFORM_RATIOS[input.platform] || "9:16";
      const data = await trackApiCall("kie", "image_generation", "/api/kie", async () => {
        const r = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image",
            prompt,
            aspect_ratio: ratio,
            resolution: "2K",
            output_format: "jpg",
            image_input: inputs,
          }),
        });
        if (!r.ok) throw new Error((await r.json()).error || "kie failed");
        return r.json();
      });
      const taskId = data.taskId as string;
      patchKeyframe(index, { taskId });
      pollImage(index, taskId);
    } catch (e) {
      patchKeyframe(index, { status: "error", error: e instanceof Error ? e.message : "failed" });
    }
  }

  function pollImage(index: number, taskId: string) {
    pollManager.start({
      taskId,
      type: "image",
      intervalMs: 3000,
      budgetMs: MAX_POLL_MS,
      callbacks: {
        onSuccess: (d) => {
          const imgUrl = (d as { images?: { url: string }[] }).images?.[0]?.url;
          if (imgUrl) {
            useUgcStore.getState().patchKeyframe(index, { status: "ready", imageUrl: imgUrl });
            useGenerationStore.getState().addHistory({
              id: crypto.randomUUID(),
              sourceUrl: useUgcStore.getState().productImageUrl || "",
              resultUrl: imgUrl,
              profileId: "",
              mode: "image",
              prompt: `UGC keyframe ${index + 1}`,
              timestamp: Date.now(),
              source: "ugc",
              ugc: { archetypeId: useUgcStore.getState().archetypeId || undefined },
            });
          } else {
            useUgcStore.getState().patchKeyframe(index, { status: "error", error: "No image returned" });
          }
        },
        onError: (err) => {
          useUgcStore.getState().patchKeyframe(index, { status: "error", error: err });
        },
      },
    });
  }

  async function generateVideoAndTts() {
    if (!brief || !archetype) return;

    // For Seedance we need ALL 3 references ready (creator/product/scene).
    // For Kling we just need ONE hero keyframe.
    if (isSeedance) {
      const missing = keyframes.filter((k) => !k.imageUrl);
      if (missing.length > 0) {
        setGenError(t("ugc.err.allRefsNeeded"));
        return;
      }
    } else {
      const hero = keyframes[heroFrameIndex];
      if (!hero?.imageUrl) {
        setGenError(t("ugc.err.pickHero"));
        return;
      }
    }

    const isTextOverlay = voiceMode === "text-overlay";

    setStep("video");
    setVideo({ videoStatus: "pending", videoError: null, videoUrl: null, videoTaskId: null });
    if (!isTextOverlay) {
      setTts({ ttsStatus: "pending", ttsError: null, ttsUrl: null });
    } else {
      setTts({ ttsStatus: "ready", ttsError: null, ttsUrl: null, ttsDurationSec: null });
    }

    // 1) Generate TTS FIRST — SKIP entirely in text-overlay mode.
    //    For Seedance, the audio URL is an INPUT to the video model (lip-sync).
    //    For Kling, TTS runs in parallel since the video is silent.
    let ttsUrlLocal: string | null = null;
    if (isTextOverlay) {
      // No TTS needed — text appears on screen instead
    } else if (isSeedance) {
      try {
        const r = await fetch("/api/ugc/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: effectiveScript,
            voice: archetype.ttsVoice,
            voiceTone: archetype.voiceTone,
            angle: activeAngle ? {
              name: activeAngle.name,
              hook: activeAngle.hook,
              benefit: activeAngle.benefit,
              problemSolve: activeAngle.problemSolve,
              cta: activeAngle.cta,
            } : undefined,
            language: locale === "zh-TW" ? "Traditional Chinese (繁體中文)" : locale === "de" ? "German (Deutsch)" : "English",
            creatorOverrides,
          }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "tts failed");
        setTts({ ttsStatus: "ready", ttsUrl: d.url, ttsDurationSec: d.durationSec });
        ttsUrlLocal = d.url;
      } catch (e) {
        setTts({ ttsStatus: "error", ttsError: e instanceof Error ? e.message : "tts failed" });
        setVideo({ videoStatus: "error", videoError: "TTS failed — cannot drive Seedance lip-sync" });
        return;
      }
    } else {
      // Kling: fire TTS in parallel — not an input to the model
      (async () => {
        try {
          const r = await fetch("/api/ugc/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
            text: effectiveScript,
            voice: archetype.ttsVoice,
            voiceTone: archetype.voiceTone,
            angle: activeAngle ? {
              name: activeAngle.name,
              hook: activeAngle.hook,
              benefit: activeAngle.benefit,
              problemSolve: activeAngle.problemSolve,
              cta: activeAngle.cta,
            } : undefined,
            language: locale === "zh-TW" ? "Traditional Chinese (繁體中文)" : locale === "de" ? "German (Deutsch)" : "English",
            creatorOverrides,
          }),
          });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "tts failed");
          setTts({ ttsStatus: "ready", ttsUrl: d.url, ttsDurationSec: d.durationSec });
        } catch (e) {
          setTts({ ttsStatus: "error", ttsError: e instanceof Error ? e.message : "tts failed" });
        }
      })();
    }

    // 2) Fire the video call.
    try {
      const ratio = PLATFORM_RATIOS[input.platform] || "9:16";

      let requestBody: Record<string, unknown>;
      if (isSeedance) {
        // Seedance multimodal: pass all 3 image refs + TTS audio for lip-sync.
        // videoPrompt uses [Image1/2/3] bracket tokens produced by the brief API.
        const refs = keyframes.map((k) => k.imageUrl!).filter(Boolean);
        const basePrompt =
          (editedVideoPrompt ?? brief.videoPrompt) ||
          `[Image1] speaks naturally to camera while presenting [Image2] in the setting shown in [Image3].`;
        const videoPrompt = `${basePrompt} They say the following line naturally: "${effectiveScript}"`;

        requestBody = {
          type: "video",
          video_model: videoModel,
          prompt: videoPrompt,
          aspect_ratio: ratio,
          resolution: "720p",
          duration: brief.durationSec || 8,
          generate_audio: true,
          reference_image_urls: refs,
          reference_audio_urls: ttsUrlLocal ? [ttsUrlLocal] : [],
        };
      } else {
        // Kling i2v from hero keyframe
        const hero = keyframes[heroFrameIndex];
        const basePrompt =
          (editedVideoPrompt ?? brief.videoPrompt) ||
          [archetype.creatorPrompt, archetype.motionPrompt, "speaking naturally to camera"]
            .filter(Boolean)
            .join(". ");
        const videoPrompt = `${basePrompt}. Hook: ${activeAngle?.hook || ""}. They say: "${effectiveScript}"`;

        requestBody = {
          type: "video",
          video_model: "kling-3.0",
          prompt: videoPrompt,
          aspect_ratio: ratio,
          reference_image: hero.imageUrl,
        };
      }

      const data = await trackApiCall("kie", "video_generation", "/api/kie", async () => {
        const r = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!r.ok) throw new Error((await r.json()).error || "kie failed");
        return r.json();
      });
      const taskId = data.taskId as string;
      setVideo({ videoTaskId: taskId });
      pollVideo(taskId);
    } catch (e) {
      setVideo({ videoStatus: "error", videoError: e instanceof Error ? e.message : "video failed" });
    }
  }

  function pollVideo(taskId: string) {
    const seedance = useUgcStore.getState().videoModel === "seedance-2" ||
                     useUgcStore.getState().videoModel === "seedance-2-fast";
    pollManager.start({
      taskId,
      type: "video",
      intervalMs: seedance ? 10000 : 5000,
      budgetMs: seedance ? 10 * 60 * 1000 : MAX_POLL_MS,
      callbacks: {
        onSuccess: (d) => {
          const vidUrl = (d as { videos?: { url: string }[] }).videos?.[0]?.url;
          if (!vidUrl) {
            useUgcStore.getState().setVideo({ videoStatus: "error", videoError: "No video returned" });
            return;
          }
          useUgcStore.getState().setVideo({ videoStatus: "ready", videoUrl: vidUrl });
          // Save to content history
          const st = useUgcStore.getState();
          const angle = getActiveAngle(st.brief);
          useGenerationStore.getState().addHistory({
            id: crypto.randomUUID(),
            sourceUrl: st.productImageUrl || "",
            resultUrl: vidUrl,
            profileId: "",
            mode: "video",
            prompt: angle?.fullScript || "",
            timestamp: Date.now(),
            source: "ugc",
            ugc: {
              angleName: angle?.name,
              script: angle?.fullScript,
              ttsUrl: st.ttsUrl || undefined,
              archetypeId: st.archetypeId || undefined,
              keyframeUrls: st.keyframes.filter((k) => k.imageUrl).map((k) => k.imageUrl!),
            },
          });
          // TTS audio is part of the video — no separate history entry needed.
          useUgcStore.getState().setStep("done");
        },
        onError: (err) => {
          useUgcStore.getState().setVideo({ videoStatus: "error", videoError: err });
        },
      },
    });
  }

  // ─── Resume pending polls on mount (user navigated away and came back) ───

  useEffect(() => {
    // Resume keyframe polls
    for (const k of keyframes) {
      if (k.status === "pending" && k.taskId && !pollManager.isPolling(k.taskId)) {
        pollImage(k.index, k.taskId);
      }
    }
    // Resume video poll
    if (videoStatus === "pending" && videoTaskId && !pollManager.isPolling(videoTaskId)) {
      pollVideo(videoTaskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Step guards ───

  useEffect(() => {
    // Auto-advance from family → archetype once family picked but archetype empty
    if (step === "family" && family) setStep("archetype");
  }, [step, family, setStep]);

  // ─── UI ───

  const stepNum = (
    { family: 1, archetype: 2, product: 3, brief: 4, storyboard: 5, video: 6, done: 6 } as const
  )[step];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Film className="w-6 h-6 text-accent" />
            {t("ugc.title")}
          </h1>
          <p className="text-sm text-muted mt-1">
            {t("ugc.subtitle")}
          </p>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted hover:text-foreground border border-border rounded-lg"
          title={t("ugc.resetTitle")}
        >
          <RotateCcw className="w-3.5 h-3.5" /> {t("ugc.reset")}
        </button>
      </div>

      {/* Step progress */}
      <div className="flex items-center gap-2 mb-8 text-xs">
        {([
          t("ugc.step.family"),
          t("ugc.step.archetype"),
          t("ugc.step.product"),
          t("ugc.step.brief"),
          t("ugc.step.storyboard"),
          t("ugc.step.video"),
        ]).map((l, i) => {
          const active = stepNum === i + 1;
          const done = stepNum > i + 1;
          return (
            <div key={l} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-medium ${
                  done ? "bg-accent text-white" : active ? "bg-primary text-white" : "bg-card text-muted border border-border"
                }`}
              >
                {done ? <Check className="w-3 h-3" /> : i + 1}
              </div>
              <span className={active ? "text-foreground font-medium" : "text-muted"}>{l}</span>
              {i < 5 && <div className="w-6 h-px bg-border" />}
            </div>
          );
        })}
      </div>

      {genError && (
        <div className="mb-4 px-4 py-2.5 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20">
          {genError}
        </div>
      )}

      {/* ─── Step 1: Family ─── */}
      {step === "family" && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {(Object.keys(FAMILY_META) as ArchetypeFamily[]).map((f) => {
            const meta = FAMILY_META[f];
            return (
              <button
                key={f}
                onClick={() => { setFamily(f); setStep("archetype"); }}
                className="p-6 rounded-2xl border border-border bg-card hover:border-accent hover:bg-card-hover transition-all text-left"
              >
                <div className="text-4xl mb-3">{meta.emoji}</div>
                <div className="font-semibold text-lg">{tM(`ugc.family.${f}.name`, meta.name)}</div>
                <div className="text-sm text-muted mt-1">{tM(`ugc.family.${f}.tagline`, meta.tagline)}</div>
              </button>
            );
          })}
        </div>
      )}

      {/* ─── Step 2: Archetype ─── */}
      {step === "archetype" && family && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("ugc.family.pick")}</h2>
            <button onClick={() => { setFamily(null); setStep("family"); }} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ugc.family.change")}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {archetypesByFamily(family).map((a) => {
              const selected = archetypeId === a.id;
              return (
                <button
                  key={a.id}
                  onClick={() => setArchetypeId(a.id)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    selected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-card hover:border-border-hover"
                  }`}
                >
                  <div className="font-medium">{tM(`ugc.arch.${a.id}.name`, a.name)}</div>
                  <div className="text-xs text-muted mt-1">{tM(`ugc.arch.${a.id}.desc`, a.description)}</div>
                </button>
              );
            })}
          </div>

          {/* Creator customization (age / gender / race) — applied on top of
              the chosen archetype's built-in creator description. */}
          {archetypeId && (
            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              <div className="mb-1 text-sm font-semibold">{t("ugc.creator.customize")}</div>
              <div className="mb-4 text-xs text-muted">{t("ugc.creator.customizeHint")}</div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Age */}
                <Field label={t("ugc.creator.age")}>
                  <input
                    value={creatorOverrides.age}
                    onChange={(e) => setCreatorOverrides({ age: e.target.value })}
                    placeholder={t("ugc.creator.agePh")}
                    className="inp"
                  />
                </Field>

                {/* Gender */}
                <Field label={t("ugc.creator.gender")}>
                  <div className="flex flex-wrap gap-1.5">
                    {([
                      { id: "any", key: "ugc.creator.gender.any" },
                      { id: "female", key: "ugc.creator.gender.female" },
                      { id: "male", key: "ugc.creator.gender.male" },
                      { id: "nonbinary", key: "ugc.creator.gender.nonbinary" },
                    ] as const).map((g) => {
                      const active = creatorOverrides.gender === g.id;
                      return (
                        <button
                          key={g.id}
                          onClick={() => setCreatorOverrides({ gender: g.id as CreatorGender })}
                          className={`px-2.5 py-1 text-xs rounded-md border ${
                            active ? "bg-primary text-white border-primary" : "border-border hover:border-border-hover"
                          }`}
                        >
                          {t(g.key)}
                        </button>
                      );
                    })}
                  </div>
                </Field>

                {/* Race */}
                <Field label={t("ugc.creator.race")}>
                  <select
                    value={creatorOverrides.race}
                    onChange={(e) => setCreatorOverrides({ race: e.target.value as CreatorRace })}
                    className="inp"
                  >
                    <option value="any">{t("ugc.creator.race.any")}</option>
                    <option value="east-asian">{t("ugc.creator.race.eastAsian")}</option>
                    <option value="southeast-asian">{t("ugc.creator.race.seAsian")}</option>
                    <option value="south-asian">{t("ugc.creator.race.sAsian")}</option>
                    <option value="white">{t("ugc.creator.race.white")}</option>
                    <option value="black">{t("ugc.creator.race.black")}</option>
                    <option value="latino">{t("ugc.creator.race.latino")}</option>
                    <option value="middle-eastern">{t("ugc.creator.race.middleEastern")}</option>
                  </select>
                </Field>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setStep("product")}
                  className="px-4 py-2 text-sm bg-primary text-white rounded-lg flex items-center gap-1.5"
                >
                  {t("ugc.product.next")} <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Step 3: Product upload ─── */}
      {step === "product" && archetype && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("ugc.product.upload")}</h2>
            <button onClick={() => setStep("archetype")} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ugc.archetype.change")}
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            {productImageUrl ? (
              <div className="flex items-start gap-4">
                <div className="relative w-40 h-40 rounded-lg overflow-hidden bg-background">
                  <Image src={productImageUrl} alt="product" fill className="object-cover" unoptimized />
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted mb-2">{t("ugc.product.creator")}: {tM(`ugc.arch.${archetype.id}.name`, archetype.name)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="px-3 py-1.5 text-sm border border-border rounded-lg hover:border-border-hover"
                    >
                      {t("ugc.product.replace")}
                    </button>
                    <button
                      onClick={() => setStep("brief")}
                      className="px-4 py-1.5 text-sm bg-primary text-white rounded-lg flex items-center gap-1.5"
                    >
                      {t("ugc.product.next")} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-border rounded-xl py-12 flex flex-col items-center gap-2 hover:border-accent transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                ) : (
                  <Upload className="w-8 h-8 text-muted" />
                )}
                <div className="text-sm font-medium">
                  {uploading ? t("ugc.product.uploading") : t("ugc.product.clickUpload")}
                </div>
                <div className="text-xs text-muted">{t("ugc.product.hint")}</div>
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadProduct(f); }}
            />
          </div>
        </div>
      )}

      {/* ─── Step 4: Brief ─── */}
      {step === "brief" && archetype && productImageUrl && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("ugc.brief.title")}</h2>
            <button onClick={() => setStep("product")} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ugc.product.back")}
            </button>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t("ugc.brief.audience")}>
                <input
                  value={input.audience}
                  onChange={(e) => setInput({ audience: e.target.value })}
                  placeholder={t("ugc.brief.audiencePh")}
                  className="inp"
                />
              </Field>
              <Field label={t("ugc.brief.benefit")}>
                <input
                  value={input.benefit}
                  onChange={(e) => setInput({ benefit: e.target.value })}
                  placeholder={t("ugc.brief.benefitPh")}
                  className="inp"
                />
              </Field>
            </div>
            <Field label={t("ugc.brief.platform")}>
              <div className="flex gap-2">
                {(["tiktok", "reels", "shorts", "ig-post"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setInput({ platform: p })}
                    className={`px-3 py-1.5 text-sm rounded-lg border ${
                      input.platform === p
                        ? "bg-primary text-white border-primary"
                        : "border-border hover:border-border-hover"
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </Field>
            <Field label={t("ugc.brief.script")}>
              <textarea
                value={input.userScript}
                onChange={(e) => setInput({ userScript: e.target.value })}
                placeholder={t("ugc.brief.scriptPh")}
                rows={3}
                className="inp resize-none"
              />
            </Field>
            <Field label={t("ugc.brief.notes")}>
              <input
                value={input.productNotes}
                onChange={(e) => setInput({ productNotes: e.target.value })}
                placeholder={t("ugc.brief.notesPh")}
                className="inp"
              />
            </Field>
            <Field label={t("ugc.model.label")}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {([
                  { id: "seedance-2-fast", titleKey: "ugc.model.seedanceFast.title", descKey: "ugc.model.seedanceFast.desc" },
                  { id: "seedance-2", titleKey: "ugc.model.seedance.title", descKey: "ugc.model.seedance.desc" },
                  { id: "kling-3.0", titleKey: "ugc.model.kling.title", descKey: "ugc.model.kling.desc" },
                ] as const).map((m) => {
                  const active = videoModel === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => setVideoModel(m.id as VideoModel)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        active ? "border-accent bg-accent/10" : "border-border hover:border-border-hover"
                      }`}
                    >
                      <div className="text-sm font-medium flex items-center justify-between">
                        <span>{t(m.titleKey)}</span>
                        <span className="text-[11px] text-muted font-mono">≈${VIDEO_MODEL_COST_USD[m.id as VideoModel].toFixed(2)}</span>
                      </div>
                      <div className="text-[11px] text-muted mt-1 leading-snug">{t(m.descKey)}</div>
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t("ugc.voice.label")}>
              <div className="flex gap-2">
                {([
                  { id: "voiceover", key: "ugc.voice.voiceover" },
                  { id: "text-overlay", key: "ugc.voice.textOverlay" },
                ] as const).map((v) => {
                  const active = voiceMode === v.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => setVoiceMode(v.id as VoiceMode)}
                      className={`px-3 py-1.5 text-sm rounded-lg border ${
                        active ? "bg-primary text-white border-primary" : "border-border hover:border-border-hover"
                      }`}
                    >
                      {t(v.key)}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] text-muted mt-1">
                {voiceMode === "text-overlay" ? t("ugc.voice.textOverlayHint") : t("ugc.voice.voiceoverHint")}
              </div>
            </Field>
            <div className="pt-2 flex justify-end">
              <button
                onClick={runBrief}
                disabled={briefing || !input.audience.trim() || !input.benefit.trim()}
                className="px-5 py-2 rounded-lg bg-accent text-white flex items-center gap-2 disabled:opacity-50"
              >
                {briefing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {t("ugc.brief.enhance")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Step 5: Storyboard ─── */}
      {step === "storyboard" && brief && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isSeedance ? t("ugc.story.titleSeedance") : t("ugc.story.title")}
            </h2>
            <button onClick={() => setStep("brief")} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ugc.story.back")}
            </button>
          </div>

          {/* Angle picker — 3 distinct marketing angles */}
          {brief.angles && brief.angles.length > 0 && (
            <div className="mb-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                {t("ugc.angle.pick")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                {brief.angles.map((a, i) => {
                  const selected = i === (brief.selectedAngleIndex ?? 0);
                  return (
                    <button
                      key={i}
                      onClick={() => setSelectedAngle(i)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        selected ? "border-accent bg-accent/10 ring-1 ring-accent/40" : "border-border bg-card hover:border-border-hover"
                      }`}
                    >
                      <div className="text-[11px] uppercase tracking-wider text-muted mb-1">
                        {t("ugc.angle.label")} {i + 1}
                      </div>
                      <div className="text-sm font-semibold mb-1.5 line-clamp-1">{a.name}</div>
                      <div className="text-xs text-muted line-clamp-2">{a.hook}</div>
                    </button>
                  );
                })}
              </div>
              {activeAngle && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-1.5">
                  <div className="text-xs">
                    <span className="font-semibold text-muted uppercase tracking-wider mr-2">{t("ugc.angle.hook")}:</span>
                    {activeAngle.hook}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-muted uppercase tracking-wider mr-2">{t("ugc.angle.benefit")}:</span>
                    {activeAngle.benefit}
                  </div>
                  <div className="text-xs">
                    <span className="font-semibold text-muted uppercase tracking-wider mr-2">{t("ugc.angle.solves")}:</span>
                    {activeAngle.problemSolve}
                  </div>
                  <div className="text-xs text-accent">
                    <span className="font-semibold uppercase tracking-wider mr-2">{t("ugc.angle.cta")}:</span>
                    {activeAngle.cta}
                  </div>
                  <div className="pt-2 mt-2 border-t border-border">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-[11px] uppercase tracking-wider text-muted">{t("ugc.story.script")}</div>
                      <div className="flex items-center gap-2">
                        {editedScript !== null && (
                          <button
                            onClick={() => setEditedScript(null)}
                            className="text-[11px] text-muted hover:text-foreground flex items-center gap-1"
                          >
                            <RotateCcw className="w-3 h-3" /> {t("ugc.story.reset")}
                          </button>
                        )}
                        <button
                          onClick={enhanceScript}
                          disabled={enhancingScript}
                          className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent text-[11px] font-medium flex items-center gap-1.5 hover:bg-accent/20 disabled:opacity-50 transition-colors"
                        >
                          {enhancingScript ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Sparkles className="w-3 h-3" />
                          )}
                          {t("ugc.aiEnhance")}
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={editedScript ?? activeAngle.fullScript}
                      onChange={(e) => setEditedScript(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-y"
                      placeholder="Script / voiceover text…"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Keyframes — drag-to-reorder, add/remove */}
          <div className="flex flex-wrap gap-4 mb-2">
            {keyframes.map((k, arrIdx) => {
              const selected = heroFrameIndex === k.index;
              const isDragging = dragIndex === arrIdx;
              const isDragOver = dragOverIndex === arrIdx;
              return (
                <div
                  key={`frame-${arrIdx}`}
                  draggable
                  onDragStart={() => handleFrameDragStart(arrIdx)}
                  onDragOver={(e) => handleFrameDragOver(e, arrIdx)}
                  onDrop={() => handleFrameDrop(arrIdx)}
                  onDragEnd={handleFrameDragEnd}
                  className={`w-[calc(33.333%-0.75rem)] min-w-[140px] rounded-xl border bg-card overflow-hidden transition-all
                    ${selected ? "border-accent ring-2 ring-accent/30" : "border-border"}
                    ${isDragging ? "opacity-40 scale-95" : ""}
                    ${isDragOver && !isDragging ? "ring-2 ring-accent/50 border-accent/50" : ""}
                  `}
                  style={{ flexShrink: 0 }}
                >
                  {/* Drag handle + remove */}
                  <div className="flex items-center justify-between px-2 py-1.5 bg-card-hover/50 cursor-grab active:cursor-grabbing">
                    <div className="flex items-center gap-1 text-muted">
                      <GripVertical className="w-3.5 h-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">
                        {t("ugc.story.frame")} {arrIdx + 1}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {k.status !== "pending" && (
                        <button
                          onClick={() => generateKeyframe(k.index, k.prompt, k.imageInputs)}
                          className="p-1 rounded hover:bg-background text-muted hover:text-foreground"
                          title={t("ugc.story.regen")}
                        >
                          <RefreshCw className="w-3 h-3" />
                        </button>
                      )}
                      {keyframes.length > 1 && (
                        <button
                          onClick={() => removeFrame(k.index)}
                          className="p-1 rounded hover:bg-red-500/10 text-muted hover:text-red-400"
                          title={t("ugc.story.removeFrame")}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => !isSeedance && k.status === "ready" && setHeroFrameIndex(k.index)}
                    className="block w-full aspect-[9/16] bg-background relative"
                    disabled={isSeedance}
                  >
                    {k.imageUrl ? (
                      <Image src={k.imageUrl} alt={`Frame ${k.index + 1}`} fill className="object-cover" unoptimized />
                    ) : k.status === "pending" ? (
                      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2">
                        <Loader2 className="w-8 h-8 text-accent animate-spin" />
                        <div className="text-[11px] text-muted">{t("ugc.story.generating")}</div>
                      </div>
                    ) : k.status === "error" ? (
                      <div className="absolute inset-0 flex items-center justify-center text-xs text-red-400 px-4 text-center flex-col gap-2">
                        <div>{k.error || t("ugc.story.failed")}</div>
                        <div
                          role="button"
                          onClick={(e) => { e.stopPropagation(); generateKeyframe(k.index, k.prompt, k.imageInputs); }}
                          className="px-2.5 py-1 bg-accent text-white rounded text-[11px] flex items-center gap-1 hover:opacity-90 cursor-pointer"
                        >
                          <RefreshCw className="w-3 h-3" /> {t("ugc.story.retry")}
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center flex-col gap-2 text-muted">
                        <div className="text-[11px]">{t("ugc.story.notGenerated")}</div>
                        <div
                          role="button"
                          onClick={(e) => { e.stopPropagation(); generateKeyframe(k.index, k.prompt, k.imageInputs); }}
                          className="px-2.5 py-1 bg-accent text-white rounded text-[11px] flex items-center gap-1 hover:opacity-90 cursor-pointer"
                        >
                          <Sparkles className="w-3 h-3" /> {t("ugc.story.generateOne")}
                        </div>
                      </div>
                    )}
                    {!isSeedance && selected && (
                      <div className="absolute top-2 right-2 bg-accent text-white rounded-full w-6 h-6 flex items-center justify-center">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add frame from content library toggle */}
          <div className="mb-6">
            <button
              onClick={() => setShowContentLibrary((v) => !v)}
              className="flex items-center gap-2 text-xs text-muted hover:text-foreground transition-colors mb-2"
            >
              {showContentLibrary ? <ChevronUp className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showContentLibrary ? t("ugc.story.hideLibrary") : t("ugc.story.addFromLibrary")}</span>
              {contentHistory.length > 0 && !showContentLibrary && (
                <span className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{contentHistory.length}</span>
              )}
            </button>
            {showContentLibrary && (
              <div className="rounded-xl border border-border bg-card p-3">
                {contentHistory.length === 0 ? (
                  <div className="text-center py-6 text-muted">
                    <Clock className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">{t("ugc.story.libraryEmpty")}</p>
                    <p className="text-[11px] mt-1">{t("ugc.story.libraryEmptyHint")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-[200px] overflow-y-auto">
                    {contentHistory.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => addFrameFromHistory(item.resultUrl)}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent/50 hover:ring-1 hover:ring-accent/30 transition-all"
                        title={t("ugc.story.clickToAdd")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.resultUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <Plus className="w-5 h-5 text-white drop-shadow-lg" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Collapsible video prompt editor ── */}
          <div className="mb-4 rounded-xl border border-border bg-card overflow-hidden">
            <button
              onClick={() => setShowVideoPrompt((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-muted hover:text-foreground transition-colors"
            >
              <span className="uppercase tracking-wider">{t("ugc.videoPrompt.label")}</span>
              {showVideoPrompt ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showVideoPrompt && (
              <div className="px-4 pb-4 space-y-2">
                <textarea
                  value={editedVideoPrompt ?? brief.videoPrompt ?? ""}
                  onChange={(e) => setEditedVideoPrompt(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-accent resize-y font-mono"
                  placeholder="Video generation prompt…"
                />
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-muted flex-1">
                    {t("ugc.videoPrompt.hint")}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {editedVideoPrompt !== null && (
                      <button
                        onClick={() => setEditedVideoPrompt(null)}
                        className="text-[11px] text-muted hover:text-foreground flex items-center gap-1"
                      >
                        <RotateCcw className="w-3 h-3" /> {t("ugc.story.reset")}
                      </button>
                    )}
                    <button
                      onClick={enhanceVideoPrompt}
                      disabled={enhancingPrompt || keyframes.every((k) => !k.imageUrl)}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-[11px] font-medium flex items-center gap-1.5 hover:bg-accent/20 disabled:opacity-50 transition-colors"
                    >
                      {enhancingPrompt ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      {t("ugc.aiEnhance")}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="text-xs text-muted">
              {t("ugc.model.using")}: <span className="font-medium text-foreground">{t(
                videoModel === "seedance-2-fast" ? "ugc.model.seedanceFast.title"
                : videoModel === "seedance-2" ? "ugc.model.seedance.title"
                : "ugc.model.kling.title"
              )}</span>
              <span className="ml-2 font-mono">≈${VIDEO_MODEL_COST_USD[videoModel].toFixed(2)}</span>
            </div>
            <button
              onClick={generateVideoAndTts}
              disabled={
                isSeedance
                  ? keyframes.some((k) => !k.imageUrl)
                  : !keyframes[heroFrameIndex]?.imageUrl
              }
              className="px-5 py-2 rounded-lg bg-primary text-white flex items-center gap-2 disabled:opacity-50"
            >
              <Film className="w-4 h-4" />
              {isSeedance ? t("ugc.story.generateSeedance") : t("ugc.story.generate")}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 6: Video / Done ─── */}
      {(step === "video" || step === "done") && brief && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">{t("ugc.video.title")}</h2>
            <button onClick={() => setStep("storyboard")} className="text-sm text-muted hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> {t("ugc.video.back")}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="text-xs font-medium uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                <Film className="w-3.5 h-3.5" /> {t("ugc.video.label")}
              </div>
              <div className="aspect-[9/16] bg-background rounded-lg overflow-hidden relative flex items-center justify-center">
                {videoUrl ? (
                  <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                ) : videoStatus === "pending" ? (
                  <div className="text-center">
                    <Loader2 className="w-10 h-10 text-accent animate-spin mx-auto" />
                    <div className="text-sm text-muted mt-2">
                      {isSeedance ? t("ugc.video.renderingSeedance") : t("ugc.video.rendering")}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-red-400 px-4 text-center">{videoError || t("ugc.story.failed")}</div>
                )}
              </div>
              {videoTaskId && (
                <div className="text-[11px] text-muted mt-2 font-mono truncate">task: {videoTaskId}</div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {/* Voiceover OR text overlay section */}
              {voiceMode === "text-overlay" ? (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                    {t("ugc.voice.textOverlay")}
                  </div>
                  {activeAngle?.overlayTexts && activeAngle.overlayTexts.length > 0 ? (
                    <div className="space-y-1.5">
                      {activeAngle.overlayTexts.map((txt, i) => (
                        <div key={i} className="px-3 py-2 bg-background rounded-lg text-sm font-semibold text-center">
                          {txt}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-muted">{effectiveScript}</p>
                  )}
                </div>
              ) : (
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-muted mb-2 flex items-center gap-2">
                    <Volume2 className="w-3.5 h-3.5" /> {t("ugc.video.voiceover")}
                  </div>
                  {ttsUrl ? (
                    <audio src={ttsUrl} controls className="w-full" />
                  ) : ttsStatus === "pending" ? (
                    <div className="flex items-center gap-2 text-sm text-muted">
                      <Loader2 className="w-4 h-4 animate-spin" /> {t("ugc.video.ttsPending")}
                    </div>
                  ) : (
                    <div className="text-sm text-red-400">{ttsError || t("ugc.story.failed")}</div>
                  )}
                </div>
              )}
              <div>
                <div className="text-xs font-medium uppercase tracking-wider text-muted mb-2">
                  {t("ugc.story.script")}
                  {activeAngle?.name && <span className="ml-2 normal-case text-accent tracking-normal">· {activeAngle.name}</span>}
                </div>
                <p className="text-sm leading-relaxed">{effectiveScript}</p>
              </div>
              {videoUrl && (voiceMode === "text-overlay" || ttsUrl) && (
                <div className="pt-2 border-t border-border text-xs text-muted">
                  {voiceMode === "text-overlay" ? t("ugc.video.tipTextOverlay") : isSeedance ? t("ugc.video.tipSeedance") : t("ugc.video.tip")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .inp {
          width: 100%;
          background: var(--color-background, #0b0b0b);
          border: 1px solid var(--color-border, #2a2a2a);
          border-radius: 8px;
          padding: 8px 12px;
          font-size: 14px;
          color: inherit;
        }
        .inp:focus { outline: none; border-color: var(--color-accent, #6366f1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-xs font-medium text-muted mb-1.5">{label}</div>
      {children}
    </label>
  );
}
