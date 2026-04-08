import type { ProductProfile } from "./types";
import { SOCIAL_PRESETS } from "./shared";

function getFurnitureSizePrompt(productType: string, _placement: string, dimension: string): string {
  if (!dimension.trim()) return "";
  const raw = dimension.trim().toLowerCase();
  const nums = raw.match(/[\d.]+/g)?.map(Number).filter((n) => !isNaN(n));
  if (!nums || nums.length === 0) return "";
  const maxCm = Math.max(...nums);
  const t = productType.toLowerCase();

  let scaleRef = "";
  if (t.includes("chair") || t.includes("stool")) {
    if (maxCm <= 50) scaleRef = "a small accent chair — about knee height, compact enough to fit beside a sofa";
    else if (maxCm <= 90) scaleRef = "a standard dining or desk chair — seat at knee height, backrest reaching mid-torso when sitting";
    else scaleRef = "a tall bar stool or high-back chair — seat above knee height";
  } else if (t.includes("table") || t.includes("desk")) {
    if (maxCm <= 50) scaleRef = "a low coffee table or side table — about knee height, fits next to a sofa";
    else if (maxCm <= 80) scaleRef = "a standard dining or work table — waist height when standing";
    else scaleRef = "a tall counter or standing desk — chest to shoulder height";
  } else if (t.includes("sofa") || t.includes("couch")) {
    scaleRef = "a full-size sofa — seat height at knee level, wide enough for 2-3 people side by side";
  } else if (t.includes("bed")) {
    scaleRef = "a bed — low platform at knee height, length of a person lying down";
  } else if (t.includes("shelf") || t.includes("bookcase") || t.includes("cabinet")) {
    if (maxCm <= 100) scaleRef = "a low storage unit — waist height or below, fits under a window";
    else scaleRef = "a tall shelving unit — roughly human height or taller";
  } else if (t.includes("lamp") || t.includes("light")) {
    if (maxCm <= 40) scaleRef = "a small table lamp — sits on a desk or nightstand";
    else if (maxCm <= 120) scaleRef = "a medium floor lamp — roughly waist to chest height";
    else scaleRef = "a tall floor lamp — roughly head height or taller";
  } else {
    if (maxCm <= 50) scaleRef = "a small furniture piece — roughly knee height";
    else if (maxCm <= 100) scaleRef = "a medium furniture piece — roughly waist height";
    else scaleRef = "a large furniture piece — roughly human-height scale";
  }

  return (
    `CRITICAL SCALE RULE: This furniture is ${scaleRef} (dimensions: ${raw} cm). ` +
    "Render it at REALISTIC room scale — it should look proportional to the room, doorways, windows, and any people present. " +
    "Do NOT make the furniture look miniature or oversized. Use standard room proportions as reference (2.4m ceiling, 80cm door width). "
  );
}

export const furniture: ProductProfile = {
  id: "furniture",
  name: "Furniture & Home",
  icon: "\u{1FA91}",
  description: "Sofas, tables, chairs, shelving, lighting — furniture and home decor",

  analysisSystemPrompt: `You are an interior design and furniture expert. Analyze the furniture in this image and return JSON with these fields:
- type: the furniture type (sofa, dining table, chair, bookshelf, bed, lamp, desk, cabinet, etc.)
- description: a concise description (materials, color, design style, notable features)
- body_placement: where it goes in a room (living room floor, dining area, bedroom, entryway, etc.)
- materials: array of detected materials (oak, walnut, leather, fabric, metal, glass, marble, etc.)
- style: the design style (modern, mid-century, scandinavian, industrial, rustic, minimalist, etc.)
- color: primary color and finish (natural oak, matte black, cream upholstery, etc.)
Return ONLY valid JSON, no markdown.`,

  templates: [
    {
      id: "white-studio",
      name: "White Studio",
      icon: "\u2B1C",
      prompt: "Clean white cyclorama studio, the furniture piece centered and fully visible, soft even lighting from multiple directions, no shadows, professional catalog photography for e-commerce",
      description: "Clean white studio backdrop for e-commerce catalog",
    },
    {
      id: "room-modern",
      name: "Modern Room Scene",
      icon: "\u{1F3E0}",
      prompt: "Styled in a contemporary modern living space — clean lines, neutral palette, curated decor, natural light from large windows, the furniture as the focal point, interior design magazine quality",
      description: "Contemporary modern living space with curated styling",
    },
    {
      id: "room-cozy",
      name: "Cozy Room Scene",
      icon: "\u{1F6CB}\uFE0F",
      prompt: "Warm, inviting room setting — soft textiles, warm lighting, plants, books, lived-in but styled atmosphere, the furniture looking comfortable and welcoming, hygge aesthetic",
      description: "Warm, inviting room with soft textiles and warm lighting",
    },
    {
      id: "detail-material",
      name: "Material Detail",
      icon: "\u{1F50D}",
      prompt: "Extreme close-up on material quality — wood grain, leather texture, fabric weave, metal finish, joinery details, macro photography revealing craftsmanship and quality",
      description: "Macro close-up on wood grain, fabric, joinery details",
    },
    {
      id: "lifestyle-overhead",
      name: "Lifestyle Overhead",
      icon: "\u{1F4F7}",
      prompt: "Top-down overhead view of the furniture in use — styled with accessories, books, plants, coffee cups, showing the piece in daily life, editorial flat-lay perspective",
      description: "Top-down overhead view showing the piece in daily life",
    },
    {
      id: "scale-human",
      name: "Scale with Person",
      icon: "\u{1F9CD}",
      prompt: "The furniture shown with a person interacting naturally — sitting, reaching, walking past — to demonstrate real-world scale and proportions, lifestyle interior photography",
      description: "Person interacting with furniture to show real-world scale",
    },
    {
      id: "catalog-angle",
      name: "Catalog 3/4 Angle",
      icon: "\u{1F4D0}",
      prompt: "Classic catalog three-quarter angle view, the furniture slightly rotated to show depth and form, clean gradient background, professional product photography with precise lighting",
      description: "Classic three-quarter angle showing depth and form",
    },
    {
      id: "seasonal-styled",
      name: "Seasonal Styling",
      icon: "\u{1F342}",
      prompt: "Seasonally styled room scene — spring flowers, summer breeze, autumn warmth, or winter coziness, the furniture dressed for the season with appropriate textiles and decor",
      description: "Room styled with seasonal decor and atmosphere",
    },
    {
      id: "outdoor-patio",
      name: "Outdoor / Patio",
      icon: "\u{1F333}",
      prompt: "Outdoor or patio setting — garden, terrace, or balcony with natural greenery and sky, the furniture in an alfresco dining or lounging arrangement, golden hour lighting",
      description: "Outdoor patio or garden setting with natural light",
    },
    {
      id: "window-light",
      name: "Window Light",
      icon: "\u2600\uFE0F",
      prompt: "Beautiful natural window light scene — the furniture bathed in soft directional sunlight, long shadows, dust particles in air, warm intimate atmosphere, architectural photography",
      description: "Natural window light with soft shadows and warm atmosphere",
    },
    {
      id: "dark-moody",
      name: "Dark & Moody",
      icon: "\u{1F30C}",
      prompt: "Dark, dramatic interior setting — deep wall colors, accent lighting, the furniture highlighted with a single directional light source, luxury editorial atmosphere",
      description: "Dark dramatic setting with accent lighting",
    },
    {
      id: "minimalist-space",
      name: "Minimalist Space",
      icon: "\u25FE",
      prompt: "Ultra-minimal interior — bare walls, concrete or wood floor, almost empty room with just the furniture piece, the simplicity emphasizing form and design, Japanese-inspired aesthetics",
      description: "Ultra-minimal space emphasizing pure form and design",
    },
  ],

  shotTypes: [],
  supportsConsistentModel: false,

  consistencyPrefix: "",

  sizeConfig: {
    label: "Dimensions (cm)",
    placeholder: "e.g. W120\u00D7D60\u00D7H75",
    getSizePrompt: getFurnitureSizePrompt,
  },

  defaultAspectRatio: "16:9",
  defaultVideoRatio: "16:9",
  defaultOutfit: "",

  socialPresets: SOCIAL_PRESETS,
};
