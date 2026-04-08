"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { t as translate, tMaybe, type Locale, type TranslationKey } from "./translations";

export type { Locale, TranslationKey };
export { LOCALE_LABELS, LOCALE_NAMES } from "./translations";

interface I18nStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useI18nStore = create<I18nStore>()(
  persist(
    (set) => ({
      locale: "en",
      setLocale: (locale) => set({ locale }),
    }),
    { name: "studio-locale" }
  )
);

/** Hook that returns a translation function bound to the current locale */
export function useT() {
  const locale = useI18nStore((s) => s.locale);
  return (key: TranslationKey) => translate(key, locale);
}

/** Hook for dynamic key lookups (e.g. template names) with fallback */
export function useTMaybe() {
  const locale = useI18nStore((s) => s.locale);
  return (key: string, fallback: string) => tMaybe(key, locale, fallback);
}
