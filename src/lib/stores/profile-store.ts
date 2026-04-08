"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface BrandAssets {
  name: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface ProfileStore {
  activeProfileId: string | null;
  brandAssets: BrandAssets;
  setActiveProfile: (id: string) => void;
  setBrandAssets: (assets: Partial<BrandAssets>) => void;
  reset: () => void;
}

export const useProfileStore = create<ProfileStore>()(
  persist(
    (set) => ({
      activeProfileId: null,
      brandAssets: { name: "" },

      setActiveProfile: (id) => set({ activeProfileId: id }),

      setBrandAssets: (assets) =>
        set((state) => ({
          brandAssets: { ...state.brandAssets, ...assets },
        })),

      reset: () => set({ activeProfileId: null, brandAssets: { name: "" } }),
    }),
    {
      name: "studio-profile",
    }
  )
);
