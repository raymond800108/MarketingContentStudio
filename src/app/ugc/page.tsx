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
 *   6. Render 3 storyboard keyframes (gpt-image-2 with product as ref)
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
import { useUgcStore, type Keyframe, type VideoModel, type VoiceMode, type CreatorGender, type CreatorRace, type CreatorHairColor, type CreatorEyeColor, VIDEO_MODEL_COST_USD, getActiveAngle } from "@/lib/stores/ugc-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { trackApiCall, calcVideoCost } from "@/lib/stores/api-usage-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
import { pollManager } from "@/lib/poll-manager";
import LuxuryOverlayInput from "@/components/LuxuryOverlayInput";
import { buildAdOverlayPrompt } from "@/lib/ad-overlay-prompt";
import { getAdFont } from "@/lib/ad-fonts";
import { compressImageForUpload } from "@/lib/image-compress";
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
    clipLength,
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
    setClipLength,
    setInput,
    setBrief,
    setSelectedAngle,
    setKeyframes,
    patchKeyframe,
    setHeroFrameIndex,
    setVideo,
    setTts,
    setMusic,
    musicStatus,
    musicError,
    reset,
  } = useUgcStore();

  const isSeedance = videoModel === "seedance-2" || videoModel === "seedance-2-fast";
  // Only the UGC family uses voiceover/TTS. Commercial + Cinematic are
  // product/visual-only and do not carry any audio narration — they're
  // treated as if "text-overlay" mode is permanently on.
  const isVoiceoverFamily = family === "ugc";
  // Kling is always silent — force voiceover so TTS is always generated and
  // shown as a separate audio player. Seedance respects the user's toggle.
  const effectiveVoiceMode: VoiceMode = !isVoiceoverFamily
    ? "text-overlay"
    : !isSeedance
    ? "voiceover"
    : voiceMode;
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
      // UGC v2 — use the per-frame dialogue endpoint that produces a Seedance-
      // formatted prompt with [Image1]/[Image2] tokens and inline spoken lines
      // so generate_audio produces the right voice with rough lip-sync.
      const isUgcV2 = family === "ugc" && isSeedance;
      if (isUgcV2) {
        const openingDialogue =
          keyframes[0]?.dialogue || activeAngle?.openingLine || "";
        const closingDialogue =
          keyframes[1]?.dialogue || activeAngle?.closingLine || "";
        const motionPrompt =
          activeAngle?.motionPrompt || archetype.motionPrompt || "";
        const res = await fetch("/api/ugc/enhance-video-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            archetypeId: archetype.id,
            openingDialogue,
            closingDialogue,
            motionPrompt,
            openingBeat: activeAngle?.openingBeat || "",
            closingBeat: activeAngle?.closingBeat || "",
            locale,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Enhance failed");
        setEditedVideoPrompt(data.prompt);
        setShowVideoPrompt(true);
        return;
      }

      // Legacy (non-UGC-v2): existing enhance flow for Kling + Commercial +
      // Cinematic paths. Completely unchanged.
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

  function handleFrameDragStart(e: React.DragEvent, index: number) {
    setDragIndex(index);
    // Tag this as an internal reorder drag (not a library drop)
    e.dataTransfer.setData("ugc/frame-index", String(index));
    e.dataTransfer.effectAllowed = "move";
  }
  function handleFrameDragOver(e: React.DragEvent, index: number) {
    e.preventDefault();
    // Show copy cursor when dragging in a library URL, move for reorder
    e.dataTransfer.dropEffect = e.dataTransfer.types.includes("ugc/library-url")
      ? "copy"
      : "move";
    setDragOverIndex(index);
  }
  function handleFrameDrop(e: React.DragEvent, targetIndex: number) {
    e.preventDefault();

    // ── Case 1: dropping a library item onto an existing frame → REPLACE image
    const libUrl = e.dataTransfer.getData("ugc/library-url");
    if (libUrl) {
      patchKeyframe(targetIndex, {
        imageUrl: libUrl,
        status: "ready" as const,
        taskId: undefined,
        error: undefined,
      });
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }

    // ── Case 2: reorder two existing frames
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const items = [...keyframes];
    const [dragged] = items.splice(dragIndex, 1);
    items.splice(targetIndex, 0, dragged);
    const reindexed = items.map((k, i) => ({ ...k, index: i }));
    setKeyframes(reindexed);
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

  // Dedicated drop zone at the end — appends a new frame from the library
  function handleAppendDragOver(e: React.DragEvent) {
    if (!e.dataTransfer.types.includes("ugc/library-url")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }
  function handleAppendDrop(e: React.DragEvent) {
    e.preventDefault();
    const libUrl = e.dataTransfer.getData("ugc/library-url");
    if (!libUrl) return;
    addFrameFromHistory(libUrl);
  }

  // Library → DnD source
  function handleLibraryDragStart(e: React.DragEvent, url: string) {
    e.dataTransfer.setData("ugc/library-url", url);
    e.dataTransfer.effectAllowed = "copy";
  }

  // ─── Helpers ───

  async function uploadFile(file: File): Promise<string> {
    // Client-side compress so we stay under Vercel's 4.5 MB function-body cap.
    let toUpload = file;
    try {
      toUpload = await compressImageForUpload(file);
    } catch (compressErr) {
      console.warn("[ugc] compression failed, using original:", compressErr);
    }
    const fd = new FormData();
    fd.append("file", toUpload);
    const res = await trackApiCall("fal", "file_upload", "/api/upload", async () => {
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      if (!r.ok) {
        if (r.status === 413) {
          throw new Error("Image too large even after compression. Try a smaller image (under ~10 MB).");
        }
        throw new Error(await r.text());
      }
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
          voiceMode: effectiveVoiceMode,
          clipLength, // UGC v2 only — 5 (2 frames) or 10 (4 frames)
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t("ugc.err.briefFailed"));
      setBrief(data.brief);
      // UGC v2 = UGC family + Seedance. Uses Seedance's keyframe-anchored
      // mode (first_frame_url + last_frame_url), 2 or 4 frames depending
      // on clipLength. Each frame uses the PREVIOUS frame's imageUrl as an
      // additional image_input to lock identity — generated sequentially.
      const isUgcV2 = family === "ugc" && isSeedance;
      // 10s uses 3 keyframes [open, MID, close]; MID plays on both sides of
      // the 5s seam → pixel-locked zero-jump boundary. 5s uses 2 [open, close].
      const ugcV2FrameCount = clipLength === 10 ? 3 : 2;

      // Labels depend on family + video model + mode
      const labelMap: Record<string, string[]> = {
        "ugc-v2":              ["Opening", "Closing"],
        "ugc-v2-10s":          ["Open (Hook)", "Mid (Pivot)", "Close (CTA)"],
        "ugc-kling":           ["Hook", "Demo", "CTA"],
        "ugc-seedance":        ["Creator", "Product", "Scene"],
        "commercial-kling":    ["Hero", "Action", "Reveal"],
        "commercial-seedance": ["Hero", "Action", "Reveal"],
        "cinematic-kling":     ["Scene", "Discovery", "Resolution"],
        "cinematic-seedance":  ["Scene", "Discovery", "Resolution"],
      };
      const labelKey = isUgcV2
        ? ugcV2FrameCount === 3 ? "ugc-v2-10s" : "ugc-v2"
        : `${family}-${isSeedance ? "seedance" : "kling"}`;
      const labels = labelMap[labelKey] || (isSeedance ? ["Ref 1", "Ref 2", "Ref 3"] : ["Frame 1", "Frame 2", "Frame 3"]);

      // Determine per-frame image inputs:
      //   UGC v2: both frames get [productImageUrl] — Frame 2 will add Frame 1's
      //     image dynamically AFTER Frame 1 resolves (sequential, not parallel).
      //   Commercial + Cinematic: all frames get [productImageUrl].
      //   UGC + Kling: all frames get [productImageUrl].
      //   UGC + Seedance (legacy, not UGC v2): Scene plate (index 2) gets []
      //     to avoid Kie rejecting the "no product" prompt when product ref is
      //     passed in.
      const isProductFamily = family === "commercial" || family === "cinematic";
      const activeAngleAtBrief = getActiveAngle(data.brief);
      // Dialogue per frame (UGC v2 only):
      //   2-frame 5s:  [openingLine (seg1 dialogue), closingLine (same seg1 dialogue tail)]
      //   3-frame 10s: [openingLine (seg1), "" (mid frame has no own dialogue — it's the
      //                 pixel-lock boundary), closingLine (seg2)]
      //     — displayed on the keyframe card but NOT directly fed to Seedance for MID;
      //       seg1's Seedance call uses openingLine, seg2's uses closingLine.
      const dialoguePerFrame: string[] = isUgcV2
        ? ugcV2FrameCount === 3
          ? [
              activeAngleAtBrief?.openingLine || "",
              "", // mid frame is the pixel-lock seam — no standalone dialogue
              activeAngleAtBrief?.closingLine || "",
            ]
          : [
              activeAngleAtBrief?.openingLine || "",
              activeAngleAtBrief?.closingLine || "",
            ]
        : [];
      const frames: Keyframe[] = data.brief.keyframePrompts.map(
        (p: string, i: number) => ({
          index: i,
          label: labels[i] || `Frame ${i + 1}`,
          prompt: p,
          imageInputs: isUgcV2
            ? (productImageUrl ? [productImageUrl] : [])
            : isProductFamily
            ? (productImageUrl ? [productImageUrl] : [])
            : isSeedance
              ? (i === 2 ? [] : productImageUrl ? [productImageUrl] : [])
              : productImageUrl ? [productImageUrl] : [],
          status: "idle",
          dialogue: isUgcV2 ? dialoguePerFrame[i] || "" : undefined,
        })
      );
      setKeyframes(frames);
      setStep("storyboard");
      if (family === "ugc") {
        // UGC family — ALL video models: generate Frame 0 first; subsequent
        // frames kick off when their predecessor completes (pollImage onSuccess).
        // This creates the identity chain: Frame N uses Frame 0 (face anchor) +
        // Frame N-1 as image_inputs, so gpt-image-2 renders the same person.
        // Applies to both Kling (3 frames) and Seedance (2-3 frames).
        if (frames[0]) generateKeyframe(frames[0].index, frames[0].prompt, frames[0].imageInputs);
      } else {
        // Commercial / Cinematic — no identity chain needed (no people or
        // consistent creator), fire in parallel with stagger to avoid Kie 500s.
        frames.forEach((f, i) => {
          setTimeout(() => generateKeyframe(f.index, f.prompt, f.imageInputs), i * 350);
        });
      }
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t("ugc.err.briefFailed"));
    } finally {
      setBriefing(false);
    }
  }

  async function generateKeyframe(
    index: number,
    prompt: string,
    imageInputs?: string[],
    retryCount: number = 0
  ) {
    if (!productImageUrl) return;
    // Default to product ref if caller didn't specify (backcompat for manual retries).
    const inputs = imageInputs ?? [productImageUrl];

    // ── Mandatory UGC visual directive ────────────────────────────
    // Appends a language-independent English suffix to every UGC keyframe
    // prompt so gpt-image-2 always renders the authentic selfie-mode UGC
    // aesthetic, regardless of what language the brief was generated in.
    // gpt-image-2 honours English visual directives even inside a
    // non-English prompt, so this is safe across all locales.
    const UGC_VISUAL_DIRECTIVE = `

CRITICAL UGC VISUAL STYLE — enforce strictly (English directive, honoured by gpt-image-2 regardless of the primary prompt's language):

╔══════════════════════════════════════════════════════════════════════╗
║ SKIN — CLEAR, HEALTHY, GLOWING. NO EXCEPTIONS.                      ║
║ This creator is the PROMOTER — they embody the product's outcome.   ║
║ Skin MUST render as:                                                ║
║   • Clear, smooth, even-toned complexion                            ║
║   • Healthy softly-luminous glow (natural radiance, not greasy)     ║
║   • Softly flushed healthy cheeks                                   ║
║   • Bright clear eyes with rested look                              ║
║ Skin MUST NOT render any of:                                        ║
║   • acne • pimples • whiteheads • blackheads • papules • pustules   ║
║   • red blemish marks • post-acne hyperpigmentation (PIH)           ║
║   • rosacea patches • uneven red flushing • irritated redness       ║
║   • dull tired complexion • grey undertone • sallow look            ║
║   • dark undereye circles • undereye bags • puffy eyes              ║
║   • dehydrated / cracked / peeling lips                             ║
║   • oily T-zone shine • greasy forehead                             ║
║   • visible pore-level micro-texture on the cheeks (smooth cheeks)  ║
║   • stubble-like texture • razor marks • ingrown hairs              ║
║   • scars • scabs • wound marks                                     ║
║ Balance point: NOT airbrushed plastic-smooth either — light soft    ║
║ under-light-side shadow and subtle nose/chin micro-structure is OK. ║
║ Aim: "a friend who clearly takes care of their skin" — attractive   ║
║ and believably real, NEVER blemished or tired. This is               ║
║ NON-NEGOTIABLE regardless of product category.                      ║
╚══════════════════════════════════════════════════════════════════════╝

╔══════════════════════════════════════════════════════════════════════╗
║ SELFIE HAND ECONOMY (mandatory for UGC selfie framing)              ║
║ The creator is self-recording on a phone.                           ║
║   • Hand A: holds the phone (OFF-SCREEN, implied, never rendered)   ║
║   • Hand B: the ONE free hand, visible on camera                    ║
║ Exactly ONE hand is visible holding the product. NEVER TWO hands.   ║
║ NEVER a disembodied or partial hand entering from off-screen edges. ║
║ NEVER a second hand of the same creator rendered separately from    ║
║ the first.                                                           ║
║                                                                      ║
║ Multi-part products (dropper + bottle, lid + jar) in selfie mode:   ║
║   • Default: product is held as a SINGLE UNIT in the one free hand. ║
║     Dropper is inserted into the bottle, or dropper + bottle are    ║
║     pinched together in the same fingers.                           ║
║   • For application moments (dropper drawing serum, fingertip to    ║
║     cheek, ring-finger to eye corner): either show the action in a  ║
║     close-up where the bottle is OUT OF FRAME, OR the bottle is     ║
║     resting on a VISIBLE surface (counter, vanity, desk) in the     ║
║     background while the free hand applies the product.             ║
║   • The dropper pipette, when out of the bottle, MUST be in the     ║
║     same visible hand as the bottle or the bottle must be set down. ║
║     It is NEVER held by a second hand coming in from off-screen.    ║
║                                                                      ║
║ Forbidden patterns (all seen in failed renders):                    ║
║   • hand + wrist + forearm entering from left/right/top edge of     ║
║     frame holding any product component while the creator's own     ║
║     hand holds another piece                                         ║
║   • any object held in mid-air without a visible supporting hand    ║
║     or visible surface                                               ║
╚══════════════════════════════════════════════════════════════════════╝

CAMERA (phone DP spec — gpt-image-2 honours focal length, height, distance)
— 35mm equivalent focal length, eye-level, arm's-length selfie (~55-70cm phone-to-face).
— f/2.0 effective aperture — shallow depth of field, face and hand in focus, background blurred.
— Vertical 9:16 smartphone aspect. Very slight handheld tremor/shake artifact.
— Creator is SLIGHTLY off-center (asymmetrical amateur framing).

LIGHTING (concrete DP direction — locked across every frame in this brief)
— Single 5600K window daylight key light from CAMERA-LEFT at ~45° — right cheek sits in gentle natural shadow.
— NO fill light on camera-right. NO ring light. NO softbox. NO three-point studio rig.
— Slight overexposure on the lit cheek, slight underexposure on the shadow side — real phone-camera auto-meter behavior.
— Warm ambient cast (home interior 3000-3800K bounce) with the cooler window key — mixed-temp feel.

COLOR GRADE (named commercial grade — keep identical frame to frame)
— Warm commercial grade: lifted blacks, teal shadows, orange skin tones, matte highlights.
— Subtle film grain in the background only — NEVER grain on the face/skin. Skin stays clean.
— NOT a glossy IG filter. NOT color-corrected studio balance.

HAIR
— Hair is softly styled, healthy, clean. A few gentle flyaways are acceptable — but hair must look well-maintained (never greasy, never tangled, never unwashed).
— Do NOT apply "imperfection" language to hair — the hair is simply natural and healthy.

FRAMING & COMPOSITION
— Creator FACING the phone camera head-on. Eyes locked INTO the camera lens (direct eye contact with the viewer).
— Arm's-length self-recording SELFIE angle — phone held by the creator's own hand (off-screen), not a professional camera.
— Product held at chest to upper-chest height in the one free hand (see SELFIE HAND ECONOMY above).

ENVIRONMENTAL REALISM
— Background is a real LIVED-IN space: bedroom, kitchen, office corner, bathroom, dorm. Blurred real-life details visible — water bottle, coffee cup, books, laptop edge, hanging clothes.
— NOT a minimal aspirational backdrop. NOT a clean studio. NOT a seamless gradient wall.

PHYSICS PLAUSIBILITY (mandatory)
— Every object in frame is supported: gripped by a hand, resting on a visible surface, or on the creator's body.
— NOTHING floats or hovers.
— Hand + finger anatomy must be plausible — no extra fingers, no fused fingers, no inverted wrists, no hands without forearms.

EXPLICITLY AVOID
— Any visible skin blemish, pimple, acne mark, red spot, hyperpigmentation, rosacea patch, dark undereye shadow, dull complexion, tired look. Airbrushed plastic skin is also wrong — aim for clear-healthy-natural.
— Disembodied hands entering the frame from off-screen edges.
— A second creator hand visible in frame (the phone-holding hand is always off-screen).
— Floating dropper/cap/product. Hovering objects.
— Professional portrait. Editorial magazine shot. Three-point studio lighting. Symmetrical framing. Perfect centering. Clean minimalist backdrop.
`;

    const isUgcFamily = family === "ugc";

    const sceneLock = useUgcStore.getState().brief?.sceneLock;

    // ── gpt-image-2 best-practice prompt construction (UGC only) ──
    // Based on fal.ai prompting guide:
    //  1. Label EVERY reference image by role at the top — model guesses otherwise
    //  2. Use "CHANGE ONLY / KEEP UNCHANGED" pattern for delta frames
    //  3. Repeat the full preserve list with concrete visual facts each time
    let promptToSend: string;

    if (!isUgcFamily) {
      promptToSend = prompt;
    } else {
      const creator = sceneLock?.creator || "";
      const outfit  = sceneLock?.outfit  || "";
      const lighting = sceneLock?.lighting || "";
      const colorGrade = sceneLock?.colorGrade || "";
      const environment = sceneLock?.environment || "";
      const camera = sceneLock?.camera || "";

      // Frame 0 — only product image is available as reference
      if (index === 0) {
        const refLabels = `[Image 1] = PRODUCT REFERENCE — match this exact product (packaging, shape, label, color) in the scene.\n\n`;
        const identityBlock = creator
          ? `CREATOR TO RENDER: ${creator}\n\n`
          : "";
        const sceneBlock = [
          camera      && `CAMERA: ${camera}`,
          lighting    && `LIGHTING: ${lighting}`,
          colorGrade  && `COLOR GRADE: ${colorGrade}`,
          environment && `ENVIRONMENT: ${environment}`,
          outfit      && `OUTFIT: ${outfit}`,
        ].filter(Boolean).join("\n");

        promptToSend = `${refLabels}${identityBlock}SCENE:\n${prompt}${sceneBlock ? `\n\n${sceneBlock}` : ""}${UGC_VISUAL_DIRECTIVE}`;
      } else {
        // Frame 1+: explicit role labels + "CHANGE ONLY / KEEP UNCHANGED"
        // inputs array is [frame0, (frame1 if index≥2), product]
        const productLabel = inputs.length >= 3
          ? `[Image ${inputs.length}] = PRODUCT REFERENCE — match this exact product.\n`
          : inputs.length === 2
          ? `[Image 2] = PRODUCT REFERENCE — match this exact product.\n`
          : "";
        const frame0Label = `[Image 1] = IDENTITY REFERENCE — this is the creator. Copy this exact person verbatim.\n`;
        const frame1Label = inputs.length >= 3
          ? `[Image 2] = SCENE CONTEXT — same setting and creator from previous beat.\n`
          : "";

        const preserveList = [
          creator     && `face STRUCTURE (same person as Image 1: identical jawline width, cheekbone height, eye shape and color, nose bridge, lip shape, hairline, skin tone — bone structure is locked; natural expressions and emotions ARE allowed to vary)`,
          outfit      && `outfit (${outfit})`,
          lighting    && `lighting direction and color (${lighting})`,
          colorGrade  && `color grade (${colorGrade})`,
          environment && `environment (${environment})`,
        ].filter(Boolean).join("; ");

        const changeOnly = `CHANGE ONLY: the specific action or scene beat described below.\nKEEP UNCHANGED: ${preserveList || "face, outfit, lighting, environment"}.`;

        promptToSend = `${frame0Label}${frame1Label}${productLabel}\n${changeOnly}\n\nSCENE BEAT:\n${prompt}${UGC_VISUAL_DIRECTIVE}`;
      }
    }

    patchKeyframe(index, {
      status: "pending",
      error: undefined,
      imageUrl: undefined,
      prompt, // store the original (user-editable) prompt, not the augmented one
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
            prompt: promptToSend,
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
      pollImage(index, taskId, prompt, inputs, retryCount);
    } catch (e) {
      patchKeyframe(index, { status: "error", error: e instanceof Error ? e.message : "failed" });
    }
  }

  function pollImage(
    index: number,
    taskId: string,
    /** Original prompt string — kept so we can re-fire generateKeyframe on
     *  retry-eligible errors (Kie 500 / transient failures). */
    originalPrompt?: string,
    /** Original imageInputs — likewise needed for retry. */
    originalInputs?: string[],
    /** Retry depth — caps at 1 retry so a persistently failing prompt
     *  doesn't loop. Caller passes the retry count of the create attempt. */
    retryCount: number = 0
  ) {
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
            // Identity chain — when any UGC frame finishes, kick off the NEXT
            // with frame-0 + this frame as image_inputs so gpt-image-2 locks
            // onto the same face. Applies to ALL UGC models (Kling + Seedance).
            const st = useUgcStore.getState();
            const fam = st.family;
            const totalFrames = st.keyframes.length;
            if (
              fam === "ugc" &&
              index < totalFrames - 1
            ) {
              const next = st.keyframes[index + 1];
              if (next && next.status === "idle") {
                const productUrl = st.productImageUrl || "";
                // Frame 0's imageUrl is the canonical identity anchor for all
                // subsequent frames — gpt-image-2 weights the first input_url
                // most heavily, so the "face reference" must come first.
                // For frame 1: [frame0, product] (frame0 = imgUrl)
                // For frame 2: [frame0, frame1, product] (frame0 from store)
                const frame0Url = index === 0
                  ? imgUrl
                  : (st.keyframes[0]?.imageUrl || imgUrl);
                const inputs = index === 0
                  ? [imgUrl, productUrl]
                  : [frame0Url, imgUrl, productUrl];
                generateKeyframe(next.index, next.prompt, inputs.filter(Boolean));
              }
            }
          } else {
            useUgcStore.getState().patchKeyframe(index, { status: "error", error: "No image returned" });
          }
        },
        onError: (err) => {
          // Auto-retry up to 3 times on Kie's transient 500s with exponential
          // back-off. On the final retry (retryCount >= 2) drop image refs
          // and fall back to text-only — bypasses any image-URL accessibility
          // issue on Kie's side while still producing a usable keyframe.
          const isRetryable =
            !!originalPrompt &&
            retryCount < 3 &&
            /code\s*500|Internal Error|timed out|fetch failed/i.test(err);
          if (isRetryable) {
            const delayMs = Math.min(2000 * Math.pow(2, retryCount), 12000);
            const fallbackInputs = retryCount >= 2 ? [] : originalInputs;
            console.warn(
              `[ugc] Keyframe ${index} 500 — retry ${retryCount + 1}/3 in ${delayMs}ms` +
              (fallbackInputs?.length === 0 ? " (text-only fallback)" : ""),
              err
            );
            useUgcStore.getState().patchKeyframe(index, {
              status: "pending",
              error: undefined,
              taskId: undefined,
            });
            setTimeout(() => {
              generateKeyframe(index, originalPrompt!, fallbackInputs, retryCount + 1);
            }, delayMs);
            return;
          }
          useUgcStore.getState().patchKeyframe(index, { status: "error", error: err });
        },
      },
    });
  }

  async function generateVideoAndTts() {
    if (!brief || !archetype) return;

    // UGC v2 — Seedance keyframe-anchored mode (native audio via
    // generate_audio, no TTS, no reference_audio_urls).
    //   clipLength 5  → 2 frames, 1 Seedance call
    //   clipLength 10 → 3 frames [open, MID, close], 2 parallel Seedance calls
    //                   (seg1=0→1, seg2=1→2, MID pixel-locked across the seam)
    const isUgcV2 = family === "ugc" && isSeedance;
    const isUgcV2Long = isUgcV2 && clipLength === 10;

    if (isUgcV2) {
      const required = isUgcV2Long ? 3 : 2;
      const readyCount = keyframes.filter((k, i) => i < required && k.imageUrl).length;
      if (readyCount < required) {
        setGenError(t("ugc.err.allRefsNeeded"));
        return;
      }
    } else if (isSeedance) {
      // Legacy Seedance (Commercial/Cinematic): need all 3 refs ready.
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

    const isTextOverlay = effectiveVoiceMode === "text-overlay";

    setStep("video");
    setVideo({ videoStatus: "pending", videoError: null, videoUrl: null, videoTaskId: null });
    setMusic({ musicStatus: "idle", musicError: null, musicRequestId: null });
    // UGC v2: Seedance generates its own voice natively — no TTS needed.
    if (isUgcV2 || isTextOverlay) {
      setTts({ ttsStatus: "ready", ttsError: null, ttsUrl: null, ttsDurationSec: null });
    } else {
      setTts({ ttsStatus: "pending", ttsError: null, ttsUrl: null });
    }

    // 1) Generate TTS FIRST — SKIP entirely in text-overlay mode AND in
    //    UGC v2 (Seedance generates native audio from the prompt's dialogue).
    //    For legacy Seedance (Commercial/Cinematic), the audio URL is an
    //    INPUT to the video model for lip-sync.
    //    For Kling, TTS runs in parallel since the video is silent.
    let ttsUrlLocal: string | null = null;
    if (isTextOverlay || isUgcV2) {
      // No external TTS needed
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
      const overlayTxt = useUIStore.getState().overlayText;
      const fontPromptPhrase = getAdFont(useUIStore.getState().overlayFontId).prompt;
      const adStyleSuffix = buildAdOverlayPrompt(overlayTxt, true, fontPromptPhrase);

      // ── UGC v2 4-frame long clip (10s) ────────────────────────────
      // Fire TWO Seedance calls in parallel (one per 5s segment), wait for
      // both, stitch with ffmpeg.wasm audio crossfade, upload the result.
      if (isUgcV2Long) {
        try {
          // Per-segment motion directives (continuous-verb style, honoured by
          // Seedance keyframe-anchored mode). Prefer motions[segIdx] from the
          // brief; fall back to legacy motionPrompt, then archetype default.
          const fallbackMotion =
            activeAngle?.motionPrompt ||
            archetype.motionPrompt ||
            "the creator maintains relaxed eye contact, shoulders soften, a micro-smile blooms, the camera holds steady";
          const segMotion = (segIdx: number): string => {
            const motions = activeAngle?.motions;
            return (motions && motions[segIdx]) || fallbackMotion;
          };

          // Dialogue is per-SEGMENT, not per-frame, in 3-frame 10s mode.
          // seg1 speaks openingLine (frames 0→1), seg2 speaks closingLine (frames 1→2).
          const segDialogue = (segIdx: number): string => {
            if (segIdx === 0) return activeAngle?.openingLine || "";
            return activeAngle?.closingLine || "";
          };

          // Helper — build request body for ONE segment (frame pair).
          // segIdx 0: frames[0] → frames[1]  (OPEN → MID)
          // segIdx 1: frames[1] → frames[2]  (MID  → CLOSE)  ← same MID pixel as seg1 end
          const buildSegmentBody = (segIdx: number) => {
            const startIdx = segIdx; // with 3 frames, seg 0 starts at 0, seg 1 starts at 1
            const openingKF = keyframes[startIdx];
            const closingKF = keyframes[startIdx + 1];
            const line = segDialogue(segIdx);
            const motion = segMotion(segIdx);
            const beatLabel = segIdx === 0 ? "hook, looking into the camera" : "payoff, CTA beat";
            const defaultPrompt = [
              `[Image1] ${beatLabel}`,
              line ? ` and says naturally: "${line}"` : "",
              `. ${motion}.`,
              ` [Image2]`,
              `. Authentic UGC phone selfie, vertical 9:16, slight natural handshake, natural speech with breathing and micro-expressions, home-recorded vibe not a commercial.`,
            ].join("");
            return {
              type: "video",
              video_model: videoModel,
              prompt: `${defaultPrompt}${adStyleSuffix ? `\n\n${adStyleSuffix}` : ""}`,
              aspect_ratio: ratio,
              resolution: "720p",
              duration: 5,
              generate_audio: !isTextOverlay,
              first_frame_url: openingKF?.imageUrl || "",
              last_frame_url: closingKF?.imageUrl || "",
            };
          };

          // Helper — create Kie task, poll it, return the final video URL
          const runSegment = async (body: Record<string, unknown>): Promise<string> => {
            const createRes = await fetch("/api/kie", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const createData = await createRes.json();
            if (!createRes.ok) throw new Error(createData.error || "segment create failed");
            const taskId = createData.taskId as string;
            if (!taskId) throw new Error("No taskId returned");

            // Poll every 8s, budget 8 minutes
            const deadline = Date.now() + 8 * 60 * 1000;
            while (Date.now() < deadline) {
              await new Promise((res) => setTimeout(res, 8000));
              const pollRes = await fetch(
                `/api/kie?taskId=${encodeURIComponent(taskId)}&type=video`
              );
              const pollData = await pollRes.json();
              if (pollData.status === "success") {
                const vid = (pollData.videos as { url?: string }[] | undefined)?.[0]?.url;
                if (vid) return vid;
                throw new Error("Segment finished without a video URL");
              } else if (pollData.status === "fail") {
                throw new Error(pollData.error || "Segment generation failed");
              }
            }
            throw new Error("Segment timed out after 8 min");
          };

          // Track cost — 2× single-segment cost
          const segmentCost = calcVideoCost(videoModel, 5, true);
          const totalCost = segmentCost * 2;

          // ── Phase 1: run both Seedance segments in parallel ──
          let seg1Url: string, seg2Url: string;
          try {
            [seg1Url, seg2Url] = await trackApiCall(
              "kie",
              "video_generation",
              "/api/kie",
              async () => {
                // 3-frame mode: seg 0 spans frames 0→1, seg 1 spans frames 1→2.
                // The MID frame (index 1) is pixel-locked — it is the last frame
                // of seg1 AND the first frame of seg2 — so the 5s seam is a
                // zero-jump boundary on both sides.
                return await Promise.all([
                  runSegment(buildSegmentBody(0)),
                  runSegment(buildSegmentBody(1)),
                ]);
              },
              { costOverride: totalCost, model: videoModel }
            );
            console.log("[ugc-v2-10s] seg1:", seg1Url);
            console.log("[ugc-v2-10s] seg2:", seg2Url);
          } catch (segErr) {
            console.error("[ugc-v2-10s] segment generation failed:", segErr);
            const msg = segErr instanceof Error ? segErr.message : String(segErr);
            throw new Error(`Segment generation failed: ${msg}`);
          }

          // Save BOTH segments to history as a safety net — even if stitch
          // fails, the user can manually download the 2 parts.
          useGenerationStore.getState().addHistory({
            id: crypto.randomUUID(),
            sourceUrl: productImageUrl || "",
            resultUrl: seg1Url,
            profileId: "",
            mode: "video",
            prompt: `${activeAngle?.fullScript || ""} [Part 1/2]`,
            timestamp: Date.now(),
            source: "ugc",
            ugc: {
              angleName: activeAngle?.name,
              archetypeId: archetype.id || undefined,
            },
          });
          useGenerationStore.getState().addHistory({
            id: crypto.randomUUID(),
            sourceUrl: productImageUrl || "",
            resultUrl: seg2Url,
            profileId: "",
            mode: "video",
            prompt: `${activeAngle?.fullScript || ""} [Part 2/2]`,
            timestamp: Date.now(),
            source: "ugc",
            ugc: {
              angleName: activeAngle?.name,
              archetypeId: archetype.id || undefined,
            },
          });

          // ── Phase 2: stitch with ffmpeg.wasm ──
          let stitchedBlob: Blob;
          try {
            console.log("[ugc-v2-10s] loading stitch helper…");
            const { stitchSegments } = await import("@/lib/video-stitch");
            console.log("[ugc-v2-10s] stitching 2 segments…");
            stitchedBlob = await stitchSegments([seg1Url, seg2Url]);
            console.log(
              `[ugc-v2-10s] stitch complete, blob size=${(stitchedBlob.size / 1024).toFixed(0)}KB`
            );
          } catch (stitchErr) {
            console.error("[ugc-v2-10s] stitch failed:", stitchErr);
            const msg =
              stitchErr instanceof Error ? stitchErr.message : String(stitchErr);
            // Graceful fallback — show segment 1 as the primary video and tell
            // the user both parts are in Content History.
            setVideo({
              videoStatus: "ready",
              videoUrl: seg1Url,
              videoTaskId: null,
              videoError: `Stitching failed (${msg}). Both 5s parts saved to Content History — you can download and merge them in a video editor.`,
            });
            useUgcStore.getState().setStep("done");
            return;
          }

          // ── Phase 3: upload stitched MP4 ──
          let finalUrl: string;
          try {
            const fd = new FormData();
            fd.append(
              "file",
              new File([stitchedBlob], `ugc-v2-10s-${Date.now()}.mp4`, {
                type: "video/mp4",
              })
            );
            const upRes = await fetch("/api/upload", { method: "POST", body: fd });
            const upData = await upRes.json();
            if (!upRes.ok) {
              throw new Error(upData.error || `HTTP ${upRes.status}`);
            }
            finalUrl = upData.url as string;
            console.log("[ugc-v2-10s] uploaded stitched video:", finalUrl);
          } catch (upErr) {
            console.error("[ugc-v2-10s] upload failed:", upErr);
            const msg = upErr instanceof Error ? upErr.message : String(upErr);
            // Fallback — show segment 1 and explain
            setVideo({
              videoStatus: "ready",
              videoUrl: seg1Url,
              videoTaskId: null,
              videoError: `Stitched upload failed (${msg}). Both 5s parts are in Content History.`,
            });
            useUgcStore.getState().setStep("done");
            return;
          }

          // Success — mark the video ready and save the stitched result
          setVideo({ videoStatus: "ready", videoUrl: finalUrl, videoTaskId: null, videoError: null });
          useGenerationStore.getState().addHistory({
            id: crypto.randomUUID(),
            sourceUrl: productImageUrl || "",
            resultUrl: finalUrl,
            profileId: "",
            mode: "video",
            prompt: activeAngle?.fullScript || "",
            timestamp: Date.now(),
            source: "ugc",
            ugc: {
              angleName: activeAngle?.name,
              script: activeAngle?.fullScript,
              ttsUrl: undefined,
              archetypeId: archetype.id || undefined,
              keyframeUrls: keyframes.filter((k) => k.imageUrl).map((k) => k.imageUrl!),
            },
          });
          useUgcStore.getState().setStep("done");
        } catch (e) {
          console.error("[ugc-v2-10s] failed (outer):", e);
          const msg = e instanceof Error ? e.message : String(e) || "Unknown error";
          setVideo({
            videoStatus: "error",
            videoError: `10s generation failed: ${msg}`,
          });
        }
        return;
      }

      let requestBody: Record<string, unknown>;
      if (isUgcV2) {
        // UGC v2 5s — Seedance KEYFRAME-anchored mode.
        // Pixel-locks opening + closing frames. Native audio comes from
        // quoted dialogue inside the prompt via generate_audio=true.
        // Mutually exclusive with reference_image_urls / reference_audio_urls
        // (the /api/kie route enforces this).
        const openingUrl = keyframes[0]?.imageUrl || "";
        const closingUrl = keyframes[1]?.imageUrl || "";
        const openingLine = keyframes[0]?.dialogue || activeAngle?.openingLine || "";
        const closingLine = keyframes[1]?.dialogue || activeAngle?.closingLine || "";
        const motionDescr =
          (activeAngle?.motions && activeAngle.motions[0]) ||
          activeAngle?.motionPrompt ||
          archetype.motionPrompt ||
          "the creator maintains relaxed eye contact, shoulders soften, a micro-smile blooms, the camera holds steady";

        // If the user has AI-enhanced the video prompt, use that verbatim
        // (it already contains [Image1]/[Image2] tokens and quoted dialogue).
        // Otherwise, build a default prompt from the dialogue + motion.
        const defaultPrompt = [
          `[Image1] ${activeAngle?.openingBeat || "opens by addressing the camera"}`,
          openingLine ? ` and says naturally: "${openingLine}"` : "",
          `. ${motionDescr}.`,
          ` [Image2]`,
          closingLine ? ` and says: "${closingLine}"` : "",
          `. Authentic UGC phone selfie, vertical 9:16, slight natural handshake, natural speech with breathing and micro-expressions, home-recorded vibe not a commercial.`,
        ].join("");

        const videoPrompt = `${editedVideoPrompt ?? brief.videoPrompt ?? defaultPrompt}${adStyleSuffix ? `\n\n${adStyleSuffix}` : ""}`;

        requestBody = {
          type: "video",
          video_model: videoModel,
          prompt: videoPrompt,
          aspect_ratio: ratio,
          resolution: "720p",
          duration: brief.durationSec || 5,
          generate_audio: !isTextOverlay, // voice comes from prompt's dialogue
          first_frame_url: openingUrl,
          last_frame_url: closingUrl,
        };
      } else if (isSeedance) {
        // Legacy Seedance multimodal (Commercial / Cinematic families):
        // pass all 3 image refs + TTS audio for lip-sync.
        // videoPrompt uses [Image1/2/3] bracket tokens produced by the brief API.
        const refs = keyframes.map((k) => k.imageUrl!).filter(Boolean);
        const basePrompt =
          (editedVideoPrompt ?? brief.videoPrompt) ||
          `[Image1] speaks naturally to camera while presenting [Image2] in the setting shown in [Image3].`;
        const videoPrompt = `${basePrompt} They say the following line naturally: "${effectiveScript}"${adStyleSuffix ? `\n\n${adStyleSuffix}` : ""}`;

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
        const videoPrompt = `${basePrompt}. Hook: ${activeAngle?.hook || ""}. They say: "${effectiveScript}"${adStyleSuffix ? `\n\n${adStyleSuffix}` : ""}`;

        requestBody = {
          type: "video",
          video_model: "kling-3.0",
          prompt: videoPrompt,
          aspect_ratio: ratio,
          reference_image: hero.imageUrl,
        };
      }

      // Calculate real cost based on per-second pricing × duration
      const actualModel = isSeedance ? videoModel : "kling-3.0";
      const durationSec = isSeedance ? (brief.durationSec || 8) : 5;
      const hasImageInput = isSeedance
        ? keyframes.some((k) => k.imageUrl)
        : !!keyframes[heroFrameIndex]?.imageUrl;
      const videoCost = calcVideoCost(actualModel, durationSec, hasImageInput);

      const data = await trackApiCall("kie", "video_generation", "/api/kie", async () => {
        const r = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });
        if (!r.ok) throw new Error((await r.json()).error || "kie failed");
        return r.json();
      }, { costOverride: videoCost, model: actualModel });
      const taskId = data.taskId as string;
      setVideo({ videoTaskId: taskId });
      pollVideo(taskId);
    } catch (e) {
      setVideo({ videoStatus: "error", videoError: e instanceof Error ? e.message : "video failed" });
    }
  }

  async function addMusicToVideo(silentVideoUrl: string) {
    const st = useUgcStore.getState();
    useUgcStore.getState().setMusic({ musicStatus: "pending", musicError: null, musicRequestId: null });
    try {
      const res = await fetch("/api/ugc/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoUrl: silentVideoUrl,
          archetypeId: st.archetypeId,
          family: st.family,
          duration: 5,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.request_id) {
        throw new Error(data.error || "Music submit failed");
      }
      useUgcStore.getState().setMusic({ musicRequestId: data.request_id });

      // Poll until done (max 3 minutes, 8s interval)
      const MAX_MS = 3 * 60 * 1000;
      const start = Date.now();
      while (Date.now() - start < MAX_MS) {
        await new Promise((r) => setTimeout(r, 8000));
        const poll = await fetch(`/api/ugc/music?request_id=${data.request_id}`);
        const pd = await poll.json();
        if (pd.status === "success" && pd.videoUrl) {
          useUgcStore.getState().setMusic({ musicStatus: "ready", musicError: null });
          // Replace silent video URL with the audio-enhanced version
          useUgcStore.getState().setVideo({ videoUrl: pd.videoUrl });
          return;
        }
        if (pd.status === "fail") {
          throw new Error(pd.error || "Music generation failed");
        }
      }
      throw new Error("Music generation timed out");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Music failed";
      console.warn("[ugc/music]", msg);
      useUgcStore.getState().setMusic({ musicStatus: "error", musicError: msg });
      // Non-fatal — keep the silent video
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
          // Overlay text (if any) was baked into the video prompt, so the
          // returned video already has the text rendered by the model.
          useUgcStore.getState().setVideo({ videoStatus: "ready", videoUrl: vidUrl });
          // Add background music via MMAudio when the video has no native audio:
          //   - Kling: always silent (sound: false)
          //   - Seedance text-overlay: generate_audio was false
          //   - Seedance commercial family: no voiceover, silent
          const stForMusic = useUgcStore.getState();
          const isTextOverlayMode =
            stForMusic.family !== "ugc" || stForMusic.voiceMode === "text-overlay";
          if (!seedance || isTextOverlayMode) {
            addMusicToVideo(vidUrl);
          }
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
    // Video Ads page no longer exposes Cinematic — clear stale persisted state.
    if (family === "cinematic") {
      setFamily(null);
      setArchetypeId(null);
      setStep("family");
      return;
    }
    // Auto-advance from family → archetype once family picked but archetype empty
    if (step === "family" && family) setStep("archetype");
  }, [step, family, setStep, setFamily, setArchetypeId]);

  // ─── Model auto-recommendation on family / clip-length CHANGE ───
  // We nudge the user toward the right model when family or length changes,
  // but RESPECT manual overrides afterwards. The ref tracks the last
  // family|clipLength tuple we auto-selected for — when the user clicks a
  // different model the effect doesn't fire (deps didn't change), and the
  // tuple stays the same.
  // Recommendations:
  //   Commercial   → Seedance 2.0 (keyframe-anchored multishot)
  //   UGC + 10s    → Seedance 2.0 (mandatory for native lip-sync + 3-frame seam)
  //   UGC + 5s     → Kling 3.0    (fast iteration for hook variants)
  const lastAutoModelKey = useRef<string>("");
  useEffect(() => {
    const key = `${family || "none"}|${clipLength}`;
    if (lastAutoModelKey.current === key) return;
    lastAutoModelKey.current = key;
    if (family === "commercial") {
      setVideoModel("seedance-2");
    } else if (family === "ugc" && clipLength === 10) {
      setVideoModel("seedance-2");
    } else if (family === "ugc" && clipLength === 5) {
      setVideoModel("kling-3.0");
    }
  }, [family, clipLength, setVideoModel]);

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
      {/* Video Ads page exposes only UGC + Commercial. Cinematic stays
          available in the codebase (used by Studio page) but is filtered out
          here — this page is laser-focused on conversion-optimized ad creative. */}
      {step === "family" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl mx-auto">
          {(Object.keys(FAMILY_META) as ArchetypeFamily[])
            .filter((f) => f !== "cinematic")
            .map((f) => {
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

              {/* Hair color + Eye color — second row, optional refinements */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={t("ugc.creator.hairColor")}>
                  <select
                    value={creatorOverrides.hairColor ?? "any"}
                    onChange={(e) => setCreatorOverrides({ hairColor: e.target.value as CreatorHairColor })}
                    className="inp"
                  >
                    <option value="any">{t("ugc.creator.hairColor.any")}</option>
                    <option value="black">{t("ugc.creator.hairColor.black")}</option>
                    <option value="dark-brown">{t("ugc.creator.hairColor.darkBrown")}</option>
                    <option value="brown">{t("ugc.creator.hairColor.brown")}</option>
                    <option value="light-brown">{t("ugc.creator.hairColor.lightBrown")}</option>
                    <option value="blonde">{t("ugc.creator.hairColor.blonde")}</option>
                    <option value="red">{t("ugc.creator.hairColor.red")}</option>
                    <option value="auburn">{t("ugc.creator.hairColor.auburn")}</option>
                    <option value="grey">{t("ugc.creator.hairColor.grey")}</option>
                    <option value="white">{t("ugc.creator.hairColor.white")}</option>
                    <option value="colored">{t("ugc.creator.hairColor.colored")}</option>
                  </select>
                </Field>

                <Field label={t("ugc.creator.eyeColor")}>
                  <select
                    value={creatorOverrides.eyeColor ?? "any"}
                    onChange={(e) => setCreatorOverrides({ eyeColor: e.target.value as CreatorEyeColor })}
                    className="inp"
                  >
                    <option value="any">{t("ugc.creator.eyeColor.any")}</option>
                    <option value="dark-brown">{t("ugc.creator.eyeColor.darkBrown")}</option>
                    <option value="brown">{t("ugc.creator.eyeColor.brown")}</option>
                    <option value="hazel">{t("ugc.creator.eyeColor.hazel")}</option>
                    <option value="green">{t("ugc.creator.eyeColor.green")}</option>
                    <option value="blue">{t("ugc.creator.eyeColor.blue")}</option>
                    <option value="grey">{t("ugc.creator.eyeColor.grey")}</option>
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
          {/* Family mode banner — shows which style path the user is on */}
          {family === "ugc" && (
            <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-500/8 border border-blue-500/25 text-sm">
              <span className="text-base">🎥</span>
              <div>
                <span className="font-semibold text-blue-600 dark:text-blue-400">UGC Style</span>
                <span className="text-muted ml-2">Creator on camera · TikTok / Reels format · creator promotes your product directly to the viewer</span>
              </div>
            </div>
          )}
          {family === "commercial" && (
            <div className="mb-4 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 text-sm">
              <span className="text-base">✨</span>
              <div>
                <span className="font-semibold text-amber-600 dark:text-amber-400">Commercial Style</span>
                <span className="text-muted ml-2">No people on screen · product macro shots · ingredient details · cinematic product-hero visuals</span>
              </div>
            </div>
          )}
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
            {/* Voice mode selector only for UGC family.
                Commercial + Cinematic videos are silent by design (no
                narration/voiceover), so we skip this section entirely.
                Kling videos cannot embed audio natively — voiceover plays
                as a separate audio player; toggle is grayed out. */}
            {isVoiceoverFamily && (
              <Field label={t("ugc.voice.label")}>
                {!isSeedance ? (
                  // Kling: voiceover is always separate, toggle is locked
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <button
                        disabled
                        className="px-3 py-1.5 text-sm rounded-lg border bg-primary text-white border-primary opacity-40 cursor-not-allowed"
                      >
                        {t("ugc.voice.voiceover")}
                      </button>
                      <button
                        disabled
                        className="px-3 py-1.5 text-sm rounded-lg border border-border opacity-40 cursor-not-allowed"
                      >
                        {t("ugc.voice.textOverlay")}
                      </button>
                    </div>
                    <div className="text-[11px] text-muted">
                      Kling videos are silent — voiceover plays as a separate audio track alongside the video.
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
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
                    <div className="text-[11px] text-muted">
                      {voiceMode === "text-overlay" ? t("ugc.voice.textOverlayHint") : t("ugc.voice.voiceoverHint")}
                    </div>
                  </div>
                )}
              </Field>
            )}

            {/* Clip-length selector — UGC v2 only (UGC family + Seedance).
                5s = 2 anchored frames, 1 Seedance call.
                10s = 4 anchored frames, 2 parallel Seedance calls stitched
                together. 10s costs roughly 2× and takes ~2× longer. */}
            {isVoiceoverFamily && isSeedance && (
              <Field label={tM("ugc.clipLength.label", "Clip length")}>
                <div className="flex gap-2">
                  {([
                    { sec: 5 as const, cost: "≈$5.85" },
                    { sec: 10 as const, cost: "≈$11.70" },
                  ]).map((opt) => {
                    const active = clipLength === opt.sec;
                    return (
                      <button
                        key={opt.sec}
                        onClick={() => setClipLength(opt.sec)}
                        className={`px-3 py-1.5 text-sm rounded-lg border flex flex-col items-start gap-0 ${
                          active ? "bg-primary text-white border-primary" : "border-border hover:border-border-hover"
                        }`}
                      >
                        <span className="font-medium">
                          {opt.sec}s
                          <span className={`ml-1.5 text-[10px] ${active ? "text-white/80" : "text-muted"}`}>
                            ({opt.sec === 5 ? tM("ugc.clipLength.oneSegment", "1 segment") : tM("ugc.clipLength.twoSegments", "2 stitched segments")})
                          </span>
                        </span>
                        <span className={`text-[10px] font-mono ${active ? "text-white/80" : "text-muted"}`}>
                          {opt.cost}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {clipLength === 10
                    ? tM("ugc.clipLength.hint10", "10s = 4 keyframes, 2 Seedance renders stitched with 200ms audio crossfade. ~2× cost and wait time.")
                    : tM("ugc.clipLength.hint5", "5s = 2 keyframes, 1 Seedance render. Fastest and cheapest.")}
                </div>
              </Field>
            )}
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
          {family === "ugc" && (
            <div className="mb-4 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-blue-500/8 border border-blue-500/25 text-xs">
              <span>🎥</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">UGC Style</span>
              <span className="text-muted">· Creator on camera in every frame · TikTok / Reels</span>
            </div>
          )}
          {family === "commercial" && (
            <div className="mb-4 flex items-center gap-2.5 px-4 py-2 rounded-xl bg-amber-500/8 border border-amber-500/25 text-xs">
              <span>✨</span>
              <span className="font-semibold text-amber-600 dark:text-amber-400">Commercial Style</span>
              <span className="text-muted">· Product macro · ingredient details · no people</span>
            </div>
          )}
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

          {/* Storyboard guidance banner — research shows the hook frame and the
              end (CTA) frame are where storyboarding actually moves conversion.
              Middle frames are de-emphasised. */}
          <div className="mb-3 px-4 py-3 rounded-lg bg-accent/5 border border-accent/20">
            <div className="text-xs font-semibold text-accent mb-1">
              {tM("ugc.story.philosophy.title", "Storyboard the hook + end frame. Improvise the middle.")}
            </div>
            <div className="text-[11px] text-muted leading-snug">
              {tM(
                "ugc.story.philosophy.body",
                "First 1.5s arrest viewers; the end frame closes the sale. Storyboarding these two beats lifts hook rate 20–40% (Motion + Foreplay 2025). The middle is improvisation territory — perfecting it is process theater."
              )}
            </div>
          </div>

          {/* Keyframes — drag-to-reorder, add/remove */}
          {/* UGC v2 = UGC family + Seedance uses 2 anchored frames (opening + closing) */}
          <div className="flex flex-wrap gap-4 mb-2">
            {keyframes.map((k, arrIdx) => {
              const selected = heroFrameIndex === k.index;
              const isDragging = dragIndex === arrIdx;
              const isDragOver = dragOverIndex === arrIdx;
              const isUgcV2Frame = family === "ugc" && isSeedance;
              const frameLabel = isUgcV2Frame
                ? k.label || (arrIdx === 0 ? "Opening" : "Closing")
                : `${t("ugc.story.frame")} ${arrIdx + 1}`;
              // Hook frame = always frame 0. End frame = last frame.
              // Middle frames (anything in between) get de-emphasised.
              const isHookFrame = arrIdx === 0;
              const isEndFrame = arrIdx === keyframes.length - 1;
              const isMiddleFrame = !isHookFrame && !isEndFrame;
              // Width: 2 frames split the row in half; 3 frames use thirds.
              const frameWidthClass = isUgcV2Frame
                ? "w-[calc(50%-0.75rem)] min-w-[180px]"
                : "w-[calc(33.333%-0.75rem)] min-w-[140px]";
              return (
                <div
                  key={`frame-${arrIdx}`}
                  draggable={!isUgcV2Frame}
                  onDragStart={(e) => handleFrameDragStart(e, arrIdx)}
                  onDragOver={(e) => handleFrameDragOver(e, arrIdx)}
                  onDrop={(e) => handleFrameDrop(e, arrIdx)}
                  onDragEnd={handleFrameDragEnd}
                  className={`${frameWidthClass} rounded-xl border bg-card overflow-hidden transition-all
                    ${selected ? "border-accent ring-2 ring-accent/30" : isHookFrame ? "border-amber-400/60 ring-1 ring-amber-400/30" : isEndFrame ? "border-emerald-400/60 ring-1 ring-emerald-400/30" : isMiddleFrame ? "border-border opacity-90" : "border-border"}
                    ${isDragging ? "opacity-40 scale-95" : ""}
                    ${isDragOver && !isDragging ? "ring-2 ring-accent/50 border-accent/50" : ""}
                  `}
                  style={{ flexShrink: 0 }}
                >
                  {/* Drag handle + remove */}
                  <div className={`flex items-center justify-between px-2 py-1.5 cursor-grab active:cursor-grabbing ${
                    isHookFrame ? "bg-amber-400/10" : isEndFrame ? "bg-emerald-400/10" : "bg-card-hover/50"
                  }`}>
                    <div className="flex items-center gap-1.5">
                      {!isUgcV2Frame && <GripVertical className="w-3.5 h-3.5 text-muted" />}
                      {isHookFrame && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-500">
                          {tM("ugc.story.hook", "Hook")}
                        </span>
                      )}
                      {isEndFrame && !isHookFrame && (
                        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-400/20 text-emerald-500">
                          {tM("ugc.story.end", "End / CTA")}
                        </span>
                      )}
                      <span className={`text-[10px] font-medium uppercase tracking-wider ${isMiddleFrame ? "text-muted/70" : "text-muted"}`}>
                        {frameLabel}
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

                  {/* UGC v2 — per-frame dialogue input. What the character
                      says at/during this frame. Included in the AI-Enhance
                      prompt for Seedance generate_audio. */}
                  {isUgcV2Frame && (
                    <div className="px-2.5 pb-2.5 pt-1.5 space-y-1">
                      <label className="text-[10px] uppercase font-semibold tracking-wider text-muted flex items-center gap-1">
                        <Volume2 className="w-2.5 h-2.5 text-accent" />
                        {tM("ugc.dialogue.label", "What they say here")}
                      </label>
                      <textarea
                        value={k.dialogue || ""}
                        onChange={(e) =>
                          patchKeyframe(k.index, { dialogue: e.target.value })
                        }
                        placeholder={tM(
                          "ugc.dialogue.placeholder",
                          arrIdx === 0
                            ? "e.g. Okay day 14 of this collagen shot, I'm stunned."
                            : "e.g. Recovery's different. Link's in my bio — go."
                        )}
                        rows={2}
                        className="w-full text-xs rounded-md border border-border bg-background px-2 py-1.5 leading-snug resize-none focus:outline-none focus:ring-1 focus:ring-accent"
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Append-drop slot — hidden for UGC v2 (exactly 2 frames required) */}
            {!(family === "ugc" && isSeedance) && (
              <div
                onDragOver={handleAppendDragOver}
                onDrop={handleAppendDrop}
                onClick={() => setShowContentLibrary(true)}
                className="w-[calc(33.333%-0.75rem)] min-w-[140px] aspect-[9/16] rounded-xl border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 text-muted hover:border-accent/60 hover:text-accent hover:bg-accent/5 transition-colors cursor-pointer"
                title={t("ugc.story.clickToAdd")}
              >
                <Plus className="w-6 h-6" />
                <span className="text-[10px] uppercase tracking-wider font-medium text-center px-2">
                  {t("ugc.story.addFromLibrary")}
                </span>
              </div>
            )}
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
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        draggable
                        onDragStart={(e) => handleLibraryDragStart(e, item.resultUrl)}
                        onClick={() => addFrameFromHistory(item.resultUrl)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            addFrameFromHistory(item.resultUrl);
                          }
                        }}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent/50 hover:ring-1 hover:ring-accent/30 transition-all cursor-grab active:cursor-grabbing"
                        title={t("ugc.story.clickToAdd")}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={item.resultUrl}
                          alt=""
                          className="w-full h-full object-cover pointer-events-none"
                          loading="lazy"
                          draggable={false}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 pointer-events-none">
                          <Plus className="w-5 h-5 text-white drop-shadow-lg" />
                        </div>
                      </div>
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

          {/* Luxury ad headline overlay */}
          <UgcOverlayInputWrapper />

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
                  <div className="text-center px-4">
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
              {/* Music status — shown only for Kling (non-Seedance) */}
              {!isSeedance && videoStatus === "ready" && musicStatus === "pending" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  Adding soundtrack…
                </div>
              )}
              {!isSeedance && musicStatus === "ready" && (
                <div className="mt-2 flex items-center gap-2 text-xs text-green-500">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  Soundtrack added
                </div>
              )}
              {!isSeedance && musicStatus === "error" && (
                <div className="mt-2 text-[11px] text-muted">
                  Soundtrack unavailable — video is ready without music.
                </div>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
              {/* Voiceover OR text overlay section */}
              {effectiveVoiceMode === "text-overlay" ? (
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
              {videoUrl && (effectiveVoiceMode === "text-overlay" || ttsUrl) && (
                <div className="pt-2 border-t border-border text-xs text-muted">
                  {effectiveVoiceMode === "text-overlay" ? t("ugc.video.tipTextOverlay") : isSeedance ? t("ugc.video.tipSeedance") : t("ugc.video.tip")}
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

// Wraps the shared LuxuryOverlayInput with ui-store state for the UGC page.
function UgcOverlayInputWrapper() {
  const overlayText = useUIStore((s) => s.overlayText);
  const setOverlayText = useUIStore((s) => s.setOverlayText);
  const overlayFontId = useUIStore((s) => s.overlayFontId);
  const setOverlayFontId = useUIStore((s) => s.setOverlayFontId);
  return (
    <LuxuryOverlayInput
      value={overlayText}
      onChange={setOverlayText}
      fontId={overlayFontId}
      onFontChange={setOverlayFontId}
      progress={null}
    />
  );
}
