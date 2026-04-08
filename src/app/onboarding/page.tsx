"use client";

import { useRouter } from "next/navigation";
import { useProfileStore } from "@/lib/stores/profile-store";
import { PROFILE_LIST } from "@/lib/profiles";
import { Upload, ArrowRight, Languages } from "lucide-react";
import { useState } from "react";
import { useT, useTMaybe, useI18nStore, LOCALE_LABELS, LOCALE_NAMES, type Locale } from "@/lib/i18n";

const LOCALES: Locale[] = ["en", "zh-TW", "de"];

export default function OnboardingPage() {
  const router = useRouter();
  const { setActiveProfile, setBrandAssets, brandAssets } = useProfileStore();
  const [brandName, setBrandName] = useState(brandAssets.name || "");
  const t = useT();
  const tM = useTMaybe();
  const { locale, setLocale } = useI18nStore();
  const [langOpen, setLangOpen] = useState(false);

  const handleSelect = (profileId: string) => {
    if (brandName.trim()) {
      setBrandAssets({ name: brandName.trim() });
    }
    setActiveProfile(profileId);
    router.push("/studio");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 relative">
      {/* Language toggle — top right */}
      <div className="absolute top-4 right-4">
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border hover:border-border-hover transition-colors text-sm"
          >
            <Languages className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs font-medium">{LOCALE_LABELS[locale]}</span>
          </button>
          {langOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-40 bg-card rounded-xl border border-border shadow-lg z-50 py-1">
                {LOCALES.map((loc) => (
                  <button
                    key={loc}
                    onClick={() => { setLocale(loc); setLangOpen(false); }}
                    className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-card-hover transition-colors ${
                      loc === locale ? "bg-card-hover font-medium" : ""
                    }`}
                  >
                    <span>{LOCALE_NAMES[loc]}</span>
                    <span className="text-xs text-muted">{LOCALE_LABELS[loc]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Brand name input */}
      <div className="mb-10 text-center">
        <input
          type="text"
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder={t("onboarding.brandPlaceholder")}
          className="text-center text-3xl font-semibold tracking-tight bg-transparent border-none outline-none placeholder:text-muted/40 focus:placeholder:text-muted/20 w-80"
        />
        <p className="text-sm text-muted mt-2">{t("onboarding.brandHint")}</p>
      </div>

      {/* Heading */}
      <h1 className="text-4xl font-bold tracking-tight text-center mb-2">
        {t("onboarding.title")}
      </h1>
      <p className="text-muted text-lg mb-12 text-center max-w-md">
        {t("onboarding.subtitle")}
      </p>

      {/* Category grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl w-full mb-16">
        {PROFILE_LIST.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile.id)}
            className="group relative flex flex-col items-start p-6 rounded-2xl border-2 border-border bg-card hover:border-accent hover:shadow-lg transition-all text-left"
          >
            <span className="text-4xl mb-4">{profile.icon}</span>
            <h3 className="text-lg font-semibold mb-1">{tM(`profile.${profile.id}`, profile.name)}</h3>
            <p className="text-sm text-muted leading-relaxed">{tM(`profile.${profile.id}.desc`, profile.description)}</p>
            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <ArrowRight className="w-5 h-5 text-accent" />
            </div>
          </button>
        ))}
      </div>

      {/* Auto-detect teaser */}
      <div className="flex flex-col items-center text-center">
        <div className="w-px h-8 bg-border mb-4" />
        <div className="flex items-center gap-3 px-6 py-4 rounded-2xl border-2 border-dashed border-border text-muted">
          <Upload className="w-5 h-5" />
          <div>
            <p className="text-sm font-medium text-foreground/70">{t("onboarding.dropPhoto")}</p>
            <p className="text-xs text-muted">{t("onboarding.autoDetect")}</p>
          </div>
        </div>
        <p className="text-[11px] text-muted/50 mt-3">{t("onboarding.comingSoon")}</p>
      </div>
    </div>
  );
}
