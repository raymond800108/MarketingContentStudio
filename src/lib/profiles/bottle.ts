import type { ProductProfile } from "./types";
import { SOCIAL_PRESETS } from "./shared";

function getBottleSizePrompt(_productType: string, _placement: string, dimension: string): string {
  if (!dimension.trim()) return "";
  const raw = dimension.trim().toLowerCase();
  const nums = raw.match(/[\d.]+/g)?.map(Number).filter((n) => !isNaN(n));
  if (!nums || nums.length === 0) return "";
  const maxCm = Math.max(...nums);

  let desc = "";
  if (maxCm <= 5) desc = "a tiny sample or travel-size bottle — about the height of a thumb";
  else if (maxCm <= 10) desc = "a small bottle — roughly the size of a palm, typical for perfume or serum";
  else if (maxCm <= 20) desc = "a medium bottle — about the height of a hand span, typical for supplements or small drinks";
  else if (maxCm <= 35) desc = "a standard bottle — roughly the height of a forearm, typical for beverages or large supplements";
  else desc = "a large bottle — taller than a forearm, such as a wine bottle or large beverage";

  return (
    `CRITICAL SIZE RULE: The bottle/package is ${desc} (${raw} cm). ` +
    "Do NOT enlarge or exaggerate the product. It must appear at REALISTIC proportions relative to the scene and any human hands or body. " +
    "If anything, err on the side of making it slightly SMALLER rather than bigger. " +
    "The product should look like a real photograph — bottles and packages are always small relative to human scale. "
  );
}

export const bottle: ProductProfile = {
  id: "bottle",
  name: "Bottle & Packaging",
  icon: "\u{1F9F4}",
  description: "Perfume, supplements, drinks, serums — bottles and packaged products",

  analysisSystemPrompt: `You are a product packaging expert. Analyze the bottle or packaged product in this image and return JSON with these fields:
- type: the product type (perfume bottle, supplement bottle, beverage bottle, serum dropper, spray bottle, jar, can, tube, etc.)
- description: a concise description (shape, material, color, label design, cap style)
- body_placement: how it would be used or held (in hand, on vanity, on shelf, on table, etc.)
- materials: array of detected materials (glass, plastic, metal, ceramic, frosted glass, etc.)
- style: the brand style (luxury, minimalist, organic, clinical, artisanal, sporty, etc.)
- color: primary colors and finish (clear glass, matte black, rose gold cap, etc.)
Return ONLY valid JSON, no markdown.`,

  templates: [
    {
      id: "white-studio-bottle",
      name: "White Studio",
      icon: "\u2B1C",
      prompt: "Product centered on pure white seamless studio background, clean commercial lighting with soft reflections, the bottle sharp and hero-lit, professional e-commerce product photography",
      description: "Clean white studio backdrop for e-commerce catalog",
    },
    {
      id: "hero-pedestal",
      name: "Hero Pedestal",
      icon: "\u{1F3DB}\uFE0F",
      prompt: "The bottle placed on an elegant marble or stone pedestal, soft gradient background, dramatic rim lighting highlighting the silhouette and label, luxury product launch imagery",
      description: "Elegant pedestal with dramatic rim lighting",
    },
    {
      id: "detail-label",
      name: "Label Close-Up",
      icon: "\u{1F50D}",
      prompt: "Extreme macro close-up on the bottle label, cap detail, embossing, or texture, ultra-sharp focus with shallow depth of field, studio lighting revealing every surface detail",
      description: "Macro close-up on label, cap and surface details",
    },
    {
      id: "vanity-scene",
      name: "Vanity Scene",
      icon: "\u{1F484}",
      prompt: "The product on a luxury vanity or bathroom counter, marble surface, soft morning light from a window, alongside complementary beauty items, elegant editorial lifestyle photography",
      description: "Luxury vanity or bathroom counter with morning light",
      dynamic: true,
    },
    {
      id: "kitchen-counter",
      name: "Kitchen / Bar Counter",
      icon: "\u{1F374}",
      prompt: "The bottle on a stylish kitchen counter or bar surface, fresh ingredients or garnishes nearby, warm ambient lighting, lifestyle food and drink editorial photography",
      description: "Stylish kitchen or bar counter with fresh ingredients",
      dynamic: true,
    },
    {
      id: "outdoor-nature",
      name: "Outdoor Nature",
      icon: "\u{1F33F}",
      prompt: "The product placed on a natural surface — stone, moss, wood, or leaf bed — in soft dappled forest or garden light, organic and earthy contrast with the refined packaging, editorial nature photography",
      description: "Natural surface outdoors with soft dappled light",
    },
    {
      id: "gym-fitness",
      name: "Gym & Fitness",
      icon: "\u{1F4AA}",
      prompt: "The supplement or drink bottle in a modern gym or fitness studio setting, workout equipment blurred in background, energetic atmosphere, the product hero-lit on a bench or shelf, sporty lifestyle photography",
      description: "Modern gym or fitness setting with energetic vibe",
      dynamic: true,
    },
    {
      id: "travel-carry",
      name: "Travel Carry",
      icon: "\u{2708}\uFE0F",
      prompt: "The product peeking out of a travel bag, carry-on, or vanity pouch in a travel setting — airport, hotel room, or poolside — lifestyle travel photography with wanderlust mood",
      description: "Travel setting with product in bag or vanity pouch",
      dynamic: true,
    },
    {
      id: "water-splash",
      name: "Water Splash",
      icon: "\u{1F4A7}",
      prompt: "The bottle surrounded by dynamic water splash, droplets frozen mid-air, clean background, high-speed photography feel, freshness and purity concept, energetic product advertising",
      description: "Dynamic water splash with frozen droplets",
    },
    {
      id: "ingredient-flat-lay",
      name: "Ingredient Flat Lay",
      icon: "\u{1F33B}",
      prompt: "Top-down flat lay of the product surrounded by its key ingredients — herbs, flowers, fruits, seeds, or minerals — on a clean surface, styled arrangement, informative editorial photography",
      description: "Flat lay with key ingredients arranged around the product",
    },
    {
      id: "smoke-mood",
      name: "Smoke & Mood",
      icon: "\u{1F32B}\uFE0F",
      prompt: "The bottle emerging from atmospheric smoke or mist, moody colour-gel lighting in purple, teal, or amber tones, mysterious editorial atmosphere, high-fashion fragrance campaign style",
      description: "Atmospheric smoke with moody colour-gel lighting",
    },
    {
      id: "dark-luxury",
      name: "Dark Luxury",
      icon: "\u{1F311}",
      prompt: "Deep black backdrop, bold directional key light creating dramatic highlights on the bottle surface, crisp reflections, premium chiaroscuro look, luxury brand advertising",
      description: "Deep black backdrop with dramatic chiaroscuro lighting",
    },
    {
      id: "hand-held",
      name: "Hand-Held",
      icon: "\u{1F91A}",
      prompt: "A well-manicured hand elegantly holding the product, soft studio or lifestyle background, the bottle at realistic scale in the hand, editorial beauty or lifestyle photography",
      description: "Elegant hand holding the product at realistic scale",
      dynamic: true,
    },
    {
      id: "unboxing",
      name: "Unboxing",
      icon: "\u{1F381}",
      prompt: "The product nestled inside its premium packaging or gift box, tissue paper and branded elements visible, the reveal moment, warm soft lighting, luxury unboxing experience photography",
      description: "Premium unboxing reveal with branded packaging",
    },
    {
      id: "collagen-pour",
      name: "Liquid Pour",
      icon: "\u{1F4A7}",
      prompt:
        "Ultra-detailed macro shot of shimmering golden collagen liquid being poured out of the bottle in slow motion, viscous luminous liquid catching studio light, individual light refractions and caustics visible in the stream, glistening droplets suspended mid-air, rich golden-amber translucent color, hyper-realistic texture showing the thick glossy consistency, dark moody background with dramatic rim lighting to emphasize the liquid's radiant glow, 8K product photography, shallow depth of field with the pour stream in razor-sharp focus",
      description: "Dramatic pour shot highlighting shimmering collagen liquid",
    },
  ],

  shotTypes: [],
  supportsConsistentModel: false,

  consistencyPrefix: "",

  sizeConfig: {
    label: "studio.sizeLabel.bottle",
    placeholder: "studio.sizePlaceholder.bottle",
    getSizePrompt: getBottleSizePrompt,
  },

  defaultAspectRatio: "3:4",
  defaultVideoRatio: "16:9",
  defaultOutfit: "",

  socialPresets: SOCIAL_PRESETS,
};
