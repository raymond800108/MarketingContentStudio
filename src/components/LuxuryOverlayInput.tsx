"use client";

import { useState } from "react";
import { Sparkles, Loader2, Type, ChevronDown } from "lucide-react";
import { AD_FONTS, getAdFont, type AdFontOption } from "@/lib/ad-fonts";
import { useTMaybe } from "@/lib/i18n";

interface LuxuryOverlayInputProps {
  value: string;
  onChange: (v: string) => void;
  fontId: string;
  onFontChange: (id: string) => void;
  progress: number | null;
  compact?: boolean;
}

/**
 * Ad-headline + font picker UI — collapsed by default, expands when the
 * user clicks the header. When collapsed and empty, it's just a small
 * "Add text overlay" affordance below the top-border. When expanded it
 * shows the textarea, font picker, and hint.
 *
 * All copy flows through useTMaybe() so the UI follows the global
 * language toggle (EN / zh-TW / DE).
 */
export default function LuxuryOverlayInput({
  value,
  onChange,
  fontId,
  onFontChange,
  progress,
}: LuxuryOverlayInputProps) {
  const tm = useTMaybe();
  const activeFont = getAdFont(fontId);

  // Group fonts by category for the dropdown
  const categories = Array.from(new Set(AD_FONTS.map((f) => f.category)));

  // Expand if user has already typed something, else collapsed.
  const [open, setOpen] = useState(() => value.trim().length > 0);

  return (
    <div className="mt-4 pt-3 border-t border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-1.5 text-[11px] font-medium text-foreground/70 hover:text-foreground transition-colors"
      >
        <Sparkles className="w-3 h-3 text-accent" />
        <span>{tm("overlay.title", "Ad Headline & Body")}</span>
        <span className="text-muted/60 font-normal">
          ({tm("overlay.optional", "optional")})
        </span>
        {value.trim() && !open && (
          <span
            className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-accent/10 text-accent truncate max-w-[180px]"
            style={{ fontFamily: activeFont.css }}
            title={value}
          >
            {value.split("\n")[0].slice(0, 30)}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 ml-auto text-muted transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="mt-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={tm(
              "overlay.placeholder",
              "Was ist VERISOL®?\nSpezifische Collagenpeptide, die gezielt für den Körper entwickelt wurden."
            )}
            maxLength={300}
            rows={3}
            className="w-full px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/40 transition-all placeholder:text-muted/40 resize-none"
            style={{
              fontFamily: activeFont.css,
              fontWeight: 400,
              letterSpacing: "0.01em",
              lineHeight: 1.4,
            }}
          />

          {/* Font picker */}
          <div className="mt-2 flex items-center gap-2">
            <Type className="w-3 h-3 text-muted shrink-0" />
            <label className="text-[11px] text-muted shrink-0">
              {tm("overlay.font", "Font")}:
            </label>
            <select
              value={fontId}
              onChange={(e) => onFontChange(e.target.value)}
              className="flex-1 px-2 py-1 rounded-lg bg-card border border-border text-xs focus:outline-none focus:border-accent/40 cursor-pointer"
              style={{ fontFamily: activeFont.css }}
            >
              {categories.map((cat) => (
                <optgroup key={cat} label={cat}>
                  {AD_FONTS.filter((f) => f.category === cat).map((font) => (
                    <FontOption key={font.id} font={font} />
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-muted/70 mt-2">
            {tm(
              "overlay.hint",
              "Top-centered, restrained sizing. First line = headline, next lines = body paragraph. The AI tries to render the text in"
            )}{" "}
            <span
              style={{ fontFamily: activeFont.css }}
              className="text-foreground/80 font-medium"
            >
              {activeFont.name}
            </span>
            .
          </p>

          {progress !== null && (
            <div className="mt-2 flex items-center gap-2 text-[11px] text-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{tm("overlay.processing", "Processing…")}</span>
              {progress > 0 && progress < 1 && (
                <span className="text-muted">{Math.round(progress * 100)}%</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FontOption({ font }: { font: AdFontOption }) {
  return (
    <option value={font.id} style={{ fontFamily: font.css }}>
      {font.name}
    </option>
  );
}
