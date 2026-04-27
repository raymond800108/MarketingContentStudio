/**
 * Catalog of typefaces offered in the Ad Headline & Body picker.
 *
 * Each entry provides:
 *   id        — stable key stored in ui-store
 *   name      — label shown in the dropdown
 *   css       — font-family stack used to visualize the option (and input value)
 *   prompt    — phrase injected into the AI generation prompt so the model
 *               tries to render the text in this typeface
 *   category  — used for grouping in the dropdown
 *
 * Fonts marked with (G) are loaded via Google Fonts in the root layout so
 * previews render faithfully. Fonts without (G) are commercial — the preview
 * uses the closest available fallback from the CSS stack; the AI model itself
 * recognises the typeface name in the prompt.
 */

export interface AdFontOption {
  id: string;
  name: string;
  css: string;
  prompt: string;
  category: "Editorial Serif" | "Display Serif" | "Classical Serif" | "Modern Sans" | "Geometric Sans";
}

export const AD_FONTS: AdFontOption[] = [
  // ── Editorial Serifs (moderate contrast, wellness/beauty/editorial brands) ──
  {
    id: "lyon",
    name: "Lyon Text",
    css: '"Lyon Text", "Tiempos Text", "Source Serif Pro", "PT Serif", Georgia, serif',
    prompt:
      "refined transitional serif in the style of Lyon Text — moderate stroke contrast, slight flared terminals, warm editorial proportions, premium wellness / beauty brand typography",
    category: "Editorial Serif",
  },
  {
    id: "tiempos",
    name: "Tiempos Text",
    css: '"Tiempos Text", "PT Serif", "Source Serif Pro", Georgia, serif',
    prompt:
      "modern editorial serif in the style of Tiempos Text — clean transitional forms, warm proportions, the kind of typography used by New York Times and premium wellness brands",
    category: "Editorial Serif",
  },
  {
    id: "freight",
    name: "Freight Text",
    css: '"Freight Text Pro", "PT Serif", "Source Serif Pro", Georgia, serif',
    prompt:
      "warm transitional serif in the style of Freight Text — slightly flared terminals, wellness and clean-beauty brand typography",
    category: "Editorial Serif",
  },

  // ── Display Serifs (high contrast, fashion/luxury mastheads) ──
  {
    id: "playfair",
    name: "Playfair Display", // (G)
    css: '"Playfair Display", "GFS Didot", Didot, Georgia, serif',
    prompt:
      "elegant high-contrast display serif in the style of Playfair Display — thin hairlines with strong vertical stems, modern-classical editorial aesthetic",
    category: "Display Serif",
  },
  {
    id: "didot",
    name: "Didot",
    css: 'Didot, "GFS Didot", "Bodoni Moda", "Playfair Display", Georgia, serif',
    prompt:
      "high-contrast Didot-style display serif — ultra-thin horizontal strokes, sharp vertical emphasis, Parisian haute couture magazine masthead typography (Vogue / Harper's Bazaar)",
    category: "Display Serif",
  },
  {
    id: "bodoni",
    name: "Bodoni Moda", // (G)
    css: '"Bodoni Moda", "Bodoni 72", Didot, "Playfair Display", Georgia, serif',
    prompt:
      "neo-classical Bodoni-style serif with extreme stroke contrast, geometric rationality, ultra-thin horizontals and thick verticals, couture fashion campaign masthead",
    category: "Display Serif",
  },

  // ── Classical Serifs (Garalde, humanist book-style) ──
  {
    id: "cormorant",
    name: "Cormorant Garamond", // (G)
    css: '"Cormorant Garamond", "EB Garamond", Garamond, Georgia, serif',
    prompt:
      "classical Garalde serif in the style of Cormorant Garamond — elegant Renaissance proportions, graceful italics, timeless luxury book typography",
    category: "Classical Serif",
  },
  {
    id: "eb-garamond",
    name: "EB Garamond", // (G)
    css: '"EB Garamond", Garamond, "Adobe Garamond Pro", Georgia, serif',
    prompt:
      "classical Garamond serif — Renaissance humanist proportions, refined book-quality typography, understated luxury",
    category: "Classical Serif",
  },

  // ── Modern Sans-Serifs (tech-forward, minimalist ads) ──
  {
    id: "inter",
    name: "Inter", // (G)
    css: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
    prompt:
      "modern geometric sans-serif in the style of Inter — clean neutral proportions, tech-forward minimalist ad typography",
    category: "Modern Sans",
  },
  {
    id: "helvetica",
    name: "Helvetica Neue",
    css: '"Helvetica Neue", Helvetica, "Inter", Arial, sans-serif',
    prompt:
      "neutral grotesque sans-serif in the style of Helvetica Neue — iconic Swiss Modernism, clean and direct advertising typography",
    category: "Modern Sans",
  },
  {
    id: "montserrat",
    name: "Montserrat", // (G)
    css: '"Montserrat", "Helvetica Neue", Helvetica, Arial, sans-serif',
    prompt:
      "geometric humanist sans-serif in the style of Montserrat — modern urban minimalism, evenly weighted forms",
    category: "Modern Sans",
  },

  // ── Geometric Sans (fashion-house minimalism) ──
  {
    id: "futura",
    name: "Futura",
    css: 'Futura, "Futura PT", "Jost", "Nunito", sans-serif',
    prompt:
      "geometric sans-serif in the style of Futura — perfect circular O, Bauhaus modernism, fashion-house minimalism (Louis Vuitton / Supreme aesthetic)",
    category: "Geometric Sans",
  },
  {
    id: "avenir",
    name: "Avenir",
    css: 'Avenir, "Avenir Next", "Nunito", "Montserrat", sans-serif',
    prompt:
      "humanist geometric sans-serif in the style of Avenir — warm modern minimalism, softened geometric proportions",
    category: "Geometric Sans",
  },
];

export const DEFAULT_AD_FONT_ID = "lyon";

export function getAdFont(id: string | undefined): AdFontOption {
  return AD_FONTS.find((f) => f.id === id) || AD_FONTS[0];
}
