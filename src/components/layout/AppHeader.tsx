"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Share2, LayoutDashboard, ChevronDown, Languages } from "lucide-react";
import { useState } from "react";
import { useProfileStore } from "@/lib/stores/profile-store";
import { getProfile, PROFILE_LIST } from "@/lib/profiles";
import { useT, useTMaybe, useI18nStore, LOCALE_LABELS, LOCALE_NAMES, type Locale } from "@/lib/i18n";

const LOCALES: Locale[] = ["en", "zh-TW", "de"];

export default function AppHeader() {
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { activeProfileId, setActiveProfile, brandAssets } = useProfileStore();
  const profile = activeProfileId ? getProfile(activeProfileId) : null;
  const t = useT();
  const tM = useTMaybe();
  const { locale, setLocale } = useI18nStore();

  const NAV_ITEMS = [
    { href: "/studio", labelKey: "nav.studio" as const, icon: Sparkles },
    { href: "/social", labelKey: "nav.social" as const, icon: Share2 },
    { href: "/dashboard", labelKey: "nav.dashboard" as const, icon: LayoutDashboard },
  ];

  return (
    <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        {/* Logo */}
        <Link href="/studio" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            {brandAssets.name || "Studio"}
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 bg-card rounded-full border border-border px-1 py-1">
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  active
                    ? "bg-primary text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
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

          {/* Profile switcher */}
          <div className="relative">
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border hover:border-border-hover transition-colors text-sm"
            >
              {profile ? (
                <>
                  <span>{profile.icon}</span>
                  <span className="hidden sm:inline text-foreground/80">{tM(`profile.${profile.id}`, profile.name)}</span>
                </>
              ) : (
                <span className="text-muted">{t("nav.noProfile")}</span>
              )}
              <ChevronDown className="w-3.5 h-3.5 text-muted" />
            </button>

            {profileOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProfileOpen(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-xl border border-border shadow-lg z-50 py-1 overflow-hidden">
                  {PROFILE_LIST.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        setActiveProfile(p.id);
                        setProfileOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-card-hover transition-colors ${
                        p.id === activeProfileId ? "bg-card-hover font-medium" : ""
                      }`}
                    >
                      <span className="text-lg shrink-0">{p.icon}</span>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{tM(`profile.${p.id}`, p.name)}</div>
                        <div className="text-[11px] text-muted truncate">{tM(`profile.${p.id}.desc`, p.description)}</div>
                      </div>
                    </button>
                  ))}
                  <div className="border-t border-border mt-1 pt-1">
                    <Link
                      href="/onboarding"
                      onClick={() => setProfileOpen(false)}
                      className="block px-4 py-2 text-sm text-muted hover:text-foreground hover:bg-card-hover transition-colors"
                    >
                      {t("nav.changeCategory")}
                    </Link>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
