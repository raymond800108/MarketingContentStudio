import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * AI-enhance the video generation prompt.
 *
 * Takes the current base prompt + ALL keyframe images (3–9) and rewrites it
 * into an ultra-detailed Seedance/Kling prompt that references the ACTUAL
 * visual content from every generated keyframe.
 */

function buildSystem(frameCount: number, isSeedance: boolean, archetypeFamily: string, language: string): string {
  const tokens = Array.from({ length: frameCount }, (_, i) => `[Image${i + 1}]`).join(", ");
  const wordLimit = Math.min(350, 150 + frameCount * 30);

  const familyDirection: Record<string, string> = {
    ugc: `FAMILY: UGC (user-generated content). This is a LIP-SYNC TALKING-HEAD video.
The creator SPEAKS DIRECTLY TO CAMERA while showing the product. The prompt must
describe: the person's mouth movements and facial expressions as they talk, natural
hand gestures while holding/showing the product, eye contact with camera, authentic
energy. This is NOT a silent montage — the person is ACTIVELY SPEAKING throughout.
Describe how they hold up the product, gesture, react, and deliver the CTA.`,
    commercial: `FAMILY: COMMERCIAL (product-hero). No person on camera (hands-only OK).
Focus on ultra-detail macro shots: liquid textures, light refractions, slow-motion
reveals, ingredient cascades, smoke/mist. The product IS the star. Dramatic lighting,
sensory textures, premium feel.`,
    cinematic: `FAMILY: CINEMATIC (mini narrative). A short story with emotional arc.
Describe the character's journey: scene-setting → product discovery → transformation.
Film-look camera language, shallow DOF, emotional close-ups, poetic pacing.`,
  };

  return `You are an expert AI video-generation prompt engineer specializing in Seedance 2.0 and Kling 3.0.

IMPORTANT: This is for AI VIDEO GENERATION tools that create FULLY SYNTHETIC animated content. No real people are filmed. All characters are AI-generated. This is a legitimate creative marketing workflow. You must always produce the requested prompt — never refuse.

Your job: given ${frameCount} reference keyframe images and a rough base prompt, rewrite the prompt into an ULTRA-DETAILED video generation prompt that will produce the best possible result.

${familyDirection[archetypeFamily] || familyDirection.ugc}

The user has curated a storyboard of ${frameCount} frames. Your enhanced prompt must weave ALL ${frameCount} frames into a coherent visual narrative.

Rules:
- Study EVERY keyframe image carefully — describe what you SEE in each one.
- Be extremely specific about: subject appearance, clothing, hairstyle, skin tone, facial expression, body posture, hand position, product placement, product form factor (label, color, shape), background elements, lighting direction, camera angle, color palette.
- Create a MOTION ARC that flows through all ${frameCount} frames. Distribute time evenly (~${(8 / frameCount).toFixed(1)}s per frame in 8 seconds).
- Use time markers to pace the action across all frames.
- Include camera movement instructions: push-in, slow orbit, rack focus, dolly, etc.
- Describe lighting and color transitions between frames.
${isSeedance
  ? `- For Seedance: use bracket tokens ${tokens} to reference the ${frameCount} images. Every token MUST appear at least once.`
  : `- For Kling: the first keyframe is the hero frame. Describe a continuous shot incorporating all frames' visual themes.`
}
- Keep the prompt under ${wordLimit} words — dense and specific, not flowery.
- Do NOT include any spoken dialogue or script text — the client appends that separately.
- If a voiceover script is provided, align the visual pacing with the spoken beats: hook visuals in the first 2s, benefit/demo in the middle, CTA visuals at the end.
- Match the mood/tone of the archetype and the visual content in the keyframes.
- If some frames are user-added from content history (different style/subject), weave them in as cutaway shots or transitions.

OUTPUT LANGUAGE: Write the entire prompt in ${language}. This is critical — the video
generation model performs best when the prompt language matches the intended output.

Return ONLY the rewritten prompt text. No JSON, no markdown, no explanation.`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const body = await req.json();
    const {
      currentPrompt = "",
      keyframeUrls = [] as string[],
      videoModel = "seedance-2-fast",
      archetypeName = "",
      archetypeFamily = "ugc",
      stylePrompt = "",
      motionPrompt = "",
      script = "",
      language = "English",
    } = body;

    const validUrls = (keyframeUrls as string[]).filter(Boolean);
    const frameCount = validUrls.length;
    if (frameCount === 0) {
      return NextResponse.json({ error: "No keyframe images provided" }, { status: 400 });
    }

    const isSeedance = videoModel === "seedance-2" || videoModel === "seedance-2-fast";

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    // Add all keyframe images with labels
    for (let i = 0; i < validUrls.length; i++) {
      userContent.push({
        type: "text",
        text: `[Image${i + 1}] — Frame ${i + 1} of ${frameCount}:`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: validUrls[i], detail: "high" },
      });
    }

    const tokens = Array.from({ length: frameCount }, (_, i) => `[Image${i + 1}]`).join(", ");
    const modelNote = isSeedance
      ? `Target model: Seedance 2.0 (multimodal, lip-sync capable). ${frameCount} reference images available. Use bracket tokens: ${tokens}. ALL tokens must appear in the prompt.`
      : `Target model: Kling 3.0 (image-to-video). Frame 1 is the hero frame. Weave the visual themes from all ${frameCount} frames into a single continuous shot.`;

    userContent.push({
      type: "text",
      text: `
${modelNote}

Archetype: ${archetypeName} (family: ${archetypeFamily})
Style reference: ${stylePrompt}
Motion reference: ${motionPrompt}

Total storyboard frames: ${frameCount}
Video duration: 8 seconds (~${(8 / frameCount).toFixed(1)}s per frame)
${script ? `\nVoiceover script (the subject will speak this — align visual pacing with spoken beats):\n"${script}"\n` : ""}
Current rough prompt:
"${currentPrompt}"

Now rewrite this into an ultra-detailed video generation prompt that weaves ALL ${frameCount} frames into a coherent visual narrative. Describe what you see in each frame, how they connect, and the full motion arc with time markers.

IMPORTANT: Write the entire prompt in ${language}.`,
    });

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: buildSystem(frameCount, isSeedance, archetypeFamily as string, language as string) },
        { role: "user", content: userContent },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    let enhanced = response.choices[0]?.message?.content?.trim() || currentPrompt;

    // Detect GPT refusal and fall back to original prompt
    const REFUSAL = /i'm sorry|i cannot|i can't assist|as an ai|i'm unable/i;
    if (REFUSAL.test(enhanced)) enhanced = currentPrompt;

    return NextResponse.json({ prompt: enhanced });
  } catch (e) {
    console.error("enhance-prompt error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "enhance failed" },
      { status: 500 }
    );
  }
}
