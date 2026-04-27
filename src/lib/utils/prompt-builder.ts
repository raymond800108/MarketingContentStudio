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
      "Use the reference image as the starting frame. " +
      "Keep a wide to medium shot throughout — do NOT zoom in on details. " +
      "The camera slowly pans around the furniture, revealing it from multiple angles. " +
      `The piece is a ${productType} placed ${placement}. ` +
      sizeNote +
      "Smooth cinematic motion, natural lighting, architectural photography mood. " +
      "Preserve exact materials, colors, and room setting from the reference image."
    );
  }

  if (profile.id === "clothing") {
    return (
      "Use the reference image as the starting frame. " +
      "Keep a medium to full-body shot throughout — do NOT zoom in on details. " +
      "The model begins from the pose in the image, then starts moving casually and naturally: " +
      "taking a few relaxed steps, turning around slowly, lightly adjusting the garment, " +
      "letting the fabric flow and drape with each movement. " +
      `The model is wearing a ${productType}. ` +
      sizeNote +
      "The camera follows smoothly at a consistent distance, like a real clothing commercial. " +
      "Show the full outfit and silhouette in every frame. " +
      "Warm editorial lighting, shallow depth of field, luxury fashion ad mood. " +
      "Preserve the exact person, garment, and setting from the reference image."
    );
  }

  // Default (jewelry and others)
  return (
    "Use the reference image as the starting frame. " +
    "Keep a medium shot throughout — do NOT zoom in on details. " +
    "The model begins from the pose in the image, then moves casually: " +
    "turning gently, shifting weight, lightly touching or adjusting the product, " +
    "showcasing it naturally from different angles. " +
    `The model is wearing a ${productType} ${placement}. ` +
    sizeNote +
    "The camera follows smoothly at a consistent distance, like a luxury product commercial. " +
    "Studio lighting, shallow depth of field, elegant mood. " +
    "Preserve the exact person, outfit, product, and setting from the reference image."
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
