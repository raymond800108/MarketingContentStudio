import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are a world-class social media copywriter for product brands. Given an image of a product or product scene, write a short, engaging social media caption.

Rules:
- Keep it under 150 characters (not counting hashtags)
- Be punchy, aspirational, and scroll-stopping
- Match the mood of the image (luxurious, playful, cozy, bold, etc.)
- Include a clear call-to-action or hook when it fits naturally
- Add 3-5 relevant hashtags at the end
- If a platform is specified, tailor the tone: Instagram = visual/aspirational, TikTok = casual/trendy, LinkedIn = professional/value-driven, Twitter = witty/concise, Pinterest = descriptive/inspiring
- Do NOT wrap in quotes
- Return ONLY the caption text with hashtags, nothing else`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { image_url, platform, locale } = await req.json();

    if (!image_url) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }

    const platformHint = platform
      ? `\n\nTarget platform: ${platform}. Tailor the tone accordingly.`
      : "";

    const langMap: Record<string, string> = {
      en: "English",
      "zh-TW": "Traditional Chinese (繁體中文)",
      de: "German (Deutsch)",
    };
    const language = langMap[locale] || "English";
    const langHint = `\n\nIMPORTANT: Write the entire caption and hashtags in ${language}.`;

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: image_url, detail: "low" },
            },
            {
              type: "text",
              text: `Write an engaging social caption for this product image.${platformHint}${langHint}`,
            },
          ],
        },
      ],
      max_tokens: 300,
      temperature: 0.8,
    });

    const caption = response.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({ caption });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[analyze-caption] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
