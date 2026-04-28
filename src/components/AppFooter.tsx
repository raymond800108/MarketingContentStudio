"use client";

import { useEffect, useState } from "react";
import { BUSINESS } from "@/lib/business";
import { useThemeStore } from "@/lib/stores/theme-store";

export default function AppFooter() {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";

  // Avoid hydration mismatch — render after mount
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const text    = mounted ? (isDark ? "rgba(180,210,230,0.38)" : "#2a1a0a")   : "rgba(180,210,230,0.38)";
  const hover   = mounted ? (isDark ? "rgba(180,210,230,0.75)" : "#000000")   : "rgba(180,210,230,0.75)";
  const sep     = mounted ? (isDark ? "rgba(180,210,230,0.2)"  : "rgba(60,35,10,0.4)") : "rgba(180,210,230,0.2)";
  const divider = mounted ? (isDark ? "rgba(255,255,255,0.06)" : "rgba(60,35,10,0.15)") : "rgba(255,255,255,0.06)";

  return (
    <footer style={{ width: "100%", marginTop: "auto", padding: "20px 24px", borderTop: `1px solid ${divider}` }}>
      <div style={{
        maxWidth: 1152, margin: "0 auto",
        display: "flex", flexWrap: "wrap",
        alignItems: "flex-end", justifyContent: "space-between", gap: 12,
        color: text,
      }}>
        {/* Wordmark */}
        <a
          href={`https://${BUSINESS.website}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-flex", alignItems: "baseline", gap: 8, color: text, textDecoration: "none" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = hover}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = text}
        >
          <span style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", fontFamily: "'Outfit', system-ui, sans-serif" }}>
            Powered by
          </span>
          <span style={{ fontFamily: "'Plus Jakarta Sans','Outfit',system-ui,sans-serif", fontWeight: 300, fontSize: 18, lineHeight: 1, letterSpacing: "0.02em", color: BUSINESS.brand.primary }}>
            convra<span style={{ color: BUSINESS.brand.accent }}>.</span>
          </span>
        </a>

        {/* Business meta */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, fontSize: 10, lineHeight: 1.65, letterSpacing: "0.03em", color: text, fontFamily: "'Outfit', system-ui, sans-serif", transition: "color 0.2s ease" }}>
          <div>
            <span>{BUSINESS.legalName}</span>
            <span style={{ margin: "0 6px", color: sep }}>·</span>
            <span>Based in Germany</span>
          </div>
          <div>{BUSINESS.addressLines.join(", ")}</div>
          <div style={{ fontFamily: "'Space Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.04em" }}>
            <a href={`mailto:${BUSINESS.email}`} style={{ color: text, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = hover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = text}
            >{BUSINESS.email}</a>
            <span style={{ margin: "0 6px", color: sep }}>·</span>
            <a href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`} style={{ color: text, textDecoration: "none" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = hover}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = text}
            >{BUSINESS.phone}</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
