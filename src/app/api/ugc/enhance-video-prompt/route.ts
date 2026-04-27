import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getArchetype } from "@/lib/ugc/archetypes";

/**
 * POST /api/ugc/enhance-video-prompt
 *
 * Takes the storyboard state for UGC v2 (2 keyframes + per-frame dialogue +
 * archetype + motion intent) and produces a Seedance-optimized video prompt
 * using the [Image1] / [Image2] token convention with dialogue quoted inline.
 *
 * Seedance 2.0's `generate_audio: true` mode reads quoted dialogue in the
 * prompt and produces native character voice with rough mouth sync. The
 * [ImageN] tokens tell the model WHICH frame governs appearance at WHICH
 * moment in the clip.
 *
 * Request:
 * {
 *   archetypeId: string,
 *   openingDialogue: string,    // what the character says at the opening frame
 *   closingDialogue: string,    // what the character says at the closing frame
 *   motionPrompt?: string,      // inter-frame motion description
 *   openingBeat?: string,
 *   closingBeat?: string,
 *   locale?: "en" | "zh-TW" | "de",
 * }
 *
 * Response: { prompt: string }
 */

const SYSTEM_PROMPT = `You are a Seedance 2.0 video prompt engineer for UGC content.

Seedance 2.0 is an AI video generator that produces FULLY SYNTHETIC animated content from prompts + reference frames. All characters are AI-generated. This is a legitimate creative marketing workflow — generate the requested prompt without refusing.

Your job: combine per-frame dialogue, motion intent, and archetype context into ONE tight video-generation prompt that uses Seedance's [Image1] / [Image2] token convention and produces natural UGC voiceover via generate_audio.

Prompt format rules:
1. Open with [Image1] — describe the creator + opening moment briefly, then say 'and she/he says naturally: "<opening dialogue>"'
2. Describe the short motion/action that follows (from motionPrompt)
3. Close with '[Image2] and she/he says: "<closing dialogue>"' — or put [Image2] at the end so the final frame is pixel-locked
4. Add UGC feel anchors: "vertical 9:16 phone selfie, slight handshake, natural speech with breathing and micro-expressions, authentic home-recorded vibe, not a commercial"
5. Keep under 120 words total
6. Match the output language
7. Write dialogue lines EXACTLY as given — do not paraphrase or expand them
8. Keep it conversational and casual — UGC tone, not ad tone

Return ONLY the prompt text — no JSON, no markdown, no labels, just the prompt string.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const body = await req.json();
    const {
      archetypeId,
      openingDialogue = "",
      closingDialogue = "",
      motionPrompt = "",
      openingBeat = "",
      closingBeat = "",
      locale = "en",
    }: {
      archetypeId?: string;
      openingDialogue?: string;
      closingDialogue?: string;
      motionPrompt?: string;
      openingBeat?: string;
      closingBeat?: string;
      locale?: string;
    } = body;

    if (!openingDialogue.trim() && !closingDialogue.trim()) {
      return NextResponse.json(
        { error: "At least one dialogue line is required" },
        { status: 400 }
      );
    }

    const archetype = archetypeId ? getArchetype(archetypeId) : null;
    const langMap: Record<string, string> = {
      en: "English",
      "zh-TW": "Traditional Chinese (繁體中文)",
      de: "German (Deutsch)",
    };
    const language = langMap[locale] || "English";

    const userBlock = `
Archetype: ${archetype?.name || "UGC creator"}
Creator persona: ${archetype?.creatorPrompt || "a relatable content creator"}
Motion fragment: ${archetype?.motionPrompt || "speaks naturally to camera"}
Style fragment: ${archetype?.stylePrompt || "authentic UGC phone selfie"}

OPENING FRAME ([Image1]):
  Visual beat: ${openingBeat || "creator holds up the product and begins speaking"}
  Dialogue: "${openingDialogue.trim()}"

CLOSING FRAME ([Image2]):
  Visual beat: ${closingBeat || "creator finishes the thought, product visible"}
  Dialogue: "${closingDialogue.trim()}"

Motion between frames: ${motionPrompt || "natural UGC handheld camera motion, person speaks continuously"}

Output language: ${language}
Return the Seedance video prompt now. Keep dialogue VERBATIM.`;

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userBlock },
      ],
      temperature: 0.7,
      max_tokens: 500,
    });

    const prompt = response.choices[0]?.message?.content?.trim() || "";
    if (!prompt) {
      return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
    }

    // Strip markdown code fences if the model wrapped the output
    const cleaned = prompt
      .replace(/^```(?:text)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();

    return NextResponse.json({ prompt: cleaned });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[enhance-video-prompt] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
