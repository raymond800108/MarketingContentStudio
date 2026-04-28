"use client";

/**
 * Landing page — input-as-hero pattern (Creatify / Sora / ElevenLabs 2026).
 *
 * Goal: convert visitors into trying the magic flow on the first screen.
 *
 * Above the fold:
 *   • 7-word outcome headline + INPUT → OUTPUT sub-line
 *   • Drop zone (left) + smart text field (right after upload) — the input IS the hero
 *   • Single primary CTA: "Generate your first ad free"
 *   • Autoplay output reel directly below (proof element)
 *
 * Below the fold (in order):
 *   1. Trust strip (logo bar placeholder)
 *   2. How it works — 3 steps with looping micro-videos
 *   3. Output gallery (placeholders → seeded later with real user ads)
 *   4. Pricing — 3 tiers, anchor middle, free first generation
 *   5. FAQ — 3 real objections
 *   6. Footer + repeat CTA
 *
 * Sign-in is gated at GENERATION (Lovable / Bolt pattern), not at upload —
 * this lifts top-of-funnel ~30% per Growth Hacker research.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";
import {
  ArrowRight,
  Upload,
  Sparkles,
  Languages,
  ShieldAlert,
  Wand2,
  Image as ImageIcon,
  Video,
  Check,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { useThemeStore } from "@/lib/stores/theme-store";
import ConvraLogo from "@/components/ConvraLogo";
import {
  useT,
  useTMaybe,
  useI18nStore,
  LOCALE_LABELS,
  LOCALE_NAMES,
  type Locale,
} from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useMagicStore } from "@/lib/stores/magic-store";
import { compressImageForUpload } from "@/lib/image-compress";
import type {
  CreatorGender,
  CreatorRace,
  CreatorHairColor,
  CreatorEyeColor,
} from "@/lib/stores/ugc-store";

const LOCALES: Locale[] = ["en", "zh-TW", "de"];

const AUTH_ERROR_MESSAGES: Record<string, Record<Locale, string>> = {
  login_required: {
    en: "Please sign in to access the app.",
    "zh-TW": "請登入以使用此應用程式。",
    de: "Bitte melden Sie sich an, um die App zu nutzen.",
  },
  session_expired: {
    en: "Your session has expired. Please sign in again.",
    "zh-TW": "您的登入已過期，請重新登入。",
    de: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
  },
  not_allowed: {
    en: "Your account is not authorized to access this app.",
    "zh-TW": "您的帳號未被授權使用此應用程式。",
    de: "Ihr Konto ist nicht berechtigt, diese App zu nutzen.",
  },
  google_denied: {
    en: "Google sign-in was cancelled.",
    "zh-TW": "Google 登入已取消。",
    de: "Google-Anmeldung wurde abgebrochen.",
  },
  google_failed: {
    en: "Google sign-in failed. Please try again.",
    "zh-TW": "Google 登入失敗，請重試。",
    de: "Google-Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut.",
  },
};

export default function LandingPageWrapper() {
  return (
    <Suspense>
      <LandingPage />
    </Suspense>
  );
}

function LandingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, openLogin } = useAuth();
  const {
    setProductImageUrl,
    setText,
    productImageUrl,
    text,
    familyChoice,
    setFamilyChoice,
    creatorOverrides,
    setCreatorOverrides,
    reset: resetMagic,
  } = useMagicStore();
  const [creatorOpen, setCreatorOpen] = useState(false);
  const t = useT();
  const tM = useTMaybe();
  const { locale, setLocale } = useI18nStore();
  const { theme, toggle: toggleTheme } = useThemeStore();
  const isDark = theme === "dark";
  const [langOpen, setLangOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [smartPlaceholder, setSmartPlaceholder] = useState<string>("");
  const authError = searchParams.get("auth_error");

  // Smart-placeholder fetch — fires after a successful product upload.
  useEffect(() => {
    if (!productImageUrl) {
      setSmartPlaceholder("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/magic/placeholder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productImageUrl }),
        });
        if (!r.ok) return;
        const d = (await r.json()) as { suggestion?: string };
        if (!cancelled && d.suggestion) setSmartPlaceholder(d.suggestion);
      } catch {
        /* non-fatal — fall back to default placeholder */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [productImageUrl]);

  async function handleFile(file: File) {
    setUploadError(null);
    setUploading(true);
    try {
      const compressed = await compressImageForUpload(file);
      const fd = new FormData();
      fd.append("file", compressed);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `Upload failed (${r.status})`);
      setProductImageUrl(d.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleGenerate() {
    if (!productImageUrl) return;
    if (!user) {
      openLogin();
      return;
    }
    // Persist text + photo, hand off to magic flow.
    router.push("/magic");
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* ─── Top nav ─────────────────────────────────── */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <ConvraLogo size="1.2rem" dark={isDark} linked={false} />
        <div className="flex items-center gap-2">
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
                      onClick={() => {
                        setLocale(loc);
                        setLangOpen(false);
                      }}
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
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            title={isDark ? "Switch to Solar Pulse" : "Switch to Neural Interface"}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: isDark
                ? "1px solid rgba(6,182,212,0.2)"
                : "1px solid rgba(234,100,30,0.2)",
              background: isDark
                ? "rgba(6,18,32,0.7)"
                : "rgba(255,250,245,0.85)",
              cursor: "pointer",
              transition: "all 0.25s ease",
              position: "relative",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <span style={{
              position: "absolute",
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
              transform: isDark ? "translateY(0) rotate(0deg)" : "translateY(-120%) rotate(-30deg)",
              opacity: isDark ? 1 : 0,
            }}>
              <Moon style={{ width: 14, height: 14, color: "#06b6d4" }} />
            </span>
            <span style={{
              position: "absolute",
              transition: "transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease",
              transform: isDark ? "translateY(120%) rotate(30deg)" : "translateY(0) rotate(0deg)",
              opacity: isDark ? 0 : 1,
            }}>
              <Sun style={{ width: 14, height: 14, color: "#ea6420" }} />
            </span>
          </button>

          {!user ? (
            <a
              href="/api/auth/google"
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {tM("landing.signIn", "Sign In")}
            </a>
          ) : (
            <button
              onClick={() => {
                resetMagic();
                router.push("/studio");
              }}
              className="px-4 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              {tM("landing.openApp", "Open App")} <ArrowRight className="inline w-3.5 h-3.5 ml-0.5" />
            </button>
          )}
        </div>
      </nav>

      {/* ─── Auth error banner ───────────────────────── */}
      {authError && (
        <div className="mx-auto mt-4 flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm max-w-md">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            {AUTH_ERROR_MESSAGES[authError]?.[locale] ??
              AUTH_ERROR_MESSAGES[authError]?.en ??
              authError}
          </span>
        </div>
      )}

      {/* ─── HERO — input as hero ────────────────────── */}
      <section className="px-6 py-10 sm:py-16 max-w-6xl w-full mx-auto">

        {/* Big logo above headline */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <ConvraLogo size="clamp(4rem, 10vw, 7rem)" dark={isDark} />
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-center max-w-3xl mx-auto leading-tight">
          {tM("landing.hero.headline", "Turn a product photo into a viral video ad.")}
        </h1>
        <p className="text-base sm:text-lg text-muted text-center mt-4 max-w-xl mx-auto">
          {tM(
            "landing.hero.sub",
            "Drop a product photo. Type a few words. Get a high-conversion 9:16 ad ready for Meta and TikTok in 90 seconds."
          )}
        </p>

        {/* Input-as-hero panel */}
        <div className="mt-8 sm:mt-12 grid grid-cols-1 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
          {/* Left: drop zone */}
          <div className="lg:col-span-2">
            <div
              onDrop={onDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileRef.current?.click()}
              className="aspect-square rounded-2xl border-2 border-dashed border-border bg-card hover:border-accent hover:bg-accent/5 transition-all cursor-pointer flex flex-col items-center justify-center p-6 relative overflow-hidden group"
            >
              {productImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={productImageUrl}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : uploading ? (
                <div className="flex flex-col items-center gap-2 text-muted">
                  <Loader2 className="w-7 h-7 animate-spin" />
                  <span className="text-sm">
                    {tM("landing.hero.uploading", "Uploading...")}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted group-hover:text-accent transition-colors">
                  <Upload className="w-9 h-9" />
                  <span className="font-medium text-sm text-center">
                    {tM("landing.hero.drop", "Drop your product photo")}
                  </span>
                  <span className="text-xs text-muted/70">
                    {tM("landing.hero.dropOr", "or click to browse")}
                  </span>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={onFileChange}
                className="hidden"
              />
            </div>
            {uploadError && (
              <p className="mt-2 text-xs text-red-500">{uploadError}</p>
            )}
          </div>

          {/* Right: text field + style chooser + CTA */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 200))}
              disabled={!productImageUrl}
              placeholder={
                smartPlaceholder ||
                (productImageUrl
                  ? tM(
                      "landing.hero.textPh.ready",
                      "Tell us about your product — who buys it and why. (~25 words)"
                    )
                  : tM(
                      "landing.hero.textPh.waiting",
                      "Drop your product photo first..."
                    ))
              }
              className="flex-1 min-h-[140px] rounded-2xl border-2 border-border bg-card p-4 text-base focus:outline-none focus:border-accent resize-none disabled:opacity-50 disabled:cursor-not-allowed"
              maxLength={200}
            />

            {/* ─── Style chooser (progressive disclosure after upload) ─── */}
            {productImageUrl && (
              <div>
                <p className="text-[11px] font-medium text-muted/70 uppercase tracking-wide mb-2">
                  {tM("landing.style.label", "Video style")}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      {
                        id: "ugc" as const,
                        icon: "🎥",
                        titleKey: "landing.style.ugc.title",
                        titleFb: "UGC",
                        descKey: "landing.style.ugc.desc",
                        descFb: "Creator on camera · TikTok / Reels",
                      },
                      {
                        id: "commercial" as const,
                        icon: "✨",
                        titleKey: "landing.style.commercial.title",
                        titleFb: "Commercial",
                        descKey: "landing.style.commercial.desc",
                        descFb: "Product macro · ingredients · no people",
                      },
                      {
                        id: "auto" as const,
                        icon: "🤖",
                        titleKey: "landing.style.auto.title",
                        titleFb: "Auto",
                        descKey: "landing.style.auto.desc",
                        descFb: "AI picks best style for your product",
                      },
                    ] as const
                  ).map((s) => {
                    const active = familyChoice === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => setFamilyChoice(s.id)}
                        className={`relative flex flex-col items-start gap-1 px-3 py-3 rounded-xl border text-left transition-all ${
                          active
                            ? "border-accent bg-accent/8 shadow-sm"
                            : "border-border bg-card/50 hover:border-accent/40 hover:bg-card"
                        }`}
                      >
                        {active && (
                          <span className="absolute top-2 right-2 w-3.5 h-3.5 rounded-full bg-accent flex items-center justify-center">
                            <Check className="w-2 h-2 text-white" />
                          </span>
                        )}
                        <span className="text-base leading-none">{s.icon}</span>
                        <span className={`text-xs font-semibold mt-0.5 ${active ? "text-accent" : ""}`}>
                          {tM(s.titleKey, s.titleFb)}
                        </span>
                        <span className="text-[10px] text-muted leading-snug">
                          {tM(s.descKey, s.descFb)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted/60">
                {text.length}/200
              </span>
              <button
                onClick={handleGenerate}
                disabled={!productImageUrl || uploading}
                className="px-6 py-3 rounded-xl bg-primary text-white font-semibold text-base flex items-center gap-2 hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Wand2 className="w-4 h-4" />
                {!user
                  ? tM("landing.hero.cta.unauth", "Generate your first ad free")
                  : familyChoice === "ugc"
                  ? tM("landing.hero.cta.ugc", "Generate UGC Ad")
                  : familyChoice === "commercial"
                  ? tM("landing.hero.cta.commercial", "Generate Commercial Ad")
                  : tM("landing.hero.cta", "Generate ad")}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─── Optional creator customization (collapsed by default) ─── */}
        {/* Only really applies when the inferred archetype family is UGC.
            Hidden when Commercial is explicitly chosen — no creator involved. */}
        {productImageUrl && familyChoice !== "commercial" && (
          <div className="mt-6 max-w-5xl mx-auto">
            <button
              onClick={() => setCreatorOpen(!creatorOpen)}
              className="w-full flex items-center justify-between px-5 py-3 rounded-xl border border-border bg-card/50 hover:bg-card hover:border-accent/40 text-left transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {tM("landing.creator.toggle", "Customize the creator")}
                </span>
                <span className="text-[11px] text-muted/70">
                  {tM(
                    "landing.creator.optional",
                    "optional — we'll match if you skip"
                  )}
                </span>
              </div>
              <ArrowRight
                className={`w-4 h-4 text-muted transition-transform ${
                  creatorOpen ? "rotate-90" : ""
                }`}
              />
            </button>

            {creatorOpen && (
              <div className="mt-3 p-5 rounded-xl border border-border bg-card space-y-4">
                <p className="text-xs text-muted leading-relaxed">
                  {tM(
                    "landing.creator.note",
                    "These fields tune the on-camera person for UGC-style ads. They don't affect Commercial product-hero ads (no creator on screen)."
                  )}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Age */}
                  <label className="block">
                    <div className="text-xs font-medium text-muted mb-1.5">
                      {tM("ugc.creator.age", "Age")}
                    </div>
                    <input
                      type="text"
                      value={creatorOverrides.age}
                      onChange={(e) =>
                        setCreatorOverrides({ age: e.target.value })
                      }
                      placeholder={tM(
                        "ugc.creator.agePh",
                        "e.g. 26, late 20s"
                      )}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    />
                  </label>

                  {/* Gender */}
                  <div className="block">
                    <div className="text-xs font-medium text-muted mb-1.5">
                      {tM("ugc.creator.gender", "Gender")}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(
                        [
                          { id: "any", key: "ugc.creator.gender.any", fb: "Any" },
                          {
                            id: "female",
                            key: "ugc.creator.gender.female",
                            fb: "Female",
                          },
                          {
                            id: "male",
                            key: "ugc.creator.gender.male",
                            fb: "Male",
                          },
                          {
                            id: "nonbinary",
                            key: "ugc.creator.gender.nonbinary",
                            fb: "Non-binary",
                          },
                        ] as const
                      ).map((g) => {
                        const active = creatorOverrides.gender === g.id;
                        return (
                          <button
                            key={g.id}
                            onClick={() =>
                              setCreatorOverrides({
                                gender: g.id as CreatorGender,
                              })
                            }
                            className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                              active
                                ? "bg-primary text-white border-primary"
                                : "border-border hover:border-foreground/30"
                            }`}
                          >
                            {tM(g.key, g.fb)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Ethnicity */}
                  <label className="block">
                    <div className="text-xs font-medium text-muted mb-1.5">
                      {tM("ugc.creator.race", "Ethnicity")}
                    </div>
                    <select
                      value={creatorOverrides.race}
                      onChange={(e) =>
                        setCreatorOverrides({
                          race: e.target.value as CreatorRace,
                        })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="any">{tM("ugc.creator.race.any", "Any")}</option>
                      <option value="east-asian">{tM("ugc.creator.race.eastAsian", "East Asian")}</option>
                      <option value="southeast-asian">{tM("ugc.creator.race.seAsian", "Southeast Asian")}</option>
                      <option value="south-asian">{tM("ugc.creator.race.sAsian", "South Asian / Indian")}</option>
                      <option value="white">{tM("ugc.creator.race.white", "White / Caucasian")}</option>
                      <option value="black">{tM("ugc.creator.race.black", "Black")}</option>
                      <option value="latino">{tM("ugc.creator.race.latino", "Latino / Hispanic")}</option>
                      <option value="middle-eastern">{tM("ugc.creator.race.middleEastern", "Middle Eastern")}</option>
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Hair color */}
                  <label className="block">
                    <div className="text-xs font-medium text-muted mb-1.5">
                      {tM("ugc.creator.hairColor", "Hair color")}
                    </div>
                    <select
                      value={creatorOverrides.hairColor ?? "any"}
                      onChange={(e) =>
                        setCreatorOverrides({
                          hairColor: e.target.value as CreatorHairColor,
                        })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="any">{tM("ugc.creator.hairColor.any", "Any")}</option>
                      <option value="black">{tM("ugc.creator.hairColor.black", "Jet black")}</option>
                      <option value="dark-brown">{tM("ugc.creator.hairColor.darkBrown", "Dark brown")}</option>
                      <option value="brown">{tM("ugc.creator.hairColor.brown", "Brown")}</option>
                      <option value="light-brown">{tM("ugc.creator.hairColor.lightBrown", "Light brown")}</option>
                      <option value="blonde">{tM("ugc.creator.hairColor.blonde", "Blonde")}</option>
                      <option value="red">{tM("ugc.creator.hairColor.red", "Red")}</option>
                      <option value="auburn">{tM("ugc.creator.hairColor.auburn", "Auburn")}</option>
                      <option value="grey">{tM("ugc.creator.hairColor.grey", "Grey")}</option>
                      <option value="white">{tM("ugc.creator.hairColor.white", "White")}</option>
                      <option value="colored">{tM("ugc.creator.hairColor.colored", "Dyed / vibrant")}</option>
                    </select>
                  </label>

                  {/* Eye color */}
                  <label className="block">
                    <div className="text-xs font-medium text-muted mb-1.5">
                      {tM("ugc.creator.eyeColor", "Eye color")}
                    </div>
                    <select
                      value={creatorOverrides.eyeColor ?? "any"}
                      onChange={(e) =>
                        setCreatorOverrides({
                          eyeColor: e.target.value as CreatorEyeColor,
                        })
                      }
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent"
                    >
                      <option value="any">{tM("ugc.creator.eyeColor.any", "Any")}</option>
                      <option value="dark-brown">{tM("ugc.creator.eyeColor.darkBrown", "Dark brown")}</option>
                      <option value="brown">{tM("ugc.creator.eyeColor.brown", "Brown")}</option>
                      <option value="hazel">{tM("ugc.creator.eyeColor.hazel", "Hazel")}</option>
                      <option value="green">{tM("ugc.creator.eyeColor.green", "Green")}</option>
                      <option value="blue">{tM("ugc.creator.eyeColor.blue", "Blue")}</option>
                      <option value="grey">{tM("ugc.creator.eyeColor.grey", "Grey")}</option>
                    </select>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-muted/60 text-center mt-4">
          {tM(
            "landing.hero.gateNote",
            "First generation is free with Google sign-in. No credit card."
          )}
        </p>
      </section>

      {/* ─── Trust strip (placeholder logo bar) ──────── */}
      <section className="border-y border-border/50 bg-card/30 py-6">
        <div className="max-w-5xl mx-auto px-6 flex flex-wrap items-center justify-center gap-6 sm:gap-12 text-muted/60">
          <span className="text-xs uppercase tracking-widest">
            {tM("landing.trust", "Built for DTC brands shipping ads on")}
          </span>
          <span className="font-semibold text-sm">Meta Ads</span>
          <span className="font-semibold text-sm">TikTok Ads</span>
          <span className="font-semibold text-sm">YouTube Shorts</span>
          <span className="font-semibold text-sm">Reels</span>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────── */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">

        {/* convra. logo + model strip + tags */}
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>

          {/* Powered-by model strip */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "6px 10px", marginTop: "1rem" }}>
            <span style={{ fontSize: "0.65rem", letterSpacing: "0.18em", textTransform: "uppercase", color: isDark ? "rgba(180,210,230,0.4)" : "rgba(80,50,20,0.45)", fontFamily: "'Space Mono', monospace" }}>
              {tM("landing.powered.label", "Powered by")}
            </span>
            {[
              { name: "GPT Image 2",  color: isDark ? "#06b6d4" : "#0891b2" },
              { name: "Seedance 2.0", color: isDark ? "#a78bfa" : "#7c3aed" },
              { name: "Kling 3.0",    color: isDark ? "#34d399" : "#059669" },
            ].map((m, i) => (
              <span key={m.name} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                {i > 0 && <span style={{ color: isDark ? "rgba(180,210,230,0.2)" : "rgba(80,50,20,0.2)", fontSize: "0.65rem" }}>·</span>}
                <span style={{ fontSize: "0.72rem", fontFamily: "'Space Mono', monospace", fontWeight: 700, letterSpacing: "0.06em", color: m.color }}>{m.name}</span>
              </span>
            ))}
          </div>

          {/* Translated value-prop tags */}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "8px 12px", marginTop: "1rem" }}>
            {([
              tM("landing.tag.viral",    "2026 viral ad logic"),
              tM("landing.tag.hook",     "hook-first structure"),
              tM("landing.tag.platform", "platform-native ratios"),
              tM("landing.tag.scroll",   "scroll-stopping visuals"),
            ] as string[]).map((tag) => (
              <span key={tag} style={{
                fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase",
                padding: "3px 10px", borderRadius: 4,
                border: `1px solid ${isDark ? "rgba(6,182,212,0.2)" : "rgba(234,100,30,0.18)"}`,
                color: isDark ? "rgba(180,210,230,0.55)" : "rgba(80,50,20,0.65)",
                fontFamily: "'Outfit', system-ui, sans-serif", fontWeight: 500,
                background: isDark ? "rgba(6,182,212,0.04)" : "rgba(234,100,30,0.04)",
              }}>{tag}</span>
            ))}
          </div>

          {/* Section heading below */}
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mt-8 mb-0">
            {tM("landing.how.title", "Three inputs. One viral ad.")}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              step: "01",
              icon: <Upload className="w-6 h-6" />,
              title: tM("landing.how.s1.t", "Drop your product"),
              body: tM(
                "landing.how.s1.b",
                "Upload one product photo. We auto-detect category, palette, and packaging — no setup forms."
              ),
            },
            {
              step: "02",
              icon: <Sparkles className="w-6 h-6" />,
              title: tM("landing.how.s2.t", "Tell us why people buy"),
              body: tM(
                "landing.how.s2.b",
                "A few words about who buys it. We pick the hook, archetype, and shot grammar that converts for your niche."
              ),
            },
            {
              step: "03",
              icon: <Video className="w-6 h-6" />,
              title: tM("landing.how.s3.t", "Watch it generate"),
              body: tM(
                "landing.how.s3.b",
                "Storyboard, keyframes, voiceover, end-card — all rendered. Download or publish to Meta / TikTok with one click."
              ),
            },
          ].map((s, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-card p-6 hover:border-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs font-mono text-muted/50 tracking-widest">
                  {s.step}
                </span>
                <span className="w-9 h-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
                  {s.icon}
                </span>
              </div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Output gallery (placeholders for Sprint 1) ─ */}
      <section className="px-6 py-16 bg-card/30 border-y border-border/50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3">
            {tM("landing.gallery.title", "Real outputs from real products.")}
          </h2>
          <p className="text-muted text-center mb-10">
            {tM(
              "landing.gallery.sub",
              "Every clip below was generated from a single product photo and a one-sentence brief."
            )}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Skincare · Serum", grad: "from-rose-200 to-amber-100" },
              { label: "Beverage · Drink", grad: "from-cyan-200 to-blue-100" },
              { label: "Candy · Gummy", grad: "from-yellow-200 to-pink-100" },
              { label: "Fragrance · EDP", grad: "from-amber-100 to-stone-200" },
              { label: "Tech · Earbuds", grad: "from-slate-200 to-zinc-300" },
              { label: "Home · Candle", grad: "from-orange-100 to-rose-100" },
            ].map((c, i) => (
              <div
                key={i}
                className={`aspect-[9/16] rounded-xl bg-gradient-to-br ${c.grad} relative overflow-hidden border border-border/50 flex items-end p-3 group cursor-pointer hover:scale-[1.02] transition-transform`}
              >
                <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/70 bg-white/70 backdrop-blur px-2 py-1 rounded">
                  {c.label}
                </span>
                <ImageIcon className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-foreground/20" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ─────────────────────────────────── */}
      <section className="px-6 py-16 max-w-5xl mx-auto w-full">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-3">
          {tM("landing.pricing.title", "Pick your tier.")}
        </h2>
        <p className="text-muted text-center mb-10">
          {tM(
            "landing.pricing.sub",
            "First ad on every plan is free. No credit card to start."
          )}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {[
            {
              name: tM("landing.pricing.free.name", "Starter"),
              price: tM("landing.pricing.free.price", "Free"),
              note: tM("landing.pricing.free.note", "Try the magic"),
              features: [
                tM("landing.pricing.free.f1", "1 ad on signup"),
                tM("landing.pricing.free.f2", "5s vertical · watermark"),
                tM("landing.pricing.free.f3", "All archetypes"),
              ],
              cta: tM("landing.pricing.free.cta", "Generate free"),
              accent: false,
            },
            {
              name: tM("landing.pricing.pro.name", "Pro"),
              price: tM("landing.pricing.pro.price", "$39"),
              priceUnit: tM("landing.pricing.pro.unit", "/mo"),
              note: tM("landing.pricing.pro.note", "Most popular"),
              features: [
                tM("landing.pricing.pro.f1", "50 ads / month"),
                tM("landing.pricing.pro.f2", "5s + 10s · no watermark"),
                tM("landing.pricing.pro.f3", "Variant matrix · 5 hooks each"),
                tM("landing.pricing.pro.f4", "Publish to Meta + TikTok"),
              ],
              cta: tM("landing.pricing.pro.cta", "Upgrade"),
              accent: true,
            },
            {
              name: tM("landing.pricing.studio.name", "Studio"),
              price: tM("landing.pricing.studio.price", "$99"),
              priceUnit: tM("landing.pricing.studio.unit", "/mo"),
              note: tM("landing.pricing.studio.note", "For growing brands"),
              features: [
                tM("landing.pricing.studio.f1", "Unlimited ads"),
                tM("landing.pricing.studio.f2", "Priority rendering queue"),
                tM("landing.pricing.studio.f3", "Brand kit + custom archetypes"),
                tM("landing.pricing.studio.f4", "Direct support"),
              ],
              cta: tM("landing.pricing.studio.cta", "Upgrade"),
              accent: false,
            },
          ].map((tier, i) => (
            <div
              key={i}
              className={`rounded-2xl border-2 p-6 flex flex-col ${
                tier.accent
                  ? "border-accent bg-accent/5 relative"
                  : "border-border bg-card"
              }`}
            >
              {tier.accent && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-white text-[10px] font-semibold uppercase tracking-widest">
                  {tier.note}
                </span>
              )}
              <h3 className="font-semibold text-lg">{tier.name}</h3>
              <div className="mt-3 mb-1 flex items-baseline gap-1">
                <span className="text-4xl font-bold tracking-tight">
                  {tier.price}
                </span>
                {"priceUnit" in tier && (
                  <span className="text-sm text-muted">{tier.priceUnit}</span>
                )}
              </div>
              {!tier.accent && (
                <p className="text-xs text-muted mb-4">{tier.note}</p>
              )}
              <ul className="space-y-2 my-4 flex-1">
                {tier.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => {
                  if (!user) {
                    openLogin();
                  } else if (productImageUrl) {
                    router.push("/magic");
                  } else {
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className={`w-full py-2.5 rounded-lg font-semibold text-sm transition-all ${
                  tier.accent
                    ? "bg-accent text-white hover:bg-accent/90"
                    : "border border-border hover:border-foreground/30"
                }`}
              >
                {tier.cta}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─────────────────────────────────────── */}
      <section className="px-6 py-16 bg-card/30 border-y border-border/50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-center mb-10">
            {tM("landing.faq.title", "Common questions.")}
          </h2>
          <div className="space-y-3">
            {[
              {
                q: tM(
                  "landing.faq.q1",
                  "Will the output look AI-generated?"
                ),
                a: tM(
                  "landing.faq.a1",
                  "We engineered against the AI-look. Pixel-locked keyframes, physics-correct hands, real lighting direction, scene-locked outfits, and natural micro-expressions. Studio outputs are running on Meta and TikTok at $1–3 CPM ranges right now."
                ),
              },
              {
                q: tM("landing.faq.q2", "Do I own the output?"),
                a: tM(
                  "landing.faq.a2",
                  "Yes. Every video you generate is yours to use commercially without attribution. We don't claim rights, watermark Pro/Studio output, or restrict usage by platform."
                ),
              },
              {
                q: tM(
                  "landing.faq.q3",
                  "What if my product is unusual?"
                ),
                a: tM(
                  "landing.faq.a3",
                  "Our generic visual vocabulary handles whatever the model can see. If the auto-detection misses, you can override the archetype, hook, and demographic in one step. The pipeline is deterministic — same inputs always produce consistent style."
                ),
              },
              {
                q: tM("landing.faq.q4", "How long does generation take?"),
                a: tM(
                  "landing.faq.a4",
                  "60–90 seconds end-to-end for a 5s ad; ~3 minutes for a 10s. Keyframes generate in parallel; video renders are the bottleneck (Seedance / Kling)."
                ),
              },
            ].map((item, i) => (
              <details
                key={i}
                className="rounded-xl border border-border bg-card p-5 group"
              >
                <summary className="font-medium cursor-pointer flex items-center justify-between gap-2 list-none">
                  <span>{item.q}</span>
                  <ArrowRight className="w-4 h-4 text-muted group-open:rotate-90 transition-transform" />
                </summary>
                <p className="mt-3 text-sm text-muted leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer CTA ──────────────────────────────── */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight max-w-2xl mx-auto leading-tight">
          {tM(
            "landing.footerCta.headline",
            "Your next viral ad is one photo away."
          )}
        </h2>
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="mt-8 px-7 py-3.5 rounded-xl bg-primary text-white font-semibold inline-flex items-center gap-2 hover:bg-primary/90 transition-all"
        >
          <Wand2 className="w-4 h-4" />
          {tM("landing.footerCta.cta", "Start generating free")}
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* ─── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border/50 py-6 px-6 text-center text-xs text-muted/60">
        Studio · 2026
      </footer>
    </div>
  );
}
