"use client";

/**
 * UGC studio session state.
 *
 * Flow: family → archetype → product image → brief → AI Enhance →
 * storyboard (3 keyframes) → pick hero frame → video (Kling 3.0 i2v) →
 * TTS voiceover → final preview.
 *
 * Persisted so refresh doesn't nuke a work-in-progress brief.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArchetypeFamily } from "@/lib/ugc/archetypes";

export type UgcStep =
  | "family"
  | "archetype"
  | "style"
  | "model"
  | "product"
  | "brief"
  | "storyboard"
  | "video"
  | "done";

export type VideoModel = "kling-3.0" | "seedance-2-fast" | "seedance-2";

/**
 * Voice mode for UGC video output:
 *  - "voiceover"    — TTS audio, creator speaks to camera / narrator VO
 *  - "text-overlay" — no audio, key phrases appear as on-screen text
 */
export type VoiceMode = "voiceover" | "text-overlay";

/**
 * User-editable creator demographic overrides. These get merged INTO the
 * archetype's `creatorPrompt` fragment so the same archetype template can be
 * rendered as a range of real people. All fields optional — unset falls back
 * to the archetype's built-in description.
 */
export type CreatorGender = "female" | "male" | "nonbinary" | "any";
export type CreatorRace =
  | "east-asian"
  | "southeast-asian"
  | "south-asian"
  | "white"
  | "black"
  | "latino"
  | "middle-eastern"
  | "any";
export type CreatorHairColor =
  | "any"
  | "black"
  | "dark-brown"
  | "brown"
  | "light-brown"
  | "blonde"
  | "red"
  | "auburn"
  | "grey"
  | "white"
  | "colored"; // pink/blue/pastel/etc.
export type CreatorEyeColor =
  | "any"
  | "dark-brown"
  | "brown"
  | "hazel"
  | "green"
  | "blue"
  | "grey";

export interface CreatorOverrides {
  /** Approximate age or age band, e.g. "24", "early 30s", "late 20s". */
  age: string;
  gender: CreatorGender;
  race: CreatorRace;
  /** Hair color — "any" means defer to archetype description. */
  hairColor?: CreatorHairColor;
  /** Eye color — "any" means defer to archetype description. */
  eyeColor?: CreatorEyeColor;
}

/**
 * Per-generation cost shown on the Generate button (includes ×5 profit margin).
 * Seedance: 720p with reference images × 8 sec × 5.
 * Kling: 5 sec with reference image × 5.
 */
export const VIDEO_MODEL_COST_USD: Record<VideoModel, number> = {
  "kling-3.0": 2.00,            // raw $0.08/sec × 5s × 5 margin
  "seedance-2-fast": 5.85,      // raw $1.17 (234 credits) × 5 margin
  "seedance-2": 5.00,           // raw $0.125/sec × 8s × 5 margin
};

export interface Keyframe {
  /** 0-indexed frame number within the storyboard. */
  index: number;
  /** Human-readable beat label e.g. "Hook", "Demo", "CTA". */
  label: string;
  /** The prompt we sent to image gen — stored for regen. */
  prompt: string;
  /** Which reference images to pass into gpt-image-2 for THIS frame.
   *  E.g. Creator + Product frames get [productImageUrl]; Scene frame gets []
   *  because passing the product image into a "no people / no product"
   *  scene plate causes Kie to reject. Defaults to [productImageUrl] when
   *  undefined for back-compat. */
  imageInputs?: string[];
  /** Kie task id for tracking. */
  taskId?: string;
  /** FAL CDN URL of the rendered keyframe image. */
  imageUrl?: string;
  status: "idle" | "pending" | "ready" | "error";
  error?: string;
  /** UGC v2 — what the character says during this frame. Included in the
   *  final Seedance prompt (with [ImageN] token) so generate_audio produces
   *  the right voice + rough mouth sync. Only meaningful for UGC family. */
  dialogue?: string;
}

/**
 * A single marketing angle, following the canonical short-form engagement
 * formula: HOOK → BENEFIT → PROBLEM-SOLVE → CTA (to exclusive landing).
 *
 * We generate 3 of these per brief so the user can pick whichever creative
 * frame resonates (Problem/Solution, Before/After, FOMO, Authority, etc.)
 * without re-running the whole enhance step.
 */
export interface CreativeAngle {
  /** Short label for the angle, e.g. "Problem → Solution", "FOMO Drop". */
  name: string;
  /** 2-3s scroll-stopping opener. */
  hook: string;
  /** What the product actually does — capability statement. */
  benefit: string;
  /** The concrete pain / annoyance / mistake the product kills. */
  problemSolve: string;
  /** Urge action to landing page / exclusive offer — must reference a link. */
  cta: string;
  /** The natural merged spoken VO, ~22-32 words, 8-10s at speaking pace.
   *  Reads as ONE paragraph that weaves all 4 beats together. */
  fullScript: string;
  /** Short on-screen text phrases for text-overlay mode (3-4 punchy lines).
   *  Only populated when voiceMode === "text-overlay". */
  overlayTexts?: string[];
  /** ── UGC v2 two-keyframe workflow (Seedance first_frame + last_frame mode) ──
   *  These fields are optional and only populated for the UGC family. They let
   *  the Seedance keyframe-anchored pipeline produce consistent visuals with
   *  per-frame spoken dialogue. Commercial/Cinematic families leave these blank. */
  /** Visual description of what the OPENING frame shows. */
  openingBeat?: string;
  /** Visual description of what the CLOSING frame shows. */
  closingBeat?: string;
  /** What the character says at/during the opening frame (~1-2 sentences). */
  openingLine?: string;
  /** What the character says at/during the closing frame (~1-2 sentences). */
  closingLine?: string;
  /** Motion / action happening between the two keyframes.
   *  Back-compat single-string representation; prefer motions[] for new code. */
  motionPrompt?: string;
  /** Per-segment motion directives (continuous-verb style).
   *  - 2-frame (5s): 1 motion for the single 0→1 segment.
   *  - 3-frame (10s): 2 motions — motions[0]=seg1 (0→1), motions[1]=seg2 (1→2). */
  motions?: string[];
  /** 3-beat shot grammar for professional-commercial pacing.
   *  hook=0-1s arrest, promise=mid-clip demo, payoff=final CTA. */
  shotGrammar?: {
    hook?: string;
    promise?: string;
    payoff?: string;
  };
  /** ── UGC v2 3-frame 10s mode ── */
  /** Visual description of the MID frame (pivot — pixel-locked seam). */
  midBeat?: string;
  /** ── DEPRECATED: UGC v2 4-frame 10s mode (superseded by 3-frame) ── */
  frame2Beat?: string;
  frame3Beat?: string;
  frame2Line?: string;
  frame3Line?: string;
}

export interface CreativeBrief {
  /** 3 distinct marketing angles, each with the 4-beat structure. */
  angles: CreativeAngle[];
  /** Which angle drives TTS + video generation. */
  selectedAngleIndex: number;
  keyframePrompts: string[]; // 3 prompts — matches Keyframe.index
  /** Base video prompt WITHOUT the spoken line; the active angle's fullScript
   *  is appended at request time, so switching angles changes lip-sync
   *  content without re-running the brief step.
   *  For Seedance, uses [Image1/2/3] bracket tokens. */
  videoPrompt?: string;
  durationSec: number; // target video length (typically 8)
  /** Shared scene-lock block — prepended identically to every keyframe prompt
   *  so gpt-image-2 stays in the same physical scene (camera/lighting/grade/
   *  outfit/environment). Biggest single lever against frame-to-frame drift. */
  sceneLock?: {
    /** Verbatim physical description of the creator — age, ethnicity, face
     *  shape, eye description, skin tone, hair (length/color/texture/style),
     *  any distinctive features. Prepended first in every keyframe prompt as
     *  the single authoritative identity anchor. */
    creator?: string;
    camera?: string;
    lighting?: string;
    colorGrade?: string;
    environment?: string;
    outfit?: string;
  };
}

/**
 * Merge the archetype's built-in creator fragment with the user's
 * demographic overrides. The archetype's creator string already describes
 * persona / styling — we prepend explicit demographic adjectives so the
 * image model honors them without losing the archetype flavor.
 */
const RACE_LABEL: Record<CreatorRace, string> = {
  "east-asian": "East Asian",
  "southeast-asian": "Southeast Asian",
  "south-asian": "South Asian",
  white: "white / Caucasian",
  black: "Black",
  latino: "Latino / Hispanic",
  "middle-eastern": "Middle Eastern",
  any: "",
};
const GENDER_LABEL: Record<CreatorGender, string> = {
  female: "woman",
  male: "man",
  nonbinary: "non-binary person",
  any: "",
};
export function buildCreatorPrompt(
  basePrompt: string,
  overrides: CreatorOverrides
): string {
  const bits: string[] = [];
  if (overrides.age?.trim()) bits.push(`${overrides.age.trim()} years old`);
  const race = RACE_LABEL[overrides.race];
  const gender = GENDER_LABEL[overrides.gender];
  if (race || gender) {
    bits.push([race, gender].filter(Boolean).join(" ").trim());
  }
  if (bits.length === 0) return basePrompt;
  // Put the overrides FIRST so the model anchors on them before styling.
  return `${bits.join(", ")}, ${basePrompt}`;
}

/** Convenience — active angle for UI + generation paths. */
export function getActiveAngle(brief: CreativeBrief | null): CreativeAngle | null {
  if (!brief || !brief.angles || brief.angles.length === 0) return null;
  const i = Math.max(0, Math.min(brief.selectedAngleIndex ?? 0, brief.angles.length - 1));
  return brief.angles[i];
}

export interface UgcInput {
  audience: string;
  benefit: string;
  platform: "tiktok" | "reels" | "shorts" | "ig-post";
  userScript: string; // optional; "" means AI should write it
  productNotes: string; // optional free-text about product
}

interface UgcStore {
  step: UgcStep;
  family: ArchetypeFamily | null;
  archetypeId: string | null;
  creatorOverrides: CreatorOverrides;
  productImageUrl: string | null;
  /** User-uploaded optional closing frame (product hero / CTA card). */
  endFrameUrl: string | null;
  videoModel: VideoModel;
  voiceMode: VoiceMode;
  /** Language for TTS voiceover — independent of the UI language toggle. */
  voiceLanguage: string;
  /** UGC v2 only — target clip length in seconds.
   *    5  → 2 anchored frames, 1 Seedance call, single clip
   *   10  → 4 anchored frames, 2 parallel Seedance calls, stitched together */
  clipLength: 5 | 10;
  input: UgcInput;
  brief: CreativeBrief | null;
  keyframes: Keyframe[];
  heroFrameIndex: number; // which keyframe drives Kling i2v (Seedance uses all 3 as refs)
  videoTaskId: string | null;
  videoUrl: string | null;
  videoStatus: "idle" | "pending" | "ready" | "error";
  videoError: string | null;
  ttsUrl: string | null;
  ttsDurationSec: number | null;
  ttsStatus: "idle" | "pending" | "ready" | "error";
  ttsError: string | null;
  /** MMAudio soundtrack request ID (Kling videos only). */
  musicRequestId: string | null;
  musicStatus: "idle" | "pending" | "ready" | "error";
  musicError: string | null;

  setStep: (step: UgcStep) => void;
  setFamily: (family: ArchetypeFamily | null) => void;
  setArchetypeId: (id: string | null) => void;
  setCreatorOverrides: (patch: Partial<CreatorOverrides>) => void;
  setProductImageUrl: (url: string | null) => void;
  setEndFrameUrl: (url: string | null) => void;
  setVideoModel: (m: VideoModel) => void;
  setVoiceMode: (m: VoiceMode) => void;
  setVoiceLanguage: (lang: string) => void;
  setClipLength: (sec: 5 | 10) => void;
  setInput: (patch: Partial<UgcInput>) => void;
  setBrief: (brief: CreativeBrief | null) => void;
  setSelectedAngle: (i: number) => void;
  setKeyframes: (frames: Keyframe[]) => void;
  patchKeyframe: (index: number, patch: Partial<Keyframe>) => void;
  setHeroFrameIndex: (i: number) => void;
  setVideo: (patch: Partial<Pick<UgcStore, "videoTaskId" | "videoUrl" | "videoStatus" | "videoError">>) => void;
  setTts: (patch: Partial<Pick<UgcStore, "ttsUrl" | "ttsDurationSec" | "ttsStatus" | "ttsError">>) => void;
  setMusic: (patch: Partial<Pick<UgcStore, "musicRequestId" | "musicStatus" | "musicError">>) => void;
  reset: () => void;
}

const INITIAL_CREATOR_OVERRIDES: CreatorOverrides = {
  age: "",
  gender: "any",
  race: "any",
  hairColor: "any",
  eyeColor: "any",
};

const INITIAL_INPUT: UgcInput = {
  audience: "",
  benefit: "",
  platform: "tiktok",
  userScript: "",
  productNotes: "",
};

export const useUgcStore = create<UgcStore>()(
  persist(
    (set) => ({
      step: "family",
      family: null,
      archetypeId: null,
      creatorOverrides: INITIAL_CREATOR_OVERRIDES,
      productImageUrl: null,
      endFrameUrl: null,
      videoModel: "seedance-2-fast",
      voiceMode: "voiceover",
      voiceLanguage: "en",
      clipLength: 5,
      input: INITIAL_INPUT,
      brief: null,
      keyframes: [],
      heroFrameIndex: 0,
      videoTaskId: null,
      videoUrl: null,
      videoStatus: "idle",
      videoError: null,
      ttsUrl: null,
      ttsDurationSec: null,
      ttsStatus: "idle",
      ttsError: null,
      musicRequestId: null,
      musicStatus: "idle",
      musicError: null,

      setStep: (step) => set({ step }),
      setFamily: (family) => set({ family }),
      setArchetypeId: (archetypeId) => set({ archetypeId }),
      setCreatorOverrides: (patch) =>
        set((s) => ({ creatorOverrides: { ...s.creatorOverrides, ...patch } })),
      setProductImageUrl: (productImageUrl) => set({ productImageUrl }),
      setEndFrameUrl: (endFrameUrl) => set({ endFrameUrl }),
      setVideoModel: (videoModel) => set({ videoModel }),
      setClipLength: (clipLength) => set({ clipLength }),
      setVoiceMode: (voiceMode) => set({ voiceMode }),
      setVoiceLanguage: (voiceLanguage) => set({ voiceLanguage }),
      setInput: (patch) => set((s) => ({ input: { ...s.input, ...patch } })),
      setBrief: (brief) => set({ brief }),
      setSelectedAngle: (i) =>
        set((s) => (s.brief ? { brief: { ...s.brief, selectedAngleIndex: i } } : s)),
      setKeyframes: (keyframes) => set({ keyframes }),
      patchKeyframe: (index, patch) =>
        set((s) => ({
          keyframes: s.keyframes.map((k) => (k.index === index ? { ...k, ...patch } : k)),
        })),
      setHeroFrameIndex: (heroFrameIndex) => set({ heroFrameIndex }),
      setVideo: (patch) => set((s) => ({ ...s, ...patch })),
      setTts: (patch) => set((s) => ({ ...s, ...patch })),
      setMusic: (patch) => set((s) => ({ ...s, ...patch })),

      reset: () =>
        set({
          step: "family",
          family: null,
          archetypeId: null,
          creatorOverrides: INITIAL_CREATOR_OVERRIDES,
          productImageUrl: null,
          endFrameUrl: null,
          videoModel: "seedance-2-fast",
          voiceMode: "voiceover",
          voiceLanguage: "en",
          clipLength: 5,
          input: INITIAL_INPUT,
          brief: null,
          keyframes: [],
          heroFrameIndex: 0,
          videoTaskId: null,
          videoUrl: null,
          videoStatus: "idle",
          videoError: null,
          ttsUrl: null,
          ttsDurationSec: null,
          ttsStatus: "idle",
          ttsError: null,
          musicRequestId: null,
          musicStatus: "idle",
          musicError: null,
        }),
    }),
    { name: "studio-ugc" }
  )
);
