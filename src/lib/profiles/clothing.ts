import type { ProductProfile } from "./types";
import { SOCIAL_PRESETS } from "./shared";

function getClothingSizePrompt(productType: string, _placement: string, dimension: string): string {
  if (!dimension.trim()) return "";
  const raw = dimension.trim().toUpperCase();
  const t = productType.toLowerCase();

  // Size label mapping
  const sizeDescMap: Record<string, string> = {
    XS: "an extra-small, petite fit — snug and close to the body",
    S: "a small, slim fit — tailored but not tight",
    M: "a medium, regular fit — standard proportions",
    L: "a large, relaxed fit — comfortable with slight room",
    XL: "an extra-large, oversized fit — loose and roomy",
    XXL: "a double extra-large, very loose fit",
  };

  const sizeDesc = sizeDescMap[raw];
  if (sizeDesc) {
    return (
      `SIZE RULE: The garment is ${sizeDesc}. ` +
      "Render it at realistic proportions on the model — the fit should look natural, not exaggerated. "
    );
  }

  // Numeric dimensions (e.g. "chest 100, length 70")
  let fitDesc = "";
  if (t.includes("dress") || t.includes("skirt")) {
    fitDesc = "Ensure the garment length and silhouette look proportional to the model's body height.";
  } else if (t.includes("jacket") || t.includes("coat") || t.includes("blazer")) {
    fitDesc = "Ensure the shoulders and sleeve length look properly tailored to the model.";
  } else if (t.includes("pant") || t.includes("trouser") || t.includes("jean")) {
    fitDesc = "Ensure the inseam and waist look proportional and natural on the model.";
  } else {
    fitDesc = "Ensure the garment fits naturally and proportionally on the model.";
  }

  return (
    `SIZE RULE: The garment measurements are ${raw} cm. ${fitDesc} ` +
    "Do NOT make the clothing look oversized or undersized — aim for a realistic, well-fitted appearance. "
  );
}

export const clothing: ProductProfile = {
  id: "clothing",
  name: "Clothing & Fashion",
  icon: "\u{1F455}",
  description: "Dresses, tops, outerwear, pants, accessories — fashion apparel",

  analysisSystemPrompt: `You are a fashion industry expert. Analyze the garment in this image and return JSON with these fields:
- type: the garment type (dress, blouse, jacket, pants, skirt, sweater, coat, etc.)
- description: a concise description (fabric, pattern, color, notable details)
- body_placement: how it is worn (upper body, lower body, full body, layered over, etc.)
- materials: array of detected fabrics (cotton, silk, wool, denim, polyester, linen, etc.)
- style: the style category (casual, formal, streetwear, bohemian, minimalist, sporty, etc.)
- color: primary color and any patterns (solid navy, floral print, striped, etc.)
- season: best season for this garment (spring, summer, fall, winter, all-season)
Return ONLY valid JSON, no markdown.`,

  templates: [
    {
      id: "flat-lay",
      name: "Flat Lay",
      icon: "\u{1F4D0}",
      prompt: "Perfectly styled flat lay on clean white surface, the garment neatly arranged with crisp folds, top-down overhead shot, soft even lighting, e-commerce ready product photography",
      description: "Overhead flat lay on clean surface with styled arrangement",
    },
    {
      id: "on-hanger",
      name: "On Hanger Studio",
      icon: "\u{1F9F5}",
      prompt: "Garment displayed on a premium wooden or velvet hanger against a clean studio backdrop, showing the full silhouette and drape, professional catalog photography",
      description: "Displayed on premium hanger showing full silhouette",
    },
    {
      id: "ghost-mannequin",
      name: "Ghost Mannequin",
      icon: "\u{1F47B}",
      prompt: "Invisible mannequin photography — the garment appears to be worn by an invisible figure, showing 3D shape and fit without a model, clean white background, professional e-commerce style",
      description: "Invisible mannequin showing 3D shape without a model",
    },
    {
      id: "street-style",
      name: "Street Style",
      icon: "\u{1F3D9}\uFE0F",
      prompt: "Urban street style editorial — model wearing the garment in a city setting, candid confident pose, natural daylight, blurred urban background, fashion blogger aesthetic",
      description: "Urban editorial with model in city setting, candid style",
    },
    {
      id: "editorial-model",
      name: "Editorial Model",
      icon: "\u{1F4F7}",
      prompt: "High-fashion editorial shoot — professional model wearing the garment, dramatic pose, studio or curated setting, fashion magazine quality, the clothing as the hero",
      description: "High-fashion editorial with professional model",
      dynamic: true,
    },
    {
      id: "consistent-model",
      name: "Consistent Model",
      icon: "\u{1F464}",
      prompt: "Same model character wears all your clothing — upload character reference images for consistent identity across lookbook",
      description: "Same model across all looks — upload character reference",
      dynamic: true,
    },
    {
      id: "detail-texture",
      name: "Detail & Texture",
      icon: "\u{1F50D}",
      prompt: "Extreme close-up on fabric texture, stitching details, buttons, zippers, or embroidery, macro photography revealing craftsmanship, shallow depth of field",
      description: "Macro close-up on fabric texture, stitching and details",
    },
    {
      id: "lifestyle-casual",
      name: "Lifestyle Casual",
      icon: "\u2615",
      prompt: "Relaxed lifestyle setting — model wearing the garment in a cozy cafe, sunlit apartment, or garden, warm authentic atmosphere, natural photography feel",
      description: "Relaxed lifestyle setting with warm, authentic atmosphere",
    },
    {
      id: "lookbook-studio",
      name: "Lookbook Studio",
      icon: "\u{1F4D6}",
      prompt: "Clean lookbook studio shot — model standing on seamless backdrop, full body visible, neutral pose showing the garment clearly, even studio lighting, brand lookbook style",
      description: "Clean studio lookbook shot showing full garment on model",
    },
    {
      id: "seasonal-outdoor",
      name: "Seasonal Outdoor",
      icon: "\u{1F342}",
      prompt: "Seasonal outdoor editorial — model wearing the garment in nature setting matching the season, golden hour lighting, cinematic depth, editorial fashion photography",
      description: "Seasonal outdoor setting with golden hour lighting",
    },
    {
      id: "mix-match",
      name: "Mix & Match",
      icon: "\u{1F3A8}",
      prompt: "Styled outfit combination — the garment paired with complementary pieces, showing how to wear it, multiple items visible, fashion styling inspiration",
      description: "Styled outfit pairing showing how to wear the piece",
    },
    {
      id: "ugc-model",
      name: "UGC Style",
      icon: "\u{1F4F1}",
      prompt: "User-generated content style — casual selfie-like photo wearing the garment, natural lighting, authentic feel, Instagram-worthy but not overly polished",
      description: "Authentic UGC-style for social media campaigns",
      dynamic: true,
    },
  ],

  shotTypes: [
    {
      id: "front-view",
      label: "Front View",
      scenePrompt: "Full body front-facing shot. Model standing naturally with a confident, relaxed pose. The garment is fully visible from neckline to hem — every detail of the front design, buttons, print, and construction clearly shown. Clean studio background, even professional lighting.",
      aspectRatio: "3:4",
    },
    {
      id: "back-view",
      label: "Back View",
      scenePrompt: "Full body rear view. Model standing with back to camera, head turned slightly to show profile. The garment's back design, closure, seams, and construction are fully visible. Clean studio background, even lighting.",
      aspectRatio: "3:4",
    },
    {
      id: "side-view",
      label: "Side View",
      scenePrompt: "Full body side profile view. Model turned 90 degrees showing the garment's silhouette, drape, fit, and how it falls on the body from the side. Clean studio background, even lighting.",
      aspectRatio: "3:4",
    },
    {
      id: "detail-closeup",
      label: "Detail Close-Up",
      scenePrompt: "Tight crop focusing on the garment's most distinctive detail — fabric texture, stitching quality, buttons, zipper, embroidery, print pattern, or label. Macro-style photography with shallow depth of field, sharp focus on the detail.",
      aspectRatio: "1:1",
    },
  ],

  supportsConsistentModel: true,

  consistencyPrefix:
    "You MUST reproduce this SPECIFIC person — their EXACT face, facial bone structure, eye shape, nose, lips, jawline, skin tone, hair color, hair style, hair texture, and body type. " +
    "This is NOT a generic model — they are a SPECIFIC real person and MUST be recognizable as the SAME individual across every generated image. " +
    "Copy their appearance from the reference photos as precisely as a portrait photographer would.",

  sizeConfig: {
    label: "Garment size",
    placeholder: "e.g. M or chest 100",
    getSizePrompt: getClothingSizePrompt,
  },

  defaultAspectRatio: "3:4",
  defaultVideoRatio: "9:16",
  defaultOutfit: "",

  socialPresets: SOCIAL_PRESETS,
};
