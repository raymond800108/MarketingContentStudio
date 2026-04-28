"use client";

import { BUSINESS } from "@/lib/business";

/**
 * Subtle "powered by convra." footer.
 * Low contrast by design — visible to anyone looking, never demanding.
 * Adapts gracefully to both dark (Neural Interface) and light (Solar Pulse) themes.
 */
export default function AppFooter() {
  return (
    <footer
      style={{
        width: "100%",
        marginTop: "auto",
        padding: "20px 24px",
        borderTop: "1px solid var(--footer-divider, rgba(255,255,255,0.06))",
      }}
      // CSS custom properties per theme
      className="app-footer"
    >
      <style>{`
        [data-theme="dark"]  .app-footer { --footer-divider: rgba(255,255,255,0.06); --footer-text: rgba(180,210,230,0.32); --footer-hover: rgba(180,210,230,0.65); --footer-dot-sep: rgba(180,210,230,0.2);  }
        [data-theme="light"] .app-footer { --footer-divider: rgba(80,50,20,0.2);    --footer-text: #3a2010;                --footer-hover: #1a0a00;               --footer-dot-sep: rgba(80,50,20,0.45); }
        :root .app-footer                { --footer-divider: rgba(255,255,255,0.06); --footer-text: rgba(180,210,230,0.32); --footer-hover: rgba(180,210,230,0.65); --footer-dot-sep: rgba(180,210,230,0.2);  }
        .app-footer a, .app-footer span  { transition: color 0.18s ease; }
        .app-footer a:hover              { color: var(--footer-hover) !important; }
      `}</style>

      <div
        style={{
          maxWidth: 1152,
          margin: "0 auto",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
          color: "var(--footer-text)",
        }}
      >
        {/* ── Wordmark ── */}
        <a
          href={`https://${BUSINESS.website}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "baseline",
            gap: 8,
            color: "var(--footer-text)",
            textDecoration: "none",
          }}
          aria-label="convra"
        >
          <span style={{
            fontSize: 9,
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            fontFamily: "'Outfit', system-ui, sans-serif",
          }}>
            Powered by
          </span>
          <span style={{
            fontFamily: "'Plus Jakarta Sans', 'Outfit', system-ui, sans-serif",
            fontWeight: 300,
            fontSize: 18,
            lineHeight: 1,
            letterSpacing: "0.02em",
            color: BUSINESS.brand.primary,
          }}>
            convra<span style={{ color: BUSINESS.brand.accent }}>.</span>
          </span>
        </a>

        {/* ── Business meta ── */}
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: 2,
          fontSize: 10,
          lineHeight: 1.65,
          letterSpacing: "0.03em",
          color: "var(--footer-text)",
          fontFamily: "'Outfit', system-ui, sans-serif",
        }}>
          {/* Legal name + country */}
          <div>
            <span style={{ opacity: 0.9 }}>{BUSINESS.legalName}</span>
            <span style={{ margin: "0 6px", color: "var(--footer-dot-sep)" }}>·</span>
            <span>Based in Germany</span>
          </div>

          {/* Address */}
          <div style={{ opacity: 0.8 }}>
            {BUSINESS.addressLines.join(", ")}
          </div>

          {/* Contact — monospace to signal "data" */}
          <div style={{ fontFamily: "'Space Mono','JetBrains Mono',monospace", fontSize: 9, letterSpacing: "0.04em" }}>
            <a
              href={`mailto:${BUSINESS.email}`}
              style={{ color: "var(--footer-text)", textDecoration: "none" }}
            >
              {BUSINESS.email}
            </a>
            <span style={{ margin: "0 6px", color: "var(--footer-dot-sep)" }}>·</span>
            <a
              href={`tel:${BUSINESS.phone.replace(/\s/g, "")}`}
              style={{ color: "var(--footer-text)", textDecoration: "none" }}
            >
              {BUSINESS.phone}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
