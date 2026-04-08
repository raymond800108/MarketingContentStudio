"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TaskInfo {
  taskId: string;
  sourceUrl: string;
  sourceId: string;
  taskType: "image" | "video";
}

export interface GeneratedImage {
  url: string;
  sourceId: string;
}

export interface GeneratedVideo {
  url: string;
}

export interface HistoryItem {
  id: string;
  sourceUrl: string;
  resultUrl: string;
  profileId: string;
  mode: "image" | "video";
  prompt: string;
  timestamp: number;
}

interface GenerationStore {
  // Tasks
  activeTasks: TaskInfo[];
  addTask: (task: TaskInfo) => void;
  removeTask: (taskId: string) => void;
  clearTasks: () => void;

  // Results
  generatedImages: GeneratedImage[];
  generatedVideo: GeneratedVideo | null;
  addImages: (images: GeneratedImage[]) => void;
  setVideo: (video: GeneratedVideo | null) => void;
  clearResults: () => void;

  // History
  history: HistoryItem[];
  addHistory: (item: HistoryItem) => void;
  clearHistory: () => void;

  // Loading
  loading: boolean;
  videoLoading: boolean;
  error: string | null;
  setLoading: (loading: boolean) => void;
  setVideoLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useGenerationStore = create<GenerationStore>()(
  persist(
    (set) => ({
      // Tasks
      activeTasks: [],
      addTask: (task) =>
        set((s) => ({ activeTasks: [...s.activeTasks, task] })),
      removeTask: (taskId) =>
        set((s) => ({
          activeTasks: s.activeTasks.filter((t) => t.taskId !== taskId),
        })),
      clearTasks: () => set({ activeTasks: [] }),

      // Results
      generatedImages: [],
      generatedVideo: null,
      addImages: (images) =>
        set((s) => ({
          generatedImages: [...s.generatedImages, ...images],
        })),
      setVideo: (video) => set({ generatedVideo: video }),
      clearResults: () => set({ generatedImages: [], generatedVideo: null }),

      // History
      history: [],
      addHistory: (item) =>
        set((s) => ({ history: [item, ...s.history].slice(0, 100) })),
      clearHistory: () => set({ history: [] }),

      // Loading
      loading: false,
      videoLoading: false,
      error: null,
      setLoading: (loading) => set({ loading }),
      setVideoLoading: (videoLoading) => set({ videoLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: "studio-generation",
      partialize: (state) => ({
        generatedImages: state.generatedImages,
        generatedVideo: state.generatedVideo,
        history: state.history,
      }),
    }
  )
);
