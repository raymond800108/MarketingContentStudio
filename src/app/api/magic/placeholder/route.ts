import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * /api/magic/placeholder — generates a tailored placeholder for the
 * landing-page text field based on the just-uploaded product photo.
 *
 * Goal: replace the static placeholder ("Describe your product...") with
 * a sentence the user can either tap-to-accept or quickly edit. This is
 * the ElevenLabs / Sora "smart input" pattern that lifts conversion ~22%
 * by removing the cold-start blank-page friction.
 *
 * We use gpt-4o-mini (cheap, fast — typical 600-1200ms) since the output
 * is exactly one short sentence and the visual analysis is shallow.
 */

export const maxDuration = 15;

const SYSTEM_PROMPT = `You write the smart placeholder text for a one-input-field DTC ad generator.

You receive a PRODUCT IMAGE. Return ONE sentence (≤25 words) that the user could click into and lightly edit, describing:
  - who the realistic customer for this product is, and
  - the felt benefit they'd buy it for

Style rules:
  - Speak like a marketer brainstorming, not a machine
  - Use specific audience descriptors (not "people")
  - Specific outcome (not "better skin")
  - No emojis, no quote marks, no preamble like "Here's a placeholder"
  - One sentence, no period at the end

Examples (don't reuse, just match the cadence):
  - Skincare serum (woman in 30s photo): "Women in their 30s who want clinic-level glow without the dermatologist bill"
  - Energy drink (vibrant can): "Late-night gamers who hit 2am with a clear head and zero crash"
  - Leather bag (clean studio shot): "Founders moving from laptop bag to forever-bag the day they hit profit"

Return JSON: { "suggestion": "..." }`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Non-fatal — landing page will fall back to its static placeholder.
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }
    const { productImageUrl } = await req.json();
    if (!productImageUrl) {
      return NextResponse.json(
        { error: "productImageUrl is required" },
        { status: 400 }
      );
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: productImageUrl, detail: "low" },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.7,
      max_tokens: 120,
    });

    const raw = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: { suggestion?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ suggestion: "" });
    }

    return NextResponse.json({
      suggestion: String(parsed.suggestion || "").slice(0, 200),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[magic/placeholder] Error:", message);
    // Non-fatal — return empty so the LP falls back gracefully.
    return NextResponse.json({ suggestion: "", error: message });
  }
}
