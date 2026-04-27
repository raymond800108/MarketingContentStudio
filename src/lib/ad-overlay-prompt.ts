/**
 * Builds a refined editorial advertisement style prompt injection.
 *
 * Layout rules (match premium wellness / beauty campaign aesthetic):
 *   — Headline + body paragraph, both centered on the same vertical axis
 *   — Positioned in the UPPER portion of the frame (top-centered), not oversized
 *   — Typeface selected by the user from the ad-fonts catalog
 *   — Calm, restrained sizing with generous negative space
 *   — Subject occupies the lower-middle / bottom of the frame
 *
 * The user's `overlayText` is split on newlines:
 *   first line → headline (centered, refined size, top third)
 *   remaining lines → body paragraph (smaller, same font, wraps naturally)
 */

export function buildAdOverlayPrompt(
  overlayText: string,
  isVideo = false,
  fontPrompt?: string
): string {
  const text = overlayText.trim();
  if (!text) return "";

  const parts = text.split("\n").map((s) => s.trim()).filter(Boolean);
  const headline = parts[0] || "";
  const body = parts.slice(1).join(" ").trim();

  const mediaKind = isVideo ? "video" : "image";

  // Default font phrase if none supplied (keeps backwards compat)
  const typefacePhrase =
    fontPrompt ||
    "refined transitional serif in the style of Lyon Text / Tiempos Text — moderate stroke contrast, slight flared terminals, warm editorial proportions";

  return `

--- EDITORIAL AD STYLE ---
Create a refined editorial advertisement ${mediaKind} with a calm, balanced composition evoking a luxury wellness or premium beauty campaign. Minimalist, editorial photography, shallow depth of field, soft natural lighting, warm neutral tones, generous negative space.

TEXT OVERLAY — MUST appear rendered clearly in the ${mediaKind}, spelled exactly as given, legible and not garbled. All text rendered in a ${typefacePhrase}. Pure white text. Centered horizontally on the same vertical axis as the subject.

• Headline: "${headline}" — placed in the UPPER THIRD of the frame (top-centered, NOT lower-center, NOT oversized). Moderate, restrained size roughly 3–4% of frame height. Regular weight serif with graceful proportions. Calm and editorial.${
    body
      ? `
• Body paragraph: "${body}" — positioned directly below the headline on the same centered axis, in the SAME serif font but noticeably smaller (roughly 55–65% of headline size), regular weight, comfortable line-height. Wraps naturally over 2–3 lines if long, with balanced line-breaks. Generous spacing between headline and body.`
      : ""
  }

TYPOGRAPHY LAYOUT: restrained visual hierarchy — the headline is the focal point but is NEVER oversized or shouting. Keep all text modest in size. Plenty of breathing room above, below, and between text blocks. Editorial magazine composition, not marketing-banner.

COMPOSITION: subject occupies the lower-middle to bottom portion of the frame; text block occupies the upper portion over clean negative space; never cover the subject or key product details. Balanced, airy, premium spacing.

COLOR & CONTRAST: clean muted tones, warm neutral backgrounds where possible, soft and quiet. Text is legible without requiring heavy shadows, gradients, or overlays. Keep it subtle.

MOOD: elegant, sophisticated, timeless luxury. Premium wellness / clean beauty / editorial fashion campaign. Think Aesop, Chanel, Harper's Bazaar editorials — refined, restrained, aspirational. No neon, no cyberpunk, no tech-forward aggression, no bold oversized typography.
--- END EDITORIAL AD STYLE ---`.trim();
}
