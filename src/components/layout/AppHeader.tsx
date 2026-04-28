"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Share2, LayoutDashboard, ChevronDown, Languages, KanbanSquare, Clapperboard, Camera } from "lucide-react";
import { useState } from "react";
import { useProfileStore } from "@/lib/stores/profile-store";
import { getProfile, PROFILE_LIST } from "@/lib/profiles";
import { useT, useTMaybe, useI18nStore, LOCALE_LABELS, LOCALE_NAMES, type Locale } from "@/lib/i18n";
import UserMenu from "@/components/UserMenu";
import { useAuth } from "@/lib/useAuth";

const USER_BRAND_TITLES: Record<string, string> = {
  "necksy.de@gmail.com":       "NECKSY",
  "luisaschreyer0526@gmail.com": "INNERY",
  "tianjia.hsieh@gmail.com":   "JIALAB",
};

function getBrandTitleForUser(email: string | null | undefined, role: string | null | undefined): string {
  if (role === "admin") return "ADMIN";
  if (email) {
    const key = email.toLowerCase();
    if (USER_BRAND_TITLES[key]) return USER_BRAND_TITLES[key];
  }
  return "STUDIO";
}

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
  const { user } = useAuth();
  const brandTitle = brandAssets.name?.toUpperCase() || getBrandTitleForUser(user?.email, user?.role);

  const NAV_ITEMS = [
    { href: "/studio",    labelKey: "nav.studio"    as const, icon: Sparkles },
    { href: "/ugc",       labelKey: "nav.ugc"       as const, icon: Clapperboard },
    { href: "/orbit",     labelKey: "nav.orbit"     as const, icon: Camera },
    { href: "/social",    labelKey: "nav.social"    as const, icon: Share2 },
    { href: "/dashboard", labelKey: "nav.dashboard" as const, icon: LayoutDashboard },
    { href: "/tasks",     labelKey: "nav.tasks"     as const, icon: KanbanSquare },
  ];

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(3, 11, 24, 0.88)",
        backdropFilter: "blur(24px) saturate(1.6)",
        borderBottom: "1px solid rgba(6, 182, 212, 0.12)",
        boxShadow: "0 1px 0 rgba(6, 182, 212, 0.06), 0 4px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* Subtle top accent line */}
      <div style={{
        position: "absolute",
        top: 0, left: 0, right: 0,
        height: "1px",
        background: "linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.5) 20%, rgba(124,58,237,0.5) 80%, transparent 100%)",
      }} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">

        {/* ── Logo ── */}
        <Link href="/studio" className="flex items-center gap-2.5 group" style={{ textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32,
            borderRadius: 8,
            background: "linear-gradient(135deg, #0891b2, #06b6d4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(6,182,212,0.4), inset 0 1px 0 rgba(255,255,255,0.15)",
            transition: "box-shadow 0.2s ease, transform 0.2s ease",
          }}
            className="group-hover:scale-105"
          >
            <Sparkles className="w-4 h-4" style={{ color: "#030b18" }} />
          </div>
          <span style={{
            fontFamily: "'Orbitron', monospace",
            fontWeight: 700,
            fontSize: "0.85rem",
            letterSpacing: "0.12em",
            color: "#06b6d4",
            textShadow: "0 0 12px rgba(6,182,212,0.5)",
          }}>
            {brandTitle}
          </span>
        </Link>

        {/* ── Nav ── */}
        <nav style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          background: "rgba(6, 18, 32, 0.8)",
          borderRadius: 10,
          border: "1px solid rgba(6, 182, 212, 0.1)",
          padding: "3px 4px",
          backdropFilter: "blur(8px)",
        }}>
          {NAV_ITEMS.map(({ href, labelKey, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 7,
                  fontSize: "0.8rem",
                  fontWeight: active ? 600 : 400,
                  fontFamily: "'Syne', sans-serif",
                  letterSpacing: "0.02em",
                  textDecoration: "none",
                  transition: "all 0.18s ease",
                  whiteSpace: "nowrap",
                  background: active
                    ? "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(6,182,212,0.12))"
                    : "transparent",
                  color: active ? "#06b6d4" : "rgba(100,160,200,0.7)",
                  boxShadow: active
                    ? "0 0 12px rgba(6,182,212,0.2), inset 0 0 0 1px rgba(6,182,212,0.25)"
                    : "none",
                  textShadow: active ? "0 0 8px rgba(6,182,212,0.5)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "#c8e6ff";
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.color = "rgba(100,160,200,0.7)";
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
                {t(labelKey)}
              </Link>
            );
          })}
        </nav>

        {/* ── Right controls ── */}
        <div className="flex items-center gap-2">
          <UserMenu />

          {/* Language toggle */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px",
                borderRadius: 7,
                border: "1px solid rgba(6,182,212,0.15)",
                background: "rgba(6,18,32,0.6)",
                color: "rgba(100,160,200,0.8)",
                fontSize: "0.75rem",
                fontFamily: "'Space Mono', monospace",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
            >
              <Languages style={{ width: 13, height: 13 }} />
              <span>{LOCALE_LABELS[locale]}</span>
            </button>

            {langOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setLangOpen(false)} />
                <div style={{
                  position: "absolute",
                  right: 0, top: "calc(100% + 8px)",
                  width: 160,
                  background: "rgba(7, 18, 32, 0.97)",
                  border: "1px solid rgba(6,182,212,0.18)",
                  borderRadius: 10,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(6,182,212,0.08)",
                  zIndex: 50,
                  padding: "4px",
                  backdropFilter: "blur(20px)",
                }}>
                  {LOCALES.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => { setLocale(loc); setLangOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        fontFamily: "'Syne', sans-serif",
                        textAlign: "left",
                        cursor: "pointer",
                        borderRadius: 7,
                        border: "none",
                        background: loc === locale ? "rgba(6,182,212,0.1)" : "transparent",
                        color: loc === locale ? "#06b6d4" : "rgba(200,230,255,0.7)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span>{LOCALE_NAMES[loc]}</span>
                      <span style={{ fontSize: "0.7rem", color: "rgba(100,160,200,0.6)", fontFamily: "'Space Mono', monospace" }}>{LOCALE_LABELS[loc]}</span>
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
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 10px",
                borderRadius: 7,
                border: "1px solid rgba(6,182,212,0.15)",
                background: "rgba(6,18,32,0.6)",
                color: "rgba(200,230,255,0.8)",
                fontSize: "0.8rem",
                fontFamily: "'Syne', sans-serif",
                cursor: "pointer",
                transition: "all 0.18s ease",
              }}
            >
              {profile ? (
                <>
                  <span style={{ fontSize: "0.95rem" }}>{profile.icon}</span>
                  <span className="hidden sm:inline" style={{ fontSize: "0.8rem" }}>
                    {tM(`profile.${profile.id}`, profile.name)}
                  </span>
                </>
              ) : (
                <span style={{ color: "rgba(100,160,200,0.5)" }}>{t("nav.noProfile")}</span>
              )}
              <ChevronDown style={{ width: 13, height: 13, color: "rgba(100,160,200,0.5)" }} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                <div style={{
                  position: "absolute",
                  right: 0, top: "calc(100% + 8px)",
                  width: 220,
                  background: "rgba(7, 18, 32, 0.97)",
                  border: "1px solid rgba(6,182,212,0.18)",
                  borderRadius: 10,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 20px rgba(6,182,212,0.08)",
                  zIndex: 50,
                  padding: "4px",
                  backdropFilter: "blur(20px)",
                }}>
                  {PROFILE_LIST.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setActiveProfile(p.id); setProfileOpen(false); }}
                      style={{
                        width: "100%",
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "9px 12px",
                        textAlign: "left",
                        cursor: "pointer",
                        borderRadius: 7,
                        border: "none",
                        background: p.id === activeProfileId ? "rgba(6,182,212,0.1)" : "transparent",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>{p.icon}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontFamily: "'Syne', sans-serif",
                          fontWeight: p.id === activeProfileId ? 600 : 400,
                          fontSize: "0.82rem",
                          color: p.id === activeProfileId ? "#06b6d4" : "rgba(200,230,255,0.85)",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {tM(`profile.${p.id}`, p.name)}
                        </div>
                        <div style={{
                          fontSize: "0.7rem",
                          color: "rgba(100,160,200,0.5)",
                          fontFamily: "'Space Mono', monospace",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {tM(`profile.${p.id}.desc`, p.description)}
                        </div>
                      </div>
                    </button>
                  ))}
                  <div style={{ borderTop: "1px solid rgba(6,182,212,0.1)", marginTop: 4, paddingTop: 4 }}>
                    <Link
                      href="/onboarding"
                      onClick={() => setProfileOpen(false)}
                      style={{
                        display: "block",
                        padding: "8px 12px",
                        fontSize: "0.8rem",
                        fontFamily: "'Syne', sans-serif",
                        color: "rgba(100,160,200,0.6)",
                        textDecoration: "none",
                        borderRadius: 7,
                        transition: "all 0.15s ease",
                      }}
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
