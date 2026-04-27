import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getProfile } from "@/lib/profiles";

const DEFAULT_SYSTEM_PROMPT = `You are a product expert. Analyze the product in this image and return JSON with these fields:
- type: the product type
- description: a concise description of the product
- body_placement: where/how it is used or worn (if applicable)
- materials: array of detected materials
- style: the style category
Return ONLY valid JSON, no markdown.`;

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 500 }
      );
    }

    const { image_url, profileId } = await req.json();

    if (!image_url) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }

    // Get profile-specific analysis prompt
    const profile = profileId ? getProfile(profileId) : undefined;
    const systemPrompt = profile?.analysisSystemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Download the image and convert to base64 data URL so OpenAI doesn't
    // need to fetch from fal.media (temp URLs can expire / return 400).
    let imagePayload: string = image_url;
    try {
      const imgRes = await fetch(image_url);
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer());
        const contentType = imgRes.headers.get("content-type") || "image/png";
        imagePayload = `data:${contentType};base64,${buf.toString("base64")}`;
      } else {
        console.warn("[analyze-product] Could not download image, falling back to URL reference:", imgRes.status);
      }
    } catch (dlErr) {
      console.warn("[analyze-product] Image download failed, falling back to URL reference:", dlErr);
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imagePayload, detail: "high" },
            },
            {
              type: "text",
              text: "Analyze this product image. Return ONLY valid JSON.",
            },
          ],
        },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content || "{}";

    // Parse JSON from response (strip markdown fences if present)
    let parsed;
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      parsed = { type: "unknown", description: raw, body_placement: "on the body", materials: [], style: "unknown" };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[analyze-product] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
