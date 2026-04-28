"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AppTheme = "dark" | "light";

interface ThemeStore {
  theme: AppTheme;
  setTheme: (t: AppTheme) => void;
  toggle: () => void;
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: "dark",
      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      },
      toggle: () => {
        const next: AppTheme = get().theme === "dark" ? "light" : "dark";
        get().setTheme(next);
      },
    }),
    { name: "studio-theme" }
  )
);

/** Call once on mount to sync the HTML attribute with persisted state. */
export function applyPersistedTheme() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem("studio-theme");
    const parsed = raw ? JSON.parse(raw) : null;
    const theme: AppTheme = parsed?.state?.theme ?? "dark";
    document.documentElement.setAttribute("data-theme", theme);
  } catch {
    document.documentElement.setAttribute("data-theme", "dark");
  }
}
