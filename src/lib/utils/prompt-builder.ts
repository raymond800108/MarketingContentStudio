import type { ProductProfile } from "../profiles/types";

interface ProductAnalysis {
  type: string;
  description: string;
  body_placement: string;
}

/**
 * Build the full prompt for consistent-model image generation.
 * Parameterized by ProductProfile instead of hardcoded to jewelry.
 */
export function buildConsistentModelPrompt(
  profile: ProductProfile,
  analysis: ProductAnalysis,
  numCharRefs: number,
  shotPrompt: string,
  dimension: string,
  outfitContext: string,
  hasOutfitRefs: boolean
): string {
  const outfitRefNote = hasOutfitRefs
    ? "OUTFIT REFERENCE: Some reference images show the outfit the model must wear. Reproduce this outfit EXACTLY — same fabric, color, cut, fit, and style. "
    : "";

  const sizePrompt = profile.sizeConfig
    ? profile.sizeConfig.getSizePrompt(analysis.type, analysis.body_placement, dimension)
    : "";

  // For clothing, the product IS the outfit — different framing
  const isClothing = profile.id === "clothing";

  const productRule = isClothing
    ? `PRODUCT RULE: The LAST reference image shows the exact garment to feature. ` +
      `It is a ${analysis.type}: ${analysis.description}. ` +
      sizePrompt +
      `The model MUST be wearing this EXACT garment — every detail, color, pattern, and construction preserved perfectly. ` +
      `The garment is the hero of the shot, styled and visible clearly. `
    : `PRODUCT RULE: The LAST reference image shows the exact product. ` +
      `The product is a ${analysis.type}: ${analysis.description}. ` +
      sizePrompt +
      `It must be worn/placed ${analysis.body_placement} and must be the EXACT same product — every detail preserved perfectly. ` +
      `The product is the hero of the shot, prominently visible and in sharp focus. `;

  return (
    `ABSOLUTE RULE — CHARACTER IDENTITY: The first ${numCharRefs} reference image${numCharRefs > 1 ? "s" : ""} show the EXACT person who must appear in the generated image. ` +
    profile.consistencyPrefix +
    "\n\n" +
    outfitRefNote +
    productRule +
    "\n\n" +
    (outfitContext && !isClothing
      ? `OUTFIT RULE: The model must wear ${outfitContext}. `
      : "") +
    shotPrompt +
    "\n\n" +
    "The final result must look like one shot from a cohesive luxury campaign series — same person, same styling, across all images."
  );
}

/**
 * Build a short video prompt for Kling image-to-video.
 * Kept concise to respect Kling's text length limit.
 */
export function buildVideoPrompt(
  profile: ProductProfile,
  productType: string,
  placement: string,
  dimension: string
): string {
  const sizeNote =
    dimension && profile.sizeConfig
      ? `The product is ${dimension} cm, keep realistic scale. `
      : "";

  if (profile.id === "furniture") {
    return (
      "Animate this reference image into a cinematic interior design video. " +
      "Slow camera pan revealing the furniture from multiple angles. " +
      `The piece is a ${productType} placed ${placement}. ` +
      sizeNote +
      "Preserve exact materials, colors, and room setting throughout. " +
      "Smooth motion, natural lighting, architectural photography mood."
    );
  }

  if (profile.id === "clothing") {
    return (
      "Animate this reference image into a cinematic fashion campaign video. " +
      "The model walks naturally, showing the garment's movement and drape. " +
      `They are wearing a ${productType}. ` +
      sizeNote +
      "Preserve exact face, body, and garment throughout. " +
      "Smooth elegant motion, editorial lighting, fashion video mood."
    );
  }

  // Default (jewelry and others)
  return (
    "Animate this reference image into a cinematic luxury campaign video. " +
    "The model slowly turns to showcase the product from multiple angles. " +
    `They are wearing a ${productType} ${placement}. ` +
    sizeNote +
    "Preserve exact face, outfit, and product throughout. " +
    "Smooth elegant motion, studio lighting, shallow depth of field, luxurious mood."
  );
}

/**
 * Build a simple product generation prompt (non-consistent-model templates).
 */
export function buildTemplatePrompt(
  profile: ProductProfile,
  templatePrompt: string,
  analysis: ProductAnalysis | null,
  dimension: string
): string {
  const sizePrompt =
    analysis && dimension && profile.sizeConfig
      ? profile.sizeConfig.getSizePrompt(analysis.type, analysis.body_placement, dimension)
      : "";

  const productContext = analysis
    ? `The product is a ${analysis.type}: ${analysis.description}. ${sizePrompt}`
    : "";

  return `${productContext}${templatePrompt}`;
}
