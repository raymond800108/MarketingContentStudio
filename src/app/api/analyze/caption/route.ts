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

const VIDEO_SYSTEM_PROMPT = `You are a world-class social media copywriter for product brands. Write a short, engaging social media caption for a video post showcasing a product.

Rules:
- Keep it under 150 characters (not counting hashtags)
- Be punchy, aspirational, and scroll-stopping
- Use dynamic language that suits video content (e.g. "Watch", "See it move", "In motion")
- Include a clear call-to-action or hook when it fits naturally
- Add 3-5 relevant hashtags at the end
- If a platform is specified, tailor the tone: Instagram Reels = visual/aspirational, TikTok = casual/trendy, LinkedIn = professional/value-driven, Twitter = witty/concise
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

    const { image_url, platform, locale, prompt_context, media_type } = await req.json();

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

    const isVideo = media_type === "video";
    const openai = new OpenAI({ apiKey });

    // Build messages based on available inputs
    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    if (image_url) {
      userContent.push({
        type: "image_url",
        image_url: { url: image_url, detail: "low" },
      });
    }

    if (isVideo && image_url) {
      userContent.push({
        type: "text",
        text: `This is a source image from a product video. Write an engaging social caption for the video post.${
          prompt_context ? ` The video shows: ${prompt_context.substring(0, 200)}` : ""
        }${platformHint}${langHint}`,
      });
    } else if (isVideo) {
      // Text-only mode for video (no source image available)
      const videoDesc = prompt_context
        ? ` The video shows: ${prompt_context.substring(0, 200)}`
        : " The video showcases a fashion/product in motion.";
      userContent.push({
        type: "text",
        text: `Write an engaging social caption for a product video post.${videoDesc}${platformHint}${langHint}`,
      });
    } else if (image_url) {
      userContent.push({
        type: "text",
        text: `Write an engaging social caption for this product image.${platformHint}${langHint}`,
      });
    } else {
      // Fallback: no image, no video — generic product caption
      const desc = prompt_context
        ? ` About: ${prompt_context.substring(0, 200)}`
        : "";
      userContent.push({
        type: "text",
        text: `Write an engaging social caption for a product post.${desc}${platformHint}${langHint}`,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: isVideo ? VIDEO_SYSTEM_PROMPT : SYSTEM_PROMPT },
        { role: "user", content: userContent },
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
