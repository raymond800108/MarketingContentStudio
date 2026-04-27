import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * POST /api/images/suggest-overlay
 * Body: { image_url: string, locale?: "en" | "zh-TW" | "de" }
 * Returns: { suggestions: string[] } — 3 short, catchy commercial slogans
 *
 * Uses GPT-4o vision to look at the image and propose editorial ad slogans
 * suitable as text overlays for a premium social-media ad.
 */

const SYSTEM_PROMPT = `You are a world-class brand copywriter for high-end editorial and luxury advertising (Vogue, Aesop, Chanel, Harper's Bazaar campaigns).

Given a product/scene image, propose 3 DIFFERENT short commercial slogans that would work as editorial ad headline overlays.

Rules for each slogan:
- 2 to 5 words
- Evocative, aspirational, editorial — not cheesy or sales-y
- Sound like a premium print-magazine ad masthead
- No hashtags, no emojis, no quotation marks
- Keep it punchy and poetic; use rhythm and contrast
- Each suggestion should hit a different angle (e.g. sensory, aspirational, benefit-focused)

Output: return a pure JSON array of 3 strings, nothing else. Example: ["Quiet Power.", "Beauty in Action", "Made for Mornings"]`;

const LANG_MAP: Record<string, string> = {
  en: "English",
  "zh-TW": "Traditional Chinese (繁體中文)",
  de: "German (Deutsch)",
};

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { image_url, locale } = await req.json();
    if (!image_url) {
      return NextResponse.json({ error: "image_url is required" }, { status: 400 });
    }

    const language = LANG_MAP[locale as string] || "English";

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0.9,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: image_url },
            },
            {
              type: "text",
              text: `Write the slogans in ${language}. Return ONLY the JSON array of 3 strings.`,
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim() || "[]";
    // Strip ``` fences if the model wrapped output in markdown
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

    let suggestions: string[] = [];
    try {
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        suggestions = parsed
          .filter((s): s is string => typeof s === "string")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
          .slice(0, 5);
      }
    } catch {
      // Fallback: split by newlines / bullets if JSON parsing fails
      suggestions = cleaned
        .split(/\n/)
        .map((line) => line.replace(/^[-*•\d.)\s"]+|["']+$/g, "").trim())
        .filter((line) => line.length > 0 && line.length < 80)
        .slice(0, 3);
    }

    if (suggestions.length === 0) {
      return NextResponse.json(
        { error: "Could not parse suggestions", raw },
        { status: 502 }
      );
    }

    return NextResponse.json({ suggestions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[suggest-overlay] error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
