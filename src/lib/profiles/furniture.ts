import type { ProductProfile } from "./types";
import { SOCIAL_PRESETS } from "./shared";

function getCarpetSizePrompt(_productType: string, _placement: string, dimension: string): string {
  if (!dimension.trim()) return "";
  const raw = dimension.trim().toLowerCase();
  const nums = raw.match(/[\d.]+/g)?.map(Number).filter((n) => !isNaN(n));
  if (!nums || nums.length === 0) return "";

  let scaleRef = "";
  if (nums.length >= 2) {
    const [a, b] = [Math.min(...nums), Math.max(...nums)];
    if (b <= 100) scaleRef = `a small accent rug (${a}×${b} cm) — doormat or bedside size`;
    else if (b <= 200) scaleRef = `a medium area rug (${a}×${b} cm) — fits under a coffee table or in a hallway`;
    else scaleRef = `a large area rug (${a}×${b} cm) — anchors a full living room or dining set`;
  } else {
    const d = nums[0];
    if (d <= 100) scaleRef = `a small rug (~${d} cm) — accent or doormat size`;
    else if (d <= 200) scaleRef = `a medium rug (~${d} cm) — hallway or bedside runner`;
    else scaleRef = `a large rug (~${d} cm) — full room area rug`;
  }

  return (
    `CRITICAL SCALE RULE: This carpet/rug is ${scaleRef} (dimensions: ${raw} cm). ` +
    "Render it flat on the floor at REALISTIC room scale — proportional to the furniture, walls, and room size visible in the scene. " +
    "Show the carpet's full pattern, texture and edges clearly. "
  );
}

export const furniture: ProductProfile = {
  id: "furniture",
  name: "Carpet & Home",
  icon: "\u{1F9F6}",
  description: "Rugs, carpets, runners, mats — carpet and home textiles",

  analysisSystemPrompt: `You are a carpet and home textiles expert. Analyze the carpet/rug in this image and return JSON with these fields:
- type: the carpet type (area rug, runner, doormat, accent rug, wall-to-wall, kilim, shag, Persian, etc.)
- description: a concise description (pattern, color palette, weave style, notable features)
- body_placement: where it goes in a home (living room floor, hallway, bedroom, entryway, dining room, etc.)
- materials: array of detected materials (wool, silk, cotton, jute, polyester, nylon, viscose, etc.)
- style: the design style (traditional, modern, bohemian, minimalist, Moroccan, Persian, Scandinavian, etc.)
- color: primary colors and pattern type (navy geometric, cream floral, multicolor kilim, etc.)
Return ONLY valid JSON, no markdown.`,

  templates: [
    // ── Carpet-focused room scenes ─────────────────────────────────
    {
      id: "living-room-carpet",
      name: "Living Room Floor",
      icon: "\u{1F6CB}\uFE0F",
      prompt: "The carpet laid flat on a polished hardwood floor in a contemporary living room, a modern sofa and coffee table partially resting on it, the carpet's full pattern and texture are the hero of the shot, warm natural light from floor-to-ceiling windows, interior design magazine quality photography",
      description: "Carpet as the centrepiece of a modern living room",
      dynamic: true,
    },
    {
      id: "bedroom-carpet",
      name: "Bedroom Setting",
      icon: "\u{1F6CF}\uFE0F",
      prompt: "The carpet placed beside or under a stylish bed in a serene bedroom, bare feet stepping onto it to emphasise softness, neutral bedding and nightstand, soft morning light, the carpet's pattern and pile texture clearly visible, cosy lifestyle photography",
      description: "Soft carpet beside a bed with cosy morning light",
      dynamic: true,
    },
    {
      id: "hallway-runner",
      name: "Hallway Runner",
      icon: "\u{1F6AA}",
      prompt: "A long runner carpet stretching through an elegant hallway, wooden floor visible on both sides, framed art on the walls, perspective shot drawing the eye along the full length and pattern of the runner, architectural interior photography",
      description: "Runner carpet in an elegant hallway with perspective",
      dynamic: true,
    },
    {
      id: "dining-room-carpet",
      name: "Dining Room",
      icon: "\u{1F37D}\uFE0F",
      prompt: "The carpet anchoring a dining table and chairs on a clean floor, place settings and a centrepiece on the table, the rug's border and pattern clearly shown, warm pendant lighting overhead, editorial home photography",
      description: "Carpet anchoring a dining set with warm overhead light",
      dynamic: true,
    },
    {
      id: "entryway-mat",
      name: "Entryway Welcome",
      icon: "\u{1F3E0}",
      prompt: "The carpet or mat placed at a stylish entryway, front door partially visible, shoes neatly arranged beside it, console table with keys and a plant, welcoming atmosphere, natural daylight from the doorway highlighting the carpet's texture",
      description: "Welcoming entryway mat by the front door",
      dynamic: true,
    },
    {
      id: "kids-playroom",
      name: "Kids Playroom",
      icon: "\u{1F9F8}",
      prompt: "The carpet spread on the floor of a bright, cheerful playroom, children's toys and books around, soft natural light, the colourful pattern of the carpet inviting play, safe and cosy family lifestyle photography",
      description: "Bright playroom floor with toys and cheerful vibe",
      dynamic: true,
    },
    {
      id: "outdoor-patio-rug",
      name: "Outdoor Patio Rug",
      icon: "\u{1F333}",
      prompt: "An outdoor-rated rug on a sunny terrace or patio, wicker furniture and potted plants nearby, garden greenery in the background, the rug's weather-resistant weave and pattern clearly visible, golden hour lifestyle photography",
      description: "Outdoor rug on a sunny patio with garden views",
      dynamic: true,
    },
    {
      id: "flat-lay-carpet",
      name: "Flat Lay",
      icon: "\u{1F4F7}",
      prompt: "Top-down overhead flat-lay of the carpet on a clean surface, perfectly straight edges, full pattern visible, a styled corner fold revealing the backing, a pair of slippers or a cup of tea placed on it for scale, clean catalog photography",
      description: "Overhead flat-lay showing full pattern and texture",
    },
    {
      id: "detail-texture-carpet",
      name: "Texture Close-Up",
      icon: "\u{1F50D}",
      prompt: "Extreme macro close-up of the carpet's weave, pile, or knot structure, fingers gently touching the surface to show softness and depth, individual fibres and colour gradients visible, studio-lit product macro photography",
      description: "Macro close-up on weave, pile and fibre detail",
    },
    {
      id: "rolled-stack",
      name: "Rolled / Stacked",
      icon: "\u{1F4E6}",
      prompt: "Multiple carpets rolled and stacked elegantly in a showroom or warehouse setting, cross-section showing thickness and density, a partially unrolled carpet in front revealing its pattern, professional trade catalog photography",
      description: "Rolled carpets stacked showing thickness and variety",
    },
    {
      id: "window-light-carpet",
      name: "Window Light",
      icon: "\u2600\uFE0F",
      prompt: "The carpet on a wooden floor bathed in beautiful directional sunlight from a nearby window, long soft shadows, dust particles in the air, the sunlight highlighting the carpet's colour and texture, warm intimate atmosphere",
      description: "Natural window light highlighting colour and texture",
      dynamic: true,
    },
    {
      id: "minimalist-carpet",
      name: "Minimalist Space",
      icon: "\u25FE",
      prompt: "The carpet as the sole design element in an ultra-minimal room — bare white walls, polished concrete or pale wood floor, almost no furniture, the simplicity drawing all attention to the carpet's pattern and craftsmanship, Japanese-inspired aesthetics",
      description: "Ultra-minimal room with carpet as the only focal point",
      dynamic: true,
    },
  ],

  shotTypes: [],
  supportsConsistentModel: false,

  consistencyPrefix: "",

  sizeConfig: {
    label: "studio.sizeLabel.carpet",
    placeholder: "studio.sizePlaceholder.carpet",
    getSizePrompt: getCarpetSizePrompt,
  },

  defaultAspectRatio: "16:9",
  defaultVideoRatio: "16:9",
  defaultOutfit: "",

  socialPresets: SOCIAL_PRESETS,
};
