"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CalendarPost {
  id: string;
  date: string; // "YYYY-MM-DD"
  time: string; // "HH:MM" 24h format, default "12:00"
  timezone: string; // IANA timezone e.g. "America/New_York"
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  presetId: string | null; // social preset used for export sizing
  presetLabel: string | null;
  platform: string | null;
  accountId: string | null;
  status: "draft" | "scheduled" | "published";
  blotatoPostId: string | null;
}

interface CalendarStore {
  posts: CalendarPost[];
  addPost: (post: CalendarPost) => void;
  updatePost: (id: string, updates: Partial<CalendarPost>) => void;
  removePost: (id: string) => void;
  movePost: (id: string, newDate: string) => void;
  getPostsForDate: (date: string) => CalendarPost[];
  clearAll: () => void;
}

export const useCalendarStore = create<CalendarStore>()(
  persist(
    (set, get) => ({
      posts: [],

      addPost: (post) =>
        set((s) => ({ posts: [...s.posts, post] })),

      updatePost: (id, updates) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      removePost: (id) =>
        set((s) => ({ posts: s.posts.filter((p) => p.id !== id) })),

      movePost: (id, newDate) =>
        set((s) => ({
          posts: s.posts.map((p) => (p.id === id ? { ...p, date: newDate } : p)),
        })),

      getPostsForDate: (date) => get().posts.filter((p) => p.date === date),

      clearAll: () => set({ posts: [] }),
    }),
    { name: "studio-calendar" }
  )
);
