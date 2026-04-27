import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const SYSTEM_PROMPT = `You are an expert AI video prompt engineer for Kling AI (a text-to-video / image-to-video model). The user will give you a short, high-level idea for a product video. You must expand it into a detailed, cinematic prompt that Kling understands well.

Rules:
- Output ONLY the refined prompt text, nothing else.
- Keep it under 300 words.
- Describe camera movement explicitly (slow dolly, orbit, push-in, pull-out, tracking shot, etc.).
- Describe lighting (golden hour, soft diffused, dramatic rim light, studio, natural, etc.).
- Describe the environment and atmosphere in vivid detail.
- Mention motion of the subject (model walking, fabric flowing, product rotating, etc.).
- Use cinematic language: depth of field, bokeh, lens flare, slow motion, etc.
- The video will be generated from a reference image, so the prompt should complement the product shown in that image.
- Do NOT include technical parameters like resolution or aspect ratio.
- Do NOT wrap in quotes or add any prefixes.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const { idea, imageUrl } = await req.json();

    if (!idea || !idea.trim()) {
      return NextResponse.json({ error: "idea is required" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // If we have an image URL, include it so GPT can see the product
    if (imageUrl) {
      messages.push({
        role: "user",
        content: [
          { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
          { type: "text", text: `Product reference image above. User's video idea: "${idea}"\n\nExpand this into a detailed cinematic video prompt for Kling AI.` },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: `User's video idea: "${idea}"\n\nExpand this into a detailed cinematic video prompt for Kling AI.`,
      });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const refined = response.choices[0]?.message?.content?.trim() || idea;

    return NextResponse.json({ prompt: refined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[refine-video-prompt] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
