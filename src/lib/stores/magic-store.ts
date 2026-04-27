/**
 * Magic-flow store — persists the user's "input as hero" state across the
 * landing page → /magic → handoff to /ugc (Video Ads).
 *
 * Sprint 1 scope: holds (productImageUrl, text) and the inferences produced
 * by /api/magic/run (vision facts, intent, archetype, hook). The /ugc page
 * reads these to pre-populate its family/archetype/audience/benefit fields,
 * skipping the manual archetype-picker and brief steps.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CreatorOverrides } from "./ugc-store";

export type FamilyChoice = "ugc" | "commercial" | "auto";

export type MagicStage =
  | "idle"
  | "uploading"
  | "analyzing"
  | "intent"
  | "archetype"
  | "hook"
  | "ready"
  | "error";

export interface MagicInference {
  /** Top-level family chosen by the LLM: "ugc" or "commercial". */
  family?: "ugc" | "commercial";
  /** Detected/confirmed product category (drives visual vocabulary). */
  category?: string;
  /** Specific archetype id picked from the library. */
  archetypeId?: string;
  /** Selected hook line (one of the top 3 from the 12-cat library). */
  hookLine?: string;
  /** Inferred audience description ("late-night gamers", "new mothers"). */
  audience?: string;
  /** Inferred core benefit copy ("hydrated skin in 14 days"). */
  benefit?: string;
  /** Recommended clip length (5 or 10 seconds). */
  clipLength?: 5 | 10;
}

interface MagicStore {
  productImageUrl: string | null;
  text: string;
  /** User's explicit style preference. "auto" lets the LLM decide (default). */
  familyChoice: FamilyChoice;
  stage: MagicStage;
  errorMsg: string | null;
  inference: MagicInference | null;
  /** Optional creator overrides set via the LP collapsible section. Carried
   *  into the /ugc handoff. Only honored if the inferred family is "ugc" —
   *  Commercial archetypes have no creator. Any-valued fields are skipped. */
  creatorOverrides: CreatorOverrides;

  setProductImageUrl: (url: string | null) => void;
  setText: (text: string) => void;
  setFamilyChoice: (choice: FamilyChoice) => void;
  setStage: (stage: MagicStage) => void;
  setError: (msg: string | null) => void;
  setInference: (inf: MagicInference | null) => void;
  setCreatorOverrides: (patch: Partial<CreatorOverrides>) => void;
  reset: () => void;
}

const INITIAL_CREATOR_OVERRIDES: CreatorOverrides = {
  age: "",
  gender: "any",
  race: "any",
  hairColor: "any",
  eyeColor: "any",
};

const INITIAL: Omit<
  MagicStore,
  | "setProductImageUrl"
  | "setText"
  | "setFamilyChoice"
  | "setStage"
  | "setError"
  | "setInference"
  | "setCreatorOverrides"
  | "reset"
> = {
  productImageUrl: null,
  text: "",
  familyChoice: "auto",
  stage: "idle",
  errorMsg: null,
  inference: null,
  creatorOverrides: INITIAL_CREATOR_OVERRIDES,
};

export const useMagicStore = create<MagicStore>()(
  persist(
    (set) => ({
      ...INITIAL,
      setProductImageUrl: (url) => set({ productImageUrl: url }),
      setText: (text) => set({ text }),
      setFamilyChoice: (familyChoice) => set({ familyChoice }),
      setStage: (stage) => set({ stage }),
      setError: (errorMsg) => set({ errorMsg }),
      setInference: (inference) => set({ inference }),
      setCreatorOverrides: (patch) =>
        set((s) => ({ creatorOverrides: { ...s.creatorOverrides, ...patch } })),
      reset: () => set(INITIAL),
    }),
    {
      name: "studio-magic",
      // Don't persist transient stage / error fields — only the user input,
      // optional creator overrides, and the inference (expensive to recompute).
      partialize: (s) => ({
        productImageUrl: s.productImageUrl,
        text: s.text,
        familyChoice: s.familyChoice,
        creatorOverrides: s.creatorOverrides,
        inference: s.inference,
      }),
    }
  )
);
