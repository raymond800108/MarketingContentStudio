import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { ARCHETYPES } from "@/lib/ugc/archetypes";

/**
 * /api/magic/run — the deterministic "viral formula" pipeline.
 *
 * Input:  { productImageUrl, text }
 * Output: { inference: { family, category, archetypeId, hookLine, audience,
 *                        benefit, clipLength } }
 *
 * Steps (Content Creator agent's hardcoded chain, Sprint 1 condensed
 * into a single GPT-4o vision + reasoning call to keep latency under 15s):
 *
 *   Step 1 — GPT-4o vision: extract product_facts (category, packaging, palette).
 *   Step 2 — GPT-4o-mini: parse user intent_text.
 *   Step 3 — Deterministic: category → visual vocab + physics rules (downstream).
 *   Step 4 — GPT-4o-mini: rank top-3 archetypes; pick best.
 *   Step 5 — Deterministic: scene/demographic locks (handled inside /api/ugc/brief).
 *   Step 6 — GPT-4o-mini: pick hook line from 12-cat library.
 *
 * Sprint 1 design choice: collapse steps 1, 2, 4, 6 into ONE structured
 * GPT-4o call with the product image and the user text both in the prompt.
 * This is faster (one round-trip vs four), cheaper, and easier to constrain
 * to the actual archetype IDs we have. Splitting into a 14-step chain is
 * Sprint 2 work once /campaign-plan and /storyboard-generator are wired.
 *
 * Reliability rule (vision truth table — Content Creator):
 *   - Trust:  category, packaging, colors, finish, text, scale
 *   - Confirm with confidence ≥ 0.75: material, price tier, archetype
 *   - Never invent: ingredients, age, country, actual price, taste
 *
 * Returns 500 on any LLM/vision failure rather than fallback inferences —
 * the magic flow MUST work or the user gets bounced to manual /ugc.
 */

export const maxDuration = 30;

interface MagicInferenceResponse {
  family: "ugc" | "commercial";
  category: string;
  archetypeId: string;
  hookLine: string;
  audience: string;
  benefit: string;
  clipLength: 5 | 10;
}

// Build a compact archetype catalogue the LLM can rank against. Each entry
// gives id + family + name + a one-sentence essence so the model can match
// product + user intent → best fit without bloating the prompt.
function buildArchetypeCatalog(): string {
  return ARCHETYPES.filter((a) => a.family !== "cinematic")
    .map(
      (a) =>
        `- ${a.id} | ${a.family} | ${a.name}: ${a.description}`
    )
    .join("\n");
}

const CATEGORY_OPTIONS = [
  "skincare",
  "wellness",
  "fragrance",
  "food_beverage",
  "fashion",
  "tech",
  "home",
  "generic",
] as const;

const SYSTEM_PROMPT = `You are the creative-director-in-a-box for a high-conversion DTC video-ad tool.

You receive a PRODUCT IMAGE and a SHORT USER BRIEF (audience + benefit hint, 0–200 chars).
Output a single JSON object naming the entire creative direction for a 5–10s vertical video ad.

DECISION RULES:

1. FAMILY ("ugc" vs "commercial"):
   - UGC if: price < ~$80, trust-transfer category (skincare / supplements / apparel / food / pet), creator-led benefit ("makes me feel"), or user explicitly mentions a creator/persona.
   - Commercial if: price ≥ ~$80, visually-self-evident category (jewelry / fragrance / furniture / tech / beverage), brand-driven, objective benefit (design / craft / ingredient).
   - When ambiguous, prefer UGC (broader top-of-funnel performance for early brands).

2. CATEGORY: pick exactly one of: skincare, wellness, fragrance, food_beverage, fashion, tech, home, generic. Look at the product image — packaging form factor wins over the user text.

3. ARCHETYPE: pick exactly ONE id from the ARCHETYPE CATALOGUE below. The id MUST match a row verbatim. The archetype's family MUST match your "family" choice. Match the archetype's persona / setting to (a) the product's apparent context and (b) the user's audience hint.

4. HOOK LINE: write a single 5–10 word opener line for the spoken / on-screen hook. Use the WINNING 2026 PATTERNS:
   - POV-Problem-Snap ("POV: I keep buying [problem] until—")
   - Stat-Slap ("97% of [audience] don't know")
   - Forbidden-Comparison ("Why I stopped buying [category leader]")
   - Reverse-Demo ("This is why my [outcome]—")
   - Confession ("I was skeptical about another [category] but—")
   Avoid 2024 dead patterns: "POV: you just discovered…", generic "obsessed with this".

5. AUDIENCE: 4–10 words describing who buys this. If the user provided a hint, refine it to be specific. If not, infer from packaging cues + category.

6. BENEFIT: 4–10 words naming the felt outcome of using this product. Specific over vague ("hydrated by 2pm" beats "moisturizes all day"). Use the user's benefit hint if provided.

7. CLIP LENGTH: 5 if the product reads as a single beat (single hero, single CTA — most cases). 10 if the product needs a story arc (problem → use → result, transformation, before/after). Default 5.

VISION TRUTH RULES:
   - Trust the image for: category, packaging type, colors, finish, visible text, scale.
   - Do NOT invent: ingredients, country of origin, actual price, taste/scent, ratings.
   - Be honest about confidence — if the image is ambiguous, default to "generic" category and a UGC archetype.

Return STRICT JSON ONLY, no prose, no markdown:
{
  "family": "ugc" | "commercial",
  "category": one of the CATEGORY OPTIONS,
  "archetypeId": "exact id from the catalogue",
  "hookLine": "5-10 word hook",
  "audience": "4-10 word audience description",
  "benefit": "4-10 word felt-benefit description",
  "clipLength": 5 | 10
}`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { productImageUrl, text, familyOverride } = await req.json();
    if (!productImageUrl) {
      return NextResponse.json(
        { error: "productImageUrl is required" },
        { status: 400 }
      );
    }

    const userText = (text || "").toString().trim().slice(0, 400);
    // If the user explicitly chose a family on the LP, skip the LLM's family
    // decision and inject it directly into the system prompt as a hard override.
    const forcedFamily: "ugc" | "commercial" | null =
      familyOverride === "ugc" ? "ugc"
      : familyOverride === "commercial" ? "commercial"
      : null;
    const archetypeCatalog = buildArchetypeCatalog();

    const openai = new OpenAI({ apiKey });
    const familyInstruction = forcedFamily
      ? `\n\nUSER OVERRIDE — FAMILY IS LOCKED TO "${forcedFamily.toUpperCase()}". You MUST set "family": "${forcedFamily}" in your JSON. Pick an archetype whose family matches "${forcedFamily}" — do NOT pick archetypes from the other family.`
      : "";
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT + familyInstruction },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: productImageUrl, detail: "high" },
            },
            {
              type: "text",
              text: `USER BRIEF: ${userText || "(none — infer from image)"}${forcedFamily ? `\nUSER-SELECTED STYLE: ${forcedFamily.toUpperCase()} (locked)` : ""}\n\nARCHETYPE CATALOGUE (id | family | name: description):\n${archetypeCatalog}\n\nReturn the JSON now.`,
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.4,
      max_tokens: 600,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: Partial<MagicInferenceResponse>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Magic returned invalid JSON", raw },
        { status: 502 }
      );
    }

    // ── Validate + sanitize ──
    // If the user picked a family explicitly, that overrides the LLM's choice.
    const family: "ugc" | "commercial" = forcedFamily
      ? forcedFamily
      : parsed.family === "commercial" ? "commercial" : "ugc";
    const category = (CATEGORY_OPTIONS as readonly string[]).includes(
      parsed.category as string
    )
      ? (parsed.category as string)
      : "generic";

    // archetypeId MUST exist in the catalogue and match family. If not, fall
    // back to the first archetype of that family.
    const validIds = new Set(
      ARCHETYPES.filter((a) => a.family === family).map((a) => a.id)
    );
    const archetypeId =
      parsed.archetypeId && validIds.has(parsed.archetypeId)
        ? parsed.archetypeId
        : ARCHETYPES.find((a) => a.family === family)?.id || "ugc-busy-professional";

    const clipLength = parsed.clipLength === 10 ? 10 : 5;

    const inference: MagicInferenceResponse = {
      family,
      category,
      archetypeId,
      hookLine: String(parsed.hookLine || "").slice(0, 140),
      audience: String(parsed.audience || "").slice(0, 80),
      benefit: String(parsed.benefit || "").slice(0, 80),
      clipLength,
    };

    return NextResponse.json({ inference });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[magic/run] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
