import type { VideoModel } from "@/lib/stores/ugc-store";
import type { ArchetypeFamily } from "@/lib/ugc/archetypes";

export type AdPath =
  | "ugc-kling"
  | "ugc-seedance-5s"
  | "ugc-seedance-10s"
  | "commercial-kling"
  | "commercial-seedance";

export type AudioType = "music-only" | "native-voiceover" | "text-overlay-only";

export interface PathConfig {
  family: ArchetypeFamily;
  videoModel: VideoModel;
  clipLength: 5 | 10;
  durationSec: number;        // actual video seconds
  durationLabel: string;      // "5s", "8s", "10s"
  frameCount: 2 | 3;
  chainsFrames: boolean;      // sequential identity chain (UGC only)
  hasMusic: boolean;          // MMAudio runs after video
  audioType: AudioType;
  voiceToggleAvailable: boolean; // user can pick voiceover vs text-overlay
  costUsd: number;
  label: string;              // short model name for UI
  description: string;        // one-line capability summary
  badges: string[];           // restriction/capability chips shown on model card
}

export const PATH_CONFIG: Record<AdPath, PathConfig> = {
  "ugc-kling": {
    family: "ugc", videoModel: "kling-3.0", clipLength: 5, durationSec: 5,
    durationLabel: "5s", frameCount: 3, chainsFrames: true,
    hasMusic: true, audioType: "music-only", voiceToggleAvailable: false,
    costUsd: 2.00, label: "Kling 3.0",
    description: "5s creator video · AI background music · fast iteration",
    badges: ["5 sec", "Music only", "No narration", "Fast"],
  },
  "ugc-seedance-5s": {
    family: "ugc", videoModel: "seedance-2-fast", clipLength: 5, durationSec: 5,
    durationLabel: "5s", frameCount: 2, chainsFrames: true,
    hasMusic: false, audioType: "native-voiceover", voiceToggleAvailable: true,
    costUsd: 5.85, label: "Seedance Fast",
    description: "5s creator video · native voiceover · keyframe-anchored",
    badges: ["5 sec", "Native voice", "Creator on-camera", "Balanced"],
  },
  "ugc-seedance-10s": {
    family: "ugc", videoModel: "seedance-2", clipLength: 10, durationSec: 10,
    durationLabel: "10s", frameCount: 3, chainsFrames: true,
    hasMusic: false, audioType: "native-voiceover", voiceToggleAvailable: true,
    costUsd: 5.00, label: "Seedance Full",
    description: "10s creator video · native voiceover · highest quality",
    badges: ["10 sec", "Native voice", "Long-form", "High quality"],
  },
  "commercial-kling": {
    family: "commercial", videoModel: "kling-3.0", clipLength: 5, durationSec: 5,
    durationLabel: "5s", frameCount: 3, chainsFrames: false,
    hasMusic: true, audioType: "music-only", voiceToggleAvailable: false,
    costUsd: 2.00, label: "Kling 3.0",
    description: "5s product-hero video · cinematic music · no people",
    badges: ["5 sec", "Music only", "No people", "Product macro"],
  },
  "commercial-seedance": {
    family: "commercial", videoModel: "seedance-2", clipLength: 5, durationSec: 8,
    durationLabel: "8s", frameCount: 3, chainsFrames: false,
    hasMusic: true, audioType: "music-only", voiceToggleAvailable: false,
    costUsd: 5.00, label: "Seedance Full",
    description: "8s product-hero video · cinematic music · no people",
    badges: ["8 sec", "Music only", "No people", "Cinematic"],
  },
};

export function getAdPath(
  family: ArchetypeFamily | null,
  videoModel: VideoModel,
  clipLength: 5 | 10
): AdPath {
  if (family === "commercial") {
    return videoModel === "kling-3.0" ? "commercial-kling" : "commercial-seedance";
  }
  // UGC
  if (videoModel === "kling-3.0") return "ugc-kling";
  if (clipLength === 10) return "ugc-seedance-10s";
  return "ugc-seedance-5s";
}

// Helper predicates (replace all scattered conditions in page.tsx)
export const isUgcPath      = (p: AdPath) => PATH_CONFIG[p].family === "ugc";
export const isSeedancePath = (p: AdPath) => PATH_CONFIG[p].videoModel !== "kling-3.0";
export const isV2Path       = (p: AdPath) => isUgcPath(p) && isSeedancePath(p);
export const isLongPath     = (p: AdPath) => p === "ugc-seedance-10s";
export const requiresVoice  = (p: AdPath, voiceMode: string) =>
  PATH_CONFIG[p].voiceToggleAvailable && voiceMode === "voiceover";
