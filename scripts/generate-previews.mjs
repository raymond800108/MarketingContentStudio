/**
 * Generate template preview images via the local Kie.ai API.
 * Usage: node scripts/generate-previews.mjs
 *
 * Requires the dev server running at localhost:3001.
 * Generates 576×384 JPG previews in public/templates/{profile}/{templateId}.jpg
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3001";
const OUT_DIR = path.join(__dirname, "..", "public", "templates");

// Simple preview prompts — no product image needed, just scene/environment
const TEMPLATES = {
  clothing: [
    { id: "airport-departure", prompt: "Fashion editorial photo, modern international airport terminal departure hall, natural light from glass ceiling, travelers with luggage, polished floor reflections, cinematic depth of field, no text" },
    { id: "airport-lounge", prompt: "Luxury first-class airport lounge interior, leather chairs, warm ambient lighting, floor-to-ceiling windows with runway view, elegant minimal decor, editorial interior photography, no text" },
    { id: "train-window", prompt: "Window seat inside a European high-speed train, passing countryside scenery through large window, soft natural light, cozy travel atmosphere, editorial photography, no text" },
    { id: "train-platform", prompt: "Grand European train station platform, vintage luggage on platform, steam and morning light, ornate iron roof architecture, cinematic travel photography, no text" },
    { id: "road-trip-car", prompt: "Interior of a premium car on scenic coastal highway, passenger seat view, leather interior, ocean views through windshield, golden hour light, lifestyle photography, no text" },
    { id: "road-trip-exterior", prompt: "Convertible car parked on cliffside scenic highway, ocean vista background, golden hour, travel adventure aesthetic, cinematic wide shot, no text" },
    { id: "hotel-arrival", prompt: "Boutique hotel lobby interior, elegant check-in desk, marble floors, warm lighting, designer luggage, luxury hospitality atmosphere, editorial interior photography, no text" },
    { id: "hotel-balcony", prompt: "Luxury hotel balcony view, ocean horizon at sunset, white curtains blowing in breeze, elegant railing, resort atmosphere, cinematic lifestyle photography, no text" },
    { id: "taxi-window", prompt: "Back seat of a yellow taxi at night in a city, neon lights reflecting on wet windows, bokeh city lights, cinematic urban night photography, no text" },
    { id: "street-cafe-travel", prompt: "European cobblestone street cafe, espresso and map on small round table, morning light, charming building facades, travel lifestyle photography, no text" },
    { id: "ugc-travel-selfie", prompt: "Candid travel selfie perspective, phone held at arm's length, famous landmark blurred in background, natural golden hour light, authentic UGC social media style, no text" },
  ],
  furniture: [
    { id: "living-room-carpet", prompt: "Modern living room interior, beautiful patterned area rug on hardwood floor, contemporary sofa and coffee table, natural window light, interior design magazine photography, no text" },
    { id: "bedroom-carpet", prompt: "Serene bedroom with soft carpet beside bed, bare feet stepping onto rug, neutral bedding, morning light, cozy lifestyle interior photography, no text" },
    { id: "hallway-runner", prompt: "Elegant hallway with runner carpet on wooden floor, framed art on walls, perspective view down long corridor, architectural interior photography, no text" },
    { id: "dining-room-carpet", prompt: "Dining room with area rug under dining table and chairs, pendant lighting above, warm atmosphere, editorial home interior photography, no text" },
    { id: "entryway-mat", prompt: "Stylish home entryway, welcome mat by front door, console table with plant, shoes neatly arranged, natural daylight, welcoming home photography, no text" },
    { id: "kids-playroom", prompt: "Bright cheerful playroom with colorful carpet on floor, children's toys and books scattered, soft natural light, family lifestyle photography, no text" },
    { id: "outdoor-patio-rug", prompt: "Sunny terrace with outdoor rug, wicker furniture, potted plants, garden greenery background, golden hour lifestyle photography, no text" },
    { id: "flat-lay-carpet", prompt: "Overhead flat-lay view of a beautiful patterned carpet, perfectly straight edges, full pattern visible, styled corner fold, clean catalog photography, no text" },
    { id: "detail-texture-carpet", prompt: "Extreme macro close-up of carpet weave and pile texture, fingers touching soft surface, individual fibers visible, studio-lit product macro photography, no text" },
    { id: "rolled-stack", prompt: "Multiple carpets rolled and stacked in showroom, cross-section showing thickness, one partially unrolled, professional trade catalog photography, no text" },
    { id: "window-light-carpet", prompt: "Carpet on wooden floor bathed in warm directional sunlight from window, long soft shadows, dust particles in air, intimate atmosphere photography, no text" },
    { id: "minimalist-carpet", prompt: "Ultra-minimal room, single carpet on pale floor, bare white walls, almost no furniture, Japanese-inspired minimalist interior photography, no text" },
  ],
  // jewelry skipped
};

const POLL_INTERVAL = 4000;
const MAX_POLLS = 60; // 4 min max per image

async function createTask(prompt) {
  const res = await fetch(`${BASE}/api/kie`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "image",
      prompt,
      aspect_ratio: "3:2",
      resolution: "1K",
      output_format: "jpg",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.taskId;
}

async function pollTask(taskId) {
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    const res = await fetch(`${BASE}/api/kie?taskId=${taskId}&type=image`);
    const data = await res.json();
    if (data.status === "success" && data.images?.length > 0) {
      return data.images[0].url;
    }
    if (data.status === "fail") throw new Error(data.error || "Generation failed");
    process.stdout.write(".");
  }
  throw new Error("Timeout");
}

async function downloadImage(url, outPath) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(outPath, buf);
}

async function main() {
  let total = 0;
  let done = 0;
  let skipped = 0;
  let failed = 0;

  // Count total
  for (const [profile, templates] of Object.entries(TEMPLATES)) {
    for (const t of templates) {
      const outPath = path.join(OUT_DIR, profile, `${t.id}.jpg`);
      if (fs.existsSync(outPath)) { skipped++; continue; }
      total++;
    }
  }

  console.log(`\n🎨 Generating ${total} preview images (${skipped} already exist)\n`);

  for (const [profile, templates] of Object.entries(TEMPLATES)) {
    const profileDir = path.join(OUT_DIR, profile);
    fs.mkdirSync(profileDir, { recursive: true });

    for (const t of templates) {
      const outPath = path.join(profileDir, `${t.id}.jpg`);
      if (fs.existsSync(outPath)) continue;

      process.stdout.write(`[${profile}/${t.id}] Creating task...`);
      try {
        const taskId = await createTask(t.prompt);
        process.stdout.write(` taskId=${taskId}, polling`);
        const imageUrl = await pollTask(taskId);
        process.stdout.write(" downloading...");
        await downloadImage(imageUrl, outPath);
        done++;
        console.log(` ✅ (${done}/${total})`);
      } catch (err) {
        failed++;
        console.log(` ❌ ${err.message}`);
      }
    }
  }

  console.log(`\n✅ Done! Generated: ${done}, Skipped: ${skipped}, Failed: ${failed}\n`);
}

main().catch(console.error);
