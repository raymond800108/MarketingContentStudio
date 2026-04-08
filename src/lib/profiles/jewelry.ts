import type { ProductProfile } from "./types";
import { SOCIAL_PRESETS } from "./shared";

function getJewelrySizePrompt(productType: string, _placement: string, dimension: string): string {
  if (!dimension.trim()) return "";
  const raw = dimension.trim().toLowerCase();
  const nums = raw.match(/[\d.]+/g)?.map(Number).filter((n) => !isNaN(n));
  if (!nums || nums.length === 0) return "";
  const maxCm = Math.max(...nums);
  const minCm = Math.min(...nums);
  const t = productType.toLowerCase();
  let desc = "";

  if (t.includes("ring")) {
    if (maxCm <= 1) desc = "a thin, delicate band — barely wider than the finger it sits on";
    else if (maxCm <= 2) desc = "a normal-sized ring — proportional to the finger, not oversized";
    else desc = "a statement ring — slightly larger than typical but still proportional to the hand";
  } else if (t.includes("earring")) {
    if (maxCm <= 1.5) desc = "tiny stud earrings — smaller than the earlobe, sitting flush against the ear";
    else if (maxCm <= 3) desc = "small drop earrings — roughly the length of the earlobe";
    else if (maxCm <= 5) desc = "medium earrings — extending slightly below the earlobe";
    else desc = "long dangling earrings — reaching toward the jawline but NOT touching the shoulder";
  } else if (t.includes("necklace") || t.includes("pendant")) {
    if (maxCm <= 1.5) desc = "a tiny, delicate pendant — about the size of a fingernail";
    else if (maxCm <= 3) desc = "a small pendant — roughly thumbnail-sized, sitting against the collarbone area";
    else if (maxCm <= 5) desc = "a medium pendant — about the width of two fingers side by side";
    else desc = "a larger pendant — but still much smaller than the palm of a hand";
  } else if (t.includes("bracelet") || t.includes("bangle")) {
    if (minCm <= 0.5) desc = "a thin, delicate chain bracelet — a fine line around the wrist";
    else if (minCm <= 1) desc = "a slim bracelet — about the width of a pencil, fitting snugly on the wrist";
    else desc = "a medium-width bracelet — but NOT a cuff, still proportional to the wrist";
  } else if (t.includes("brooch") || t.includes("pin")) {
    if (maxCm <= 2) desc = "a small brooch — about the size of a coin, pinned on fabric";
    else if (maxCm <= 4) desc = "a medium brooch — roughly the size of two coins side by side";
    else desc = "a larger brooch — but still fits within the palm of a hand";
  } else {
    if (maxCm <= 1) desc = "a very tiny, delicate piece — smaller than a fingertip";
    else if (maxCm <= 3) desc = "a small piece — roughly thumbnail-sized";
    else if (maxCm <= 5) desc = "a medium-sized piece — about the width of two fingers";
    else desc = "a moderately sized piece — but still proportional to the body, NOT oversized";
  }

  return (
    `CRITICAL SIZE RULE: The jewelry is ${desc} (${raw} cm). ` +
    "Do NOT enlarge or exaggerate the jewelry. It must appear at REALISTIC proportions relative to the model's body. " +
    "If anything, err on the side of making it slightly SMALLER rather than bigger. " +
    "The jewelry should look like a real photograph — real jewelry is always small relative to the human body. "
  );
}

export const jewelry: ProductProfile = {
  id: "jewelry",
  name: "Jewelry & Accessories",
  icon: "\u{1F48E}",
  description: "Rings, necklaces, earrings, bracelets, watches — fine and fashion jewelry",

  analysisSystemPrompt: `You are a luxury jewelry expert. Analyze the jewelry in this image and return JSON with these fields:
- type: the jewelry type (ring, necklace, earring, bracelet, brooch, watch, etc.)
- description: a concise description of the piece (materials, stones, style)
- body_placement: where it is worn (on the finger, around the neck, on the ear, on the wrist, etc.)
- materials: array of detected materials (gold, silver, platinum, diamond, pearl, etc.)
- style: the style category (minimalist, vintage, statement, classic, bohemian, etc.)
Return ONLY valid JSON, no markdown.`,

  templates: [
    {
      id: "clean-neutral",
      name: "Clean & Neutral",
      icon: "\u25FB",
      prompt: "Pure white or soft neutral seamless background with balanced studio lighting, the jewelry placed elegantly center-frame with subtle reflections, clean commercial product photography",
      description: "Pure white or soft neutral seamless background with balanced studio lighting",
    },
    {
      id: "elemental-artistic",
      name: "Elemental & Artistic",
      icon: "\u{1F4A7}",
      prompt: "Water droplets, smoke wisps or prism light refractions dancing around the jewelry piece, artistic high-fashion editorial style, dramatic and ethereal atmosphere",
      description: "Water droplets, smoke wisps or prism light refractions around the piece",
    },
    {
      id: "detail-closeup",
      name: "Detail Close-Up",
      icon: "\u{1F50D}",
      prompt: "Extreme macro close-up photography focusing on engravings, metal joins, and gemstone settings, ultra-sharp focus on fine details, shallow depth of field, studio lighting revealing textures",
      description: "Extreme macro focus on engravings, metal joins and gemstone settings",
    },
    {
      id: "packaging-box",
      name: "Packaging Box",
      icon: "\u{1F381}",
      prompt: "Inside an open luxury jewellery box with plush cushion interior, the piece nestled elegantly, premium packaging presentation, soft directional lighting with warm tones",
      description: "Inside an open luxury jewellery box with plush cushion interior",
    },
    {
      id: "natural-branches",
      name: "Natural Branches",
      icon: "\u{1F33F}",
      prompt: "Draped over sculptural tree branch with organic curves and bark texture, natural daylight filtering through, earthy tones with green accents, editorial nature styling",
      description: "Draped over sculptural tree branch with organic curves and bark texture",
    },
    {
      id: "vintage-heritage",
      name: "Vintage Heritage",
      icon: "\u{1F4DC}",
      prompt: "Classic heritage setting with aged linen, warm tones and old-world elegance, antique props, soft golden hour lighting, timeless luxury atmosphere",
      description: "Classic heritage setting with aged linen, warm tones and old-world elegance",
    },
    {
      id: "moss-rock",
      name: "Moss & Rock",
      icon: "\u{1F33F}",
      prompt: "Nestled on moss-covered rock with soft cream background, editorial top view, natural textures contrasting with the jewelry's refined craftsmanship, organic luxury",
      description: "Nestled on moss-covered rock with soft cream background, editorial top view",
    },
    {
      id: "glass-display",
      name: "Glass Display Box",
      icon: "\u{1F3AE}",
      prompt: "Museum-grade glass showcase on polished marble base with soft highlights, the jewelry displayed like a precious artifact, clean reflections, gallery-style presentation",
      description: "Museum-grade glass showcase on polished marble base with soft highlights",
    },
    {
      id: "natural-surface",
      name: "Natural Surface",
      icon: "\u26F0\uFE0F",
      prompt: "Raw stone, marble, sand or wood surface with organic texture contrast, the jewelry placed naturally, warm directional lighting creating depth and shadow",
      description: "Raw stone, marble, sand or wood surface with organic texture contrast",
    },
    {
      id: "dark-dramatic",
      name: "Dark & Dramatic",
      icon: "\u{1F30C}",
      prompt: "Deep black backdrop with bold directional key light and crisp highlights, dramatic chiaroscuro lighting, the jewelry gleaming against darkness, high-contrast luxury",
      description: "Deep black backdrop with bold directional key light and crisp highlights",
    },
    {
      id: "creative-floating",
      name: "Creative Floating",
      icon: "\u2728",
      prompt: "Levitating mid-air with soft shadow beneath, weightless artistic composition, clean background with subtle gradient, magical suspended jewelry photography",
      description: "Levitating mid-air with soft shadow beneath, weightless artistic composition",
    },
    {
      id: "high-end-model",
      name: "High-End Model",
      icon: "\u{1F451}",
      prompt: "Luxury brand campaign — stylish model wearing your jewelry in editorial style, professional fashion photography, studio or lifestyle setting, the jewelry as hero piece",
      description: "Luxury brand campaign — stylish model wearing your jewelry in editorial style",
      dynamic: true,
    },
    {
      id: "consistent-model",
      name: "Consistent Model",
      icon: "\u{1F464}",
      prompt: "Same model character wears all your jewelry — upload character reference images for consistent identity across all generated shots",
      description: "Same model character wears all your jewelry — upload character reference",
      dynamic: true,
    },
    {
      id: "clean-white-studio",
      name: "Clean White Studio",
      icon: "\u2B1C",
      prompt: "Transforms any messy photo into a clean white background product shot, pure white seamless backdrop, even studio lighting, professional e-commerce ready",
      description: "Transforms any messy photo into a clean white background product shot",
    },
    {
      id: "ugc-model",
      name: "UGC Style",
      icon: "\u{1F4F1}",
      prompt: "User-generated content style — casual, authentic-feeling photo of someone wearing the jewelry in everyday life, natural lighting, smartphone aesthetic",
      description: "Authentic UGC-style photo for social media campaigns",
      dynamic: true,
    },
  ],

  shotTypes: [
    {
      id: "closeup-front",
      label: "Close-up Front",
      scenePrompt: "Close-up front-facing portrait emphasizing the jewelry. Upper body visible, soft blurred background, studio lighting.",
      aspectRatio: "1:1",
    },
    {
      id: "medium-angle",
      label: "Medium Angle",
      scenePrompt: "Medium shot, slight three-quarter angle. Natural pose showing the jewelry in context with the outfit. Lifestyle setting.",
    },
    {
      id: "editorial-wide",
      label: "Editorial Wide",
      scenePrompt: "Wide editorial shot. Full or three-quarter body, dramatic pose, fashion-forward composition. The jewelry catches light prominently.",
    },
    {
      id: "detail-hero",
      label: "Detail Hero",
      scenePrompt: "Tight crop on the jewelry itself being worn. Shallow depth of field, the jewelry in tack-sharp focus, skin and fabric softly blurred.",
      aspectRatio: "1:1",
    },
  ],

  supportsConsistentModel: true,

  consistencyPrefix:
    "You MUST reproduce this SPECIFIC person — her EXACT face, facial bone structure, eye shape, nose, lips, jawline, skin tone, hair color, hair style, hair texture, and body type. " +
    "This is NOT a generic model — she is a SPECIFIC real person and MUST be recognizable as the SAME individual across every generated image. " +
    "Copy her appearance from the reference photos as precisely as a portrait photographer would.",

  sizeConfig: {
    label: "Piece size (cm)",
    placeholder: "e.g. 2\u00D73",
    getSizePrompt: getJewelrySizePrompt,
  },

  defaultAspectRatio: "4:3",
  defaultVideoRatio: "16:9",
  defaultOutfit: "an elegant black evening dress with a flattering neckline that showcases the jewelry",

  socialPresets: SOCIAL_PRESETS,
};
