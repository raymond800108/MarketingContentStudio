"use client";

import { create } from "zustand";

interface UIStore {
  contentType: "image" | "video";
  aspectRatio: string;
  videoModel: string;
  selectedTemplate: string | null;
  productDimension: string;

  setContentType: (type: "image" | "video") => void;
  setAspectRatio: (ratio: string) => void;
  setVideoModel: (model: string) => void;
  setSelectedTemplate: (id: string | null) => void;
  setProductDimension: (dim: string) => void;
  resetUI: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  contentType: "image",
  aspectRatio: "4:3",
  videoModel: "kling-2.6",
  selectedTemplate: null,
  productDimension: "",

  setContentType: (contentType) => set({ contentType }),
  setAspectRatio: (aspectRatio) => set({ aspectRatio }),
  setVideoModel: (videoModel) => set({ videoModel }),
  setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate }),
  setProductDimension: (productDimension) => set({ productDimension }),
  resetUI: () =>
    set({
      contentType: "image",
      selectedTemplate: null,
      productDimension: "",
    }),
}));
