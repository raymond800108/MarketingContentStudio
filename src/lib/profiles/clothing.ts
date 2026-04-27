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
    // ── Travel environment themes ─────────────────────────────────
    // All scene-based templates below place the model in a realistic
    // commuting / travel environment: airport, train, car, hotel, etc.
    // These are the primary creative themes for this profile.
    {
      id: "airport-departure",
      name: "Airport Departure",
      icon: "\u{2708}\uFE0F",
      prompt:
        "Editorial travel shot inside a modern international airport terminal. Model wearing the garment, walking confidently through the departures hall with a leather carry-on and passport in hand, floor-to-ceiling windows revealing parked aircraft in the background, soft diffused morning light, clean minimalist architecture, cinematic travel magazine mood, shallow depth of field. The garment is the hero of the shot.",
      description: "Modern airport departures hall with carry-on luggage",
      dynamic: true,
    },
    {
      id: "airport-lounge",
      name: "First-Class Lounge",
      icon: "\u{1F6CB}\uFE0F",
      prompt:
        "Luxury first-class airport lounge interior — model wearing the garment, seated elegantly on a leather lounge chair by the panoramic window with a coffee and a travel magazine, warm ambient lighting, marble floor, minimalist premium decor, editorial travel photography, blurred runway background. The clothing is clearly visible and styled as travel-chic.",
      description: "Premium airport lounge with travel-chic styling",
      dynamic: true,
    },
    {
      id: "train-window",
      name: "Train Window Seat",
      icon: "\u{1F686}",
      prompt:
        "Cinematic shot inside a modern European high-speed train carriage. Model wearing the garment, seated by the window looking out at passing countryside, soft natural daylight streaming through the window, warm golden cast, shallow depth of field with motion blur in the background landscape, nostalgic travel journal mood. The full outfit is clearly visible.",
      description: "Window seat on a high-speed train with passing scenery",
      dynamic: true,
    },
    {
      id: "train-platform",
      name: "Train Platform",
      icon: "\u{1F687}",
      prompt:
        "Editorial travel shot on a grand European train station platform. Model wearing the garment, standing beside a vintage leather suitcase as a train pulls in behind, dramatic morning light breaking through the overhead glass canopy, architectural steel arches, cinematic atmosphere with mild steam/mist, travel magazine editorial.",
      description: "Classic train station platform with vintage luggage",
      dynamic: true,
    },
    {
      id: "road-trip-car",
      name: "Road Trip (In Car)",
      icon: "\u{1F697}",
      prompt:
        "Inside the passenger seat of a premium vehicle on a scenic coastal road trip — model wearing the garment, relaxed, one arm resting on the open window frame, golden hour sunlight streaming in, wind in the hair, blurred scenic landscape outside, warm cinematic travel vlog mood. The outfit is clearly visible from a three-quarter angle.",
      description: "Passenger seat of a premium car on a scenic drive",
      dynamic: true,
    },
    {
      id: "road-trip-exterior",
      name: "Road Trip (By Car)",
      icon: "\u{1F30D}",
      prompt:
        "Cinematic road trip editorial — model wearing the garment, leaning casually against a vintage convertible parked on a scenic cliffside or desert highway pull-off, sunglasses on head, golden hour lighting, wide sweeping landscape in the background, editorial travel magazine mood, full body visible.",
      description: "Leaning against a car on a scenic cliffside highway",
      dynamic: true,
    },
    {
      id: "hotel-arrival",
      name: "Hotel Arrival",
      icon: "\u{1F3E8}",
      prompt:
        "Boutique hotel lobby arrival scene — model wearing the garment, standing at a marble reception desk with designer luggage beside them, warm ambient chandelier lighting, lush potted plants and brass fixtures, travel editorial photography, the full outfit clearly visible as the model checks in.",
      description: "Boutique hotel lobby check-in with luggage",
      dynamic: true,
    },
    {
      id: "hotel-balcony",
      name: "Hotel Balcony View",
      icon: "\u{1F30A}",
      prompt:
        "Luxury hotel room balcony with a panoramic ocean or city skyline view — model wearing the garment, leaning on the balcony railing with a morning coffee, soft sunrise light, flowing curtains behind, cinematic destination travel mood, shallow depth of field, the outfit fully visible from the front.",
      description: "Luxury balcony with ocean or skyline view",
      dynamic: true,
    },
    {
      id: "taxi-window",
      name: "City Taxi",
      icon: "\u{1F699}",
      prompt:
        "Inside a yellow taxi or black cab in a major city — model wearing the garment, seated in the back with phone in hand, neon city lights and wet streets reflected through the window at night, cinematic urban travel mood, shallow depth of field, street lights creating bokeh behind.",
      description: "Back seat of a city taxi at night with neon reflections",
      dynamic: true,
    },
    {
      id: "street-cafe-travel",
      name: "Cafe Stopover",
      icon: "\u{2615}",
      prompt:
        "Charming European street cafe during a travel stopover — model wearing the garment, seated at a small outdoor table with a map and an espresso, cobblestone street visible, warm afternoon sunlight, travel blog editorial mood, the full outfit clearly visible.",
      description: "European street cafe stopover with map and espresso",
      dynamic: true,
    },
    {
      id: "consistent-model",
      name: "Consistent Model (Travel)",
      icon: "\u{1F464}",
      prompt:
        "Same travelling model across your entire lookbook — upload character reference images and the same person will appear across every travel scene, preserving their face and identity.",
      description: "Same model across all travel looks — upload character reference",
      dynamic: true,
    },
    // ── Classic product-focused templates (kept for e-commerce) ────
    // These are the non-travel shots every clothing brand still needs:
    // flat-lay, on-hanger, ghost-mannequin, and macro detail.
    {
      id: "flat-lay",
      name: "Flat Lay",
      icon: "\u{1F4D0}",
      prompt:
        "Perfectly styled flat lay on clean white surface, the garment neatly arranged with crisp folds alongside travel essentials like passport and sunglasses, top-down overhead shot, soft even lighting, e-commerce ready product photography.",
      description: "Overhead flat lay styled with travel essentials",
    },
    {
      id: "on-hanger",
      name: "On Hanger Studio",
      icon: "\u{1F9F5}",
      prompt:
        "Garment displayed on a premium wooden or velvet hanger against a clean studio backdrop, showing the full silhouette and drape, professional catalog photography.",
      description: "Displayed on premium hanger showing full silhouette",
    },
    {
      id: "ghost-mannequin",
      name: "Ghost Mannequin",
      icon: "\u{1F47B}",
      prompt:
        "Invisible mannequin photography — the garment appears to be worn by an invisible figure, showing 3D shape and fit without a model, clean white background, professional e-commerce style.",
      description: "Invisible mannequin showing 3D shape without a model",
    },
    {
      id: "detail-texture",
      name: "Detail & Texture",
      icon: "\u{1F50D}",
      prompt:
        "Extreme close-up on fabric texture, stitching details, buttons, zippers, or embroidery, macro photography revealing craftsmanship, shallow depth of field.",
      description: "Macro close-up on fabric texture, stitching and details",
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
    label: "studio.sizeLabel.garment",
    placeholder: "studio.sizePlaceholder.garment",
    getSizePrompt: getClothingSizePrompt,
  },

  defaultAspectRatio: "3:4",
  defaultVideoRatio: "9:16",
  defaultOutfit: "",

  socialPresets: SOCIAL_PRESETS,
};
