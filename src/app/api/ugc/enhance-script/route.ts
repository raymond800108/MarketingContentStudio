import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * AI-enhance a marketing angle's fullScript.
 *
 * Takes the 4 beats (hook, benefit, problemSolve, cta), current script,
 * keyframe images, and archetype info — then rewrites the script into a
 * natural, emotionally rich voiceover that sounds like a real person.
 */

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const body = await req.json();
    const {
      hook = "",
      benefit = "",
      problemSolve = "",
      cta = "",
      currentScript = "",
      keyframeUrls = [] as string[],
      archetypeName = "",
      archetypeFamily = "ugc",
      voiceTone = "",
      language = "English",
      videoPrompt = "",
    } = body;

    const validUrls = (keyframeUrls as string[]).filter(Boolean);

    // Build family-specific tone direction
    const toneDirection: Record<string, string> = {
      ugc: `Voice: a REAL PERSON talking to camera. Best-friend energy — like a voice note
or coffee chat. Loose, warm, slightly messy, human. Use fillers ("honestly",
"like", "I swear"), false starts, self-interruptions. It should feel UNSCRIPTED.
Think: "omg you need to hear this" energy.`,
      commercial: `Voice: a BRAND NARRATOR — confident, polished, evocative. Short poetic
sentences. Sensory language (textures, light, warmth). Rhythm matters — read it
aloud and it should FLOW. Not chatty, not corporate. Think: premium ad voiceover
that gives you chills.`,
      cinematic: `Voice: an INTIMATE STORYTELLER — first person, reflective, emotionally honest.
Like a personal essay or indie film monologue. Build a tiny emotional arc in
the delivery. Use pauses (em-dashes, ellipses) for breath and drama. The product
appears naturally within a genuine human moment.`,
    };

    const systemPrompt = `You are a script doctor for short-form video voiceovers. Your job is to take
a structured marketing brief (hook, benefit, problem-solve, CTA) and the current
flat script, then rewrite it into a script that sounds like a REAL HUMAN speaking.

${toneDirection[archetypeFamily] || toneDirection.ugc}

Archetype: ${archetypeName} (${archetypeFamily})
Voice tone: ${voiceTone}
${videoPrompt ? `\nVideo prompt (the visual direction — your script should complement these visuals):\n"${videoPrompt}"\n` : ""}

The 4 beats to weave in:
  HOOK: ${hook}
  BENEFIT: ${benefit}
  SOLVES: ${problemSolve}
  CTA: ${cta}

Current script (too flat/concise):
"${currentScript}"

Rules:
- Rewrite into 25–40 words (10–15 seconds at natural speaking pace)
- Weave ALL 4 beats into ONE flowing paragraph — no labels, no sections
- Add emotional texture: micro-reactions, breath moments, tonal shifts
- The hook should GRAB — the benefit should LAND — the CTA should feel URGENT but natural
- ${archetypeFamily === "ugc" ? "Sound like you're telling your best friend, not reading a script" : archetypeFamily === "commercial" ? "Sound like a premium brand film, every word intentional" : "Sound like a personal story being told for the first time"}
- Study the keyframe images — match the visual mood, setting, and action you see
- If a video prompt is provided, align the spoken beats with the visual pacing:
  e.g. if the video shows a pour at 2s, the script should hit the benefit around then
- Output language: ${language}
${language.includes("Chinese") || language.includes("繁體") ? `
- 繁體中文規則: 口語化, 像真人在講話. 用 "欸", "真的", "我跟你講", "超",
  "不誇張", "說實話" 這類口語. 不要書面語, 不要廣告腔.` : ""}

Return ONLY the rewritten script text. No quotes, no JSON, no explanation.`;

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];

    // Add keyframe images so GPT can match the visual mood
    for (let i = 0; i < validUrls.length; i++) {
      userContent.push({
        type: "text",
        text: `Frame ${i + 1}:`,
      });
      userContent.push({
        type: "image_url",
        image_url: { url: validUrls[i], detail: "low" },
      });
    }

    userContent.push({
      type: "text",
      text: `Rewrite the script now. Make it sound like a real person — emotional, natural, alive. 25-40 words.`,
    });

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      max_tokens: 300,
      temperature: 0.95,
    });

    let enhanced = response.choices[0]?.message?.content?.trim() || currentScript;
    // Strip surrounding quotes if GPT added them
    if ((enhanced.startsWith('"') && enhanced.endsWith('"')) ||
        (enhanced.startsWith('\u201c') && enhanced.endsWith('\u201d'))) {
      enhanced = enhanced.slice(1, -1).trim();
    }

    return NextResponse.json({ script: enhanced });
  } catch (e) {
    console.error("enhance-script error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "enhance failed" },
      { status: 500 }
    );
  }
}
