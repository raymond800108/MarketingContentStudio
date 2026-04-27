import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

/**
 * Generate voiceover audio via OpenAI's **expressive** TTS (`gpt-4o-mini-tts`)
 * and upload to FAL CDN.
 *
 * Why gpt-4o-mini-tts (not tts-1):
 *   - Accepts a free-form `instructions` field that steers **delivery**
 *     (emotion, pacing, breath, character) independently of the spoken text.
 *   - Produces noticeably warmer, less robotic output — closer to a real
 *     creator recording on their phone.
 *
 * To make the voice actually *feel* like a real person telling their own
 * story, this route derives a rich delivery brief from:
 *   - the archetype's voice tone (persona baseline)
 *   - the active marketing angle's 4 beats (hook / benefit / problem-solve /
 *     CTA) — so the emotion rises and falls with the text's meaning
 *   - the angle name/frame (FOMO vs Authority vs Transformation vs …) —
 *     different frames want different emotional colors
 *
 * Input:
 *   {
 *     text: string,                     // the fullScript (required)
 *     voice?: string,                   // archetype ttsVoice, remapped to
 *                                       // gpt-4o-mini-tts voice set
 *     voiceTone?: string,               // archetype voiceTone fragment
 *     angle?: {
 *       name?: string,                  // e.g. "FOMO Drop"
 *       hook?: string,
 *       benefit?: string,
 *       problemSolve?: string,
 *       cta?: string,
 *     },
 *     language?: string,                // "English" / "繁體中文" / "Deutsch"
 *     speed?: number,                   // 0.9–1.1 natural range
 *   }
 *
 * Output: { url, durationSec }
 */

// gpt-4o-mini-tts expressive voice set.
// Voices grouped by perceived gender presentation:
//   Female-presenting : coral (warm friendly), verse (bright emotive), shimmer, nova
//   Male-presenting   : ash (young grit), sage (grounded mature), echo, onyx
//   Neutral           : alloy, ballad (intimate narrative)
const FEMALE_VOICES = ["coral", "verse"];
const MALE_VOICES = ["ash", "sage"];
const NEUTRAL_VOICES = ["alloy", "ballad"];

// Legacy archetype voice → expressive counterpart (used when no gender override)
const VOICE_MAP: Record<string, string> = {
  alloy: "alloy",
  echo: "ash",
  fable: "ballad",
  onyx: "sage",
  nova: "coral",
  shimmer: "verse",
  ash: "ash",
  ballad: "ballad",
  coral: "coral",
  sage: "sage",
  verse: "verse",
};

interface CreatorOverridesInput {
  age?: string;
  gender?: string;  // "female" | "male" | "nonbinary" | "any"
  race?: string;
}

/**
 * Pick TTS voice that matches the creator's gender + age.
 * Gender override takes priority over archetype default.
 */
function pickVoice(archetypeVoice?: string, overrides?: CreatorOverridesInput): string {
  const gender = overrides?.gender || "any";
  const age = parseInt(overrides?.age || "", 10);
  const isYoung = !isNaN(age) && age < 30;

  if (gender === "male") {
    // Young males → ash (energetic grit), older → sage (grounded)
    return isYoung ? "ash" : "sage";
  }
  if (gender === "female") {
    // Young females → verse (bright emotive), older → coral (warm)
    return isYoung ? "verse" : "coral";
  }
  if (gender === "nonbinary") {
    return isYoung ? "alloy" : "ballad";
  }
  // gender === "any" — fall back to archetype mapping
  if (archetypeVoice && VOICE_MAP[archetypeVoice]) {
    return VOICE_MAP[archetypeVoice];
  }
  return "coral";
}

/**
 * Figure out the emotional color for this angle. Each frame wants a different
 * underlying feeling on top of the archetype's baseline tone.
 */
function emotionForAngle(angleName?: string): string {
  const n = (angleName || "").toLowerCase();
  if (n.includes("fomo") || n.includes("exclusive") || n.includes("drop")) {
    return "a subtle conspiratorial excitement — like you're letting a friend in on something that's about to sell out. Lean in on the CTA.";
  }
  if (n.includes("before") || n.includes("after") || n.includes("transformation")) {
    return "quiet awe and genuine emotional relief — you're telling a story about something that actually changed. Let the wonder come through on the result.";
  }
  if (n.includes("contrarian") || n.includes("myth") || n.includes("stop")) {
    return "mildly incredulous, almost bothered at the start — you can't believe people are still doing the old thing — then warming into helpful.";
  }
  if (n.includes("authority") || n.includes("insider") || n.includes("dermatologist") || n.includes("expert")) {
    return "confident and insider-ish, like you know something others don't. Not lecturing — intimate expertise.";
  }
  if (n.includes("social") || n.includes("proof") || n.includes("everyone")) {
    return "amused surprise — 'I can't be the only one' energy, light and social.";
  }
  if (n.includes("curiosity") || n.includes("wish")) {
    return "a soft, slightly confessional tone — you're sharing something you figured out the hard way.";
  }
  if (n.includes("routine") || n.includes("morning") || n.includes("hack")) {
    return "breezy and practical, efficient energy — like talking through your day to a friend.";
  }
  if (n.includes("problem") || n.includes("solution") || n.includes("tired")) {
    return "empathetic at the problem, then relieved and a little triumphant at the solution.";
  }
  // Default
  return "warm sincerity, like you're genuinely telling a friend something that made your life better.";
}

function buildInstructions(params: {
  voiceTone?: string;
  angleName?: string;
  hook?: string;
  benefit?: string;
  problemSolve?: string;
  cta?: string;
  language?: string;
  creator?: CreatorOverridesInput;
}): string {
  const tone = params.voiceTone || "warm, conversational, like talking to a close friend";
  const emotion = emotionForAngle(params.angleName);
  const lang = params.language || "English";

  // Build a concrete character identity from creator overrides
  const cGender = params.creator?.gender || "any";
  const cAge = params.creator?.age?.trim() || "";
  const cRace = params.creator?.race || "any";

  const RACE_DESC: Record<string, string> = {
    "east-asian": "East Asian",
    "southeast-asian": "Southeast Asian",
    "south-asian": "South Asian / Indian",
    white: "white / Caucasian",
    black: "Black",
    latino: "Latino / Hispanic",
    "middle-eastern": "Middle Eastern",
  };
  const GENDER_DESC: Record<string, string> = {
    female: "woman",
    male: "man",
    nonbinary: "non-binary person",
  };

  const identityBits: string[] = [];
  if (cAge) identityBits.push(`${cAge}-year-old`);
  if (cRace !== "any" && RACE_DESC[cRace]) identityBits.push(RACE_DESC[cRace]);
  if (cGender !== "any" && GENDER_DESC[cGender]) identityBits.push(GENDER_DESC[cGender]);
  const identityLine = identityBits.length > 0
    ? `You are a ${identityBits.join(" ")} — embody this identity completely. Your vocal quality, speech patterns, energy level, and cultural vibe should reflect who you are.`
    : "You are a real person — warm, authentic, relatable.";

  const beatGuidance = [
    params.hook && `• HOOK — "${params.hook}": deliver like a real scroll-stopper — a little spike of energy, surprise, or a confessional lean-in. Pattern-break the listener.`,
    params.benefit && `• BENEFIT — "${params.benefit}": drop the energy slightly, matter-of-fact, grounded, like sharing a practical tip.`,
    params.problemSolve && `• PROBLEM-SOLVE — "${params.problemSolve}": empathetic at the pain, softer voice, then a lift of genuine relief that it's fixed.`,
    params.cta && `• CTA — "${params.cta}": warm urgency, leaning-in, conspiratorial "tell a friend" energy — NEVER announce-read it.`,
  ].filter(Boolean).join("\n");

  // Concrete character-first instructions work far better with
  // gpt-4o-mini-tts than abstract rules. Paint a vivid scene, then let the
  // actor inhabit it. Dramatize the emotion with explicit physical cues
  // (breath, smile, lean-in, laugh) so the model renders audible feeling.
  return `
PERFORMANCE BRIEF — read carefully, this is an ACTING direction, not a read.

You are NOT reading a script. You just grabbed your phone to tell your
best friend about something genuinely exciting. You are filming a messy,
vertical selfie video in your bathroom or kitchen. You are ${tone}.

${identityLine}

Speak in ${lang}. Totally natural, unscripted-sounding, spoken like a voice
note, NOT narrated. If you sound even 10% like an audiobook narrator or a
TV commercial, you have FAILED this take. If you sound like a radio DJ,
you have FAILED this take.

EMOTIONAL COLOR for this specific take:
${emotion}

CONCRETE PERFORMANCE CUES — USE THESE (audibly, not literally pronounced):
- Start with a soft intake of breath — like you just thought of this.
- SMILE through the whole thing. The listener must HEAR the smile.
- A tiny quiet laugh or amused exhale somewhere in the middle — where it
  feels right in the text. A puff of air, a "heh", a grin-through.
- Real breath between thought-groups — not between grammatical sentences.
- Vary your pitch HARD. Go up when excited, drop low and confidential for
  the pain/problem moment, lift back up for the solution, then pull IN
  close — almost whispered, conspiratorial — for the CTA.
- SPEED varies — rush through unimportant connector words, linger and
  stretch the KEY word (the product effect, the "oh my god" moment).
- Lean into certain words with vocal weight. Italicize them with your
  voice. The listener should feel which words matter.
- End the take with a warm, slightly lower, almost-whisper energy on the
  CTA — like you're letting them in on a secret.

THINGS THAT KILL THE TAKE (do not do these):
- Flat pitch. Monotone. Robotic evenness.
- Even, metronomic pacing. Real humans speed up and slow down constantly.
- Over-enunciating every syllable. Slur the small words like a real person.
- Formal pauses between sentences. Blur the sentence boundaries together.
- "Voiceover voice." "Announcer voice." "Spokesperson voice." None of these.
- Treating every word with equal weight — most words should be thrown away.

INTERNAL EMOTIONAL ARC tied to the text you're about to speak
(do not re-read these words, they're already in the input — just FEEL them
as you hit the corresponding part of the input text):
${beatGuidance || "• Opening words: spark of surprise / confession / pattern-break.\n• Middle: grounded, matter-of-fact, sharing a tip.\n• Pain moment: empathy and relief.\n• Closing words (CTA): lean in, warm urgency, conspiratorial."}

DELIVERY: one continuous take. Breathe. Smile. Vary. Feel it like you
actually just discovered this thing yourself. Give it life.
  `.trim();
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const falKey = process.env.FAL_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }
    if (!falKey) {
      return NextResponse.json({ error: "FAL_KEY is not set" }, { status: 500 });
    }

    const {
      text,
      voice = "coral",
      voiceTone,
      angle,
      language,
      creatorOverrides,
      speed = 1.0,
    } = (await req.json()) as {
      text?: string;
      voice?: string;
      voiceTone?: string;
      angle?: {
        name?: string;
        hook?: string;
        benefit?: string;
        problemSolve?: string;
        cta?: string;
      };
      language?: string;
      creatorOverrides?: CreatorOverridesInput;
      speed?: number;
    };

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Pick voice based on creator gender/age, falling back to archetype default
    const mappedVoice = pickVoice(voice, creatorOverrides);
    const instructions = buildInstructions({
      voiceTone,
      angleName: angle?.name,
      hook: angle?.hook,
      benefit: angle?.benefit,
      problemSolve: angle?.problemSolve,
      cta: angle?.cta,
      language,
      creator: creatorOverrides,
    });

    console.log(`[ugc-tts] model=gpt-4o-mini-tts voice=${mappedVoice} lang=${language || "en"} angle=${angle?.name || "-"} gender=${creatorOverrides?.gender || "any"} age=${creatorOverrides?.age || "-"}`);

    const openai = new OpenAI({ apiKey });
    // NOTE: gpt-4o-mini-tts supports the `instructions` field for steering
    // delivery. Cast the params object so older SDK typings don't block it.
    const speechParams = {
      model: "gpt-4o-mini-tts",
      voice: mappedVoice,
      input: text,
      instructions,
      response_format: "mp3" as const,
      speed: Math.max(0.9, Math.min(1.1, speed)),
    } as unknown as Parameters<typeof openai.audio.speech.create>[0];

    const speech = await openai.audio.speech.create(speechParams);

    const arrayBuffer = await speech.arrayBuffer();
    const contentType = "audio/mpeg";
    const fileName = `ugc-vo-${Date.now()}.mp3`;

    // Upload to FAL CDN (two-step: initiate then PUT)
    const initiateRes = await fetch(
      "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
      {
        method: "POST",
        headers: {
          Authorization: `Key ${falKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content_type: contentType, file_name: fileName }),
      }
    );
    if (!initiateRes.ok) {
      const err = await initiateRes.text();
      return NextResponse.json({ error: `FAL initiate failed: ${err}` }, { status: 500 });
    }
    const { upload_url, file_url } = await initiateRes.json();

    const putRes = await fetch(upload_url, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: arrayBuffer,
    });
    if (!putRes.ok) {
      const err = await putRes.text();
      return NextResponse.json({ error: `FAL upload failed: ${err}` }, { status: 500 });
    }

    // Rough duration estimate — 150 wpm is typical for conversational TTS.
    const words = text.trim().split(/\s+/).length;
    const durationSec = Math.max(3, Math.round((words / 150) * 60 / Math.max(0.5, speed)));

    return NextResponse.json({ url: file_url, durationSec });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ugc-tts] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
