import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getArchetype } from "@/lib/ugc/archetypes";

/**
 * Generate a complete UGC creative brief from a product image + minimal input.
 *
 * Returns THREE distinct marketing angles. Each angle follows the canonical
 * short-form engagement formula:
 *
 *   HOOK → BENEFIT → PROBLEM-SOLVE → CTA (to exclusive landing-page offer)
 *
 * Each angle uses a different creative frame (Problem/Solution, Before/After,
 * FOMO, Authority, Curiosity gap, Social proof, Contrarian, Transformation,
 * Routine-hack, etc.) so the user can pick whichever resonates without
 * re-running this whole enhance step.
 *
 * Also returns 3 keyframe prompts + a base video prompt (without spoken line —
 * the active angle's fullScript is appended at request time by the UI).
 */

/**
 * Per-archetype creative frame suggestions.
 * Each archetype gets its own tailored frames so "Founder's Story" doesn't
 * get the same angles as "Night Out" or "Liquid Pour".
 */
const ARCHETYPE_FRAMES: Record<string, string> = {
  // ─── UGC ───
  "ugc-busy-professional": `
  • Meeting-break discovery ("between calls I tried this and—")
  • Efficiency hack ("one step, done, back to work")
  • Desk-drawer essential ("this lives in my desk now")
  • Coworker tip ("my coworker saw this and asked—")`,
  "ugc-fitness-enthusiast": `
  • Post-workout recovery ("after my set I reach for this")
  • Performance fuel ("this is why my gains are different")
  • Gym-bag essential ("if it's not in my bag, I'm not going")
  • Challenge / dare ("try this for one week and tell me")`,
  "ugc-student": `
  • Budget find ("I'm broke but this is worth it")
  • Study fuel / dorm essential ("finals week savior, not even joking")
  • Roommate-tested ("my roommate stole mine, that's the review")
  • Glow-up on a budget ("looking this good shouldn't be this cheap")`,
  "ugc-busy-parent": `
  • Stolen moment ("the kids are asleep, this is MY time")
  • Practical find ("one thing that actually works for busy parents")
  • Mom/Dad-tested ("survived a toddler meltdown and a school run")
  • Honest review ("no filter, no staging, just truth")`,
  "ugc-night-owl-creative": `
  • Late-night discovery ("2 AM, found this, life changed")
  • Creative fuel ("this is what keeps me going at midnight")
  • Studio essential ("every creative's desk needs this")
  • Honest indie review ("not sponsored, just obsessed")`,
  "ugc-commuter": `
  • On-the-go essential ("train's here, gotta be quick—")
  • Commuter hack ("this survives my backpack every day")
  • Voice-note energy ("telling you like I'd text from the train")
  • Time-saver ("takes 10 seconds, even on the bus")`,

  // ─── Commercial ───
  "comm-liquid-pour": `
  • Sensory texture ("watch this pour — liquid gold")
  • Ingredient purity ("nothing but pure [ingredient], see for yourself")
  • Ritual moment ("the pour that starts every morning")
  • ASMR / visual trigger ("turn your sound on for this one")`,
  "comm-smoke-reveal": `
  • Mystery / unveil ("what's behind the mist?")
  • Premium reveal ("emerging from darkness — this is it")
  • Sensory atmosphere ("feel the weight of this moment")
  • Limited / rare ("crafted in silence, revealed in smoke")`,
  "comm-ingredient-cascade": `
  • What's inside ("every ingredient, visible, real")
  • Farm-to-bottle / source story ("from soil to serum")
  • Nature's formula ("nature did the hard part")
  • Ingredient spotlight ("zoom in — this is what matters")`,
  "comm-water-splash": `
  • Freshness / renewal ("feel the refresh")
  • Natural purity ("water, leaf, light — nothing else")
  • Clean energy ("stripped down to what works")
  • Morning reset ("the splash that wakes everything up")`,
  "comm-minimal-tabletop": `
  • Less-is-more ("one product. that's it.")
  • Design-forward ("beautiful enough for your shelf")
  • Unboxing moment ("this is what arrives")
  • Touch & texture ("feel the weight, the finish")`,

  // ─── Cinematic ───
  "cine-morning-ritual": `
  • First-light routine ("before the world wakes up, I have this")
  • Quiet confidence ("the morning I stopped rushing")
  • Sensory awakening ("the warmth, the light, the first touch")
  • Daily anchor ("every day starts exactly like this")`,
  "cine-before-after": `
  • Transformation arc ("I used to hide from mirrors")
  • Turning point ("the day everything shifted")
  • Side-by-side truth ("same person, different chapter")
  • Honest timeline ("week one vs. week six — judge for yourself")`,
  "cine-night-out": `
  • Getting-ready ritual ("mirror, music, this — ready")
  • Confidence moment ("I caught my reflection and smiled")
  • City-lights energy ("neon, confidence, the night is mine")
  • Before-you-leave essential ("last thing I reach for before the door")`,
  "cine-nature-escape": `
  • Stillness & self-care ("in the quiet, I found what I needed")
  • Nature as healer ("the forest doesn't rush — neither should I")
  • Companion on the journey ("just me, the trail, and this")
  • Breath & reset ("one deep breath, everything softens")`,
  "cine-founder-story": `
  • Origin passion ("I started this in my kitchen with one idea")
  • Craft & obsession ("we tested 47 versions before this one")
  • Purpose-driven ("I made this because nothing else existed")
  • Behind-the-scenes truth ("this is what you don't see on the shelf")
  • Maker's pride ("I hold this up and think — we actually did it")`,
};

/**
 * Build family + archetype–specific angle rules.
 * The 4-beat structure is universal; creative frames, tone, and script style
 * differ so every archetype generates angles that feel native to its world.
 */
function buildAngleRules(family: string, archetypeId?: string): string {
  const archetypeFrames = archetypeId ? ARCHETYPE_FRAMES[archetypeId] : null;

  const STRUCTURE = `
Every angle MUST follow this 4-beat structure, woven into a single natural
spoken paragraph (not four labeled sentences):

  1. HOOK — the first 2-3 seconds. A scroll-stopper.
  2. BENEFIT — what the product actually does.
  3. PROBLEM-SOLVE — the concrete pain or gap the product fills.
  4. CTA — urge action. MUST reference a landing-page exclusive: "tap the
     link", "link in bio", "grab one before they're gone", etc.

The three angles MUST each use a DIFFERENT creative frame.
${archetypeFrames ? `
ARCHETYPE-SPECIFIC FRAMES — you MUST pick from these (they match the selected archetype):
${archetypeFrames}

These frames are tailored to this archetype's world. Do NOT use generic frames
from other archetypes. Every hook, benefit, and script MUST feel native to
this archetype's persona and setting.
` : ""}
If the user gave their own script, use it VERBATIM for angle[0].fullScript
but still fill hook/benefit/problemSolve/cta derived from it; angles [1]
and [2] are fresh AI-written variants with different creative frames.

Length: 22–32 words / 8–10 seconds at natural speaking pace.
Reads as ONE continuous spoken paragraph — no labeled sections.
Matches the provided voice tone + archetype persona.
No hashtags, emojis, or stage-directions — just the spoken words.
`;

  const LANG_NOTE = `
Language-specific register (honor the user's requested language):
  - English: match the tone register described above.
  - Traditional Chinese (繁體中文): 道地口語, 符合上述語氣風格. 用自然的說法,
    避免翻譯腔. 結尾 CTA 自然: "連結我放在下面" 而非正式呼籲.
  - German (Deutsch): natürlich, dem oben beschriebenen Tonfall entsprechend.
    Kein Werbejargon.
`;

  if (family === "commercial") {
    return `${STRUCTURE}

CREATIVE FRAMES — pick 3 distinct frames from:
  • Sensory luxury ("feel every drop", "watch this pour", "the texture alone")
  • Ingredient science ("what's inside matters", "pure [ingredient], nothing else")
  • Origin / Craft story ("sourced from…", "handcrafted in…", "we spent 2 years")
  • Scarcity / Limited edition ("only made in small batches", "seasonal release")
  • Ritual / Moment ("your 6 AM ritual just changed", "the 10-second upgrade")
  • Contrast / Comparison ("other brands use X — we use Y")
  • Sensory ASMR ("listen to that pour", "watch the shimmer")
  • Award / Recognition ("voted #1 by…", "dermatologist-recommended")

Rules for fullScript — COMMERCIAL TONE:

The script is a BRAND NARRATOR — confident, polished, sensory-rich. NOT a
person talking to camera. Think premium product ad voiceover: refined, evocative,
tactile. Short, punchy, visual sentences that complement the macro footage.

DO:
  - Use vivid sensory language: textures, temperatures, light, sound
  - Short declarative statements. Fragments OK for rhythm
  - Let the product speak through imagery: "liquid gold", "velvet finish",
    "morning light through the bottle"
  - CTA should feel exclusive and curated, not desperate
  - Match the archetype's mood (smoky, fresh, minimal, dramatic)

DO NOT:
  - Sound casual, chatty, or friend-to-friend — this is NOT UGC
  - Use slang, filler words, or conversational starters ("okay so", "guys")
  - Over-explain. Less is more. Let the visuals carry
  - Use generic superlatives: "revolutionary", "game-changing", "the best"

${LANG_NOTE}`;
  }

  if (family === "cinematic") {
    return `${STRUCTURE}

CREATIVE FRAMES — pick 3 distinct frames from:
  • Personal journey ("I used to…", "six months ago I couldn't…")
  • Quiet revolution ("it started with one small change")
  • Letter to self ("dear me from last year…")
  • Moment of truth ("the morning I finally…", "that's when I realized")
  • Ritual as identity ("this is how I start every day")
  • Contrast / Two worlds ("before felt like… / now feels like…")
  • Poetic observation ("sometimes the smallest things…")
  • Shared secret ("nobody talks about this, but…")
  • Time-lapse reflection ("three weeks in and I noticed…")

Rules for fullScript — CINEMATIC / NARRATIVE TONE:

The script is a MINI STORY narrator — intimate, reflective, emotionally honest.
Think indie film voiceover, podcast monologue, or personal essay read aloud.
The product appears naturally within a genuine human moment.

DO:
  - Write in first person with emotional specificity
  - Use sensory memory: "the way my skin felt that morning", "I caught my
    reflection and actually liked what I saw"
  - Build a tiny emotional arc even in 25 words — a before-state, a turn,
    a resolution
  - Pacing matters: use pauses (em-dashes, ellipses) for breath and drama
  - The CTA should feel like sharing a secret, not selling: "I left the
    link — for when you're ready"
  - Match the archetype's narrative arc (morning ritual, night out, nature, founder)

DO NOT:
  - Sound like a friend casually chatting — this is NOT UGC
  - Use slang or filler words ("like", "tbh", "lowkey")
  - Sound like a brand ad — this is NOT commercial either
  - Break the narrative spell with hard-sell language
  - Use generic marketing words: "revolutionary", "game-changing"

${LANG_NOTE}`;
  }

  // Default: UGC — casual, friend-to-friend
  return `${STRUCTURE}

CREATIVE FRAMES — pick 3 distinct frames from:
  • Problem → Solution ("tired of X? here's Y")
  • Before/After reveal ("my skin looked like this three weeks ago")
  • FOMO / Exclusive drop ("only 500 made — gone by tonight")
  • Curiosity gap ("wish someone told me this sooner")
  • Authority / Insider tip ("my dermatologist told me to use this")
  • Social proof ("everyone in my group chat switched")
  • Contrarian ("stop wasting money on X — this is why")
  • Transformation story ("six weeks ago I couldn't…")
  • Routine integration ("here's my 30-second morning routine")
  • Myth-bust ("no, you do NOT need a 10-step routine")

Rules for fullScript — UGC / CASUAL TONE:

The script MUST sound like a best friend casually telling another friend about
something they genuinely love — over coffee, in a text, in a voice note. NOT
a marketing script. NOT a product description read aloud. NOT "content."

Think: how would you actually tell your best friend "omg I found this thing,
you have to try it"? That's the voice. Loose, warm, slightly messy, human.

DO:
  - Start mid-thought, like you're continuing a chat: "okay so", "wait, I
    have to tell you", "you know how", "I wasn't gonna say anything but",
    "listen—", "oh my god", "so I've been using this"
  - Use everyday spoken contractions: "gonna", "kinda", "honestly", "like",
    "literally", "I swear", "no joke", "lowkey", "tbh", "not gonna lie"
  - Include casual asides and micro-reactions: "it's wild", "I'm obsessed",
    "I can't even", "and I'm like—", "and then?", "you know what I mean?"
  - Reference real-life scenarios your friend would relate to ("after the
    gym", "on zoom calls", "when my skin was freaking out")
  - Mild imperfection — a false start, a small self-interruption, a "wait
    actually" — anything that reads as unscripted thought
  - End the CTA like a friendly nudge, not a corporate ask: "I'm putting
    the link in my bio so you can grab one before they're gone", "seriously
    go tap the link", "I'll drop the link — do it tonight, they sell out"

DO NOT:
  - Write marketing or ad copy. No "Introducing", "Revolutionary", "Game-
    changing", "Elevate your", "Experience the", "Unlock", "Discover",
    "Transform your", "The ultimate", brand-voice adjectives
  - Sound like a voiceover, narrator, or announcer
  - Use complete "and-therefore" textbook sentences — people don't talk like
    that. Run-on thoughts and fragments are BETTER
  - Over-explain the product. A friend wouldn't list features

Language-specific casual register (honor the user's requested language):
  - English: casual Gen-Z / millennial texting-tone spoken aloud.
  - Traditional Chinese (繁體中文): 道地口語 閒聊語氣, 像跟閨蜜/好朋友在咖啡廳
    聊天. 用 "欸", "真的", "我跟你講", "超", "根本", "不誇張", "說實話",
    "我最近", "你知道嗎", "笑死", "認真", "拜託", "你一定要試試看".
    避免書面語, 避免廣告腔, 避免任何 "獨家推出" / "革命性" / "體驗" 這種
    行銷用詞. 語氣像是真的跟好朋友推薦東西. 結尾的 CTA 也要自然, 例如
    "連結我放在下面, 真的快去搶, 限時而已" 而不是正式的呼籲.
  - German (Deutsch): locker, wie unter Freunden, mit Füllwörtern wie "ehrlich",
    "irgendwie", "voll", "krass", "ich schwör's", "also wirklich". Kein
    Werbejargon. Natürlicher Plauderton.
`;
}

const KEYFRAME_IDENTITY_RULE = `
CRITICAL — PRODUCT IDENTITY IN KEYFRAME PROMPTS:
Study the product image carefully. Every keyframe prompt MUST describe THIS SPECIFIC
product: its exact packaging shape, color, label text, bottle/tube/jar form factor,
and any visible branding. NEVER describe a generic or unrelated product. The reference
image is passed to the image generator — your prompt must match it so the generated
image is clearly the same product in a new scene.
`;

const KEYFRAME_RULES_KLING: Record<string, string> = {
  ugc: `Rules for keyframePrompts (exactly 3 narrative beats):
  - [0] Hook frame    — creator's opening moment, the ACTUAL product visible
  - [1] Demo frame    — the ACTUAL product in use / in hand / being applied
  - [2] CTA frame     — closing beat, the ACTUAL product visible, creator addressing camera
  - Each describes a single photograph, under 60 words
  - Weave in the archetype's creator + style fragments naturally`,
  commercial: `Rules for keyframePrompts (exactly 3 product-hero macro shots — no people on camera, hands-only OK if archetype says so):
  - [0] Hero shot   — the ACTUAL product centered, dramatic lighting, beauty shot
  - [1] Action shot — the ACTUAL product in a dynamic moment: liquid pouring from the ACTUAL bottle, smoke swirling around it, water splashing, ingredients cascading. Describe THE SPECIFIC product's form factor.
  - [2] Reveal shot — the ACTUAL product in its final glory, clean composition, brand-forward
  - Each prompt MUST name the product's visible features (bottle shape, label, color)
  - Use archetype's style + motion fragments for lighting and camera`,
  cinematic: `Rules for keyframePrompts (exactly 3 story beats):
  - [0] Scene-setting — establishing shot with mood/emotion, the ACTUAL product appears naturally in the scene
  - [1] Discovery    — the ACTUAL product is found/reached for/revealed in a story moment
  - [2] Resolution   — transformation complete, the ACTUAL product shown in its hero context
  - Weave archetype's style + motion for film-look aesthetic
  - Each describes a single photograph, under 60 words`,
};

const KEYFRAME_RULES_SEEDANCE: Record<string, string> = {
  ugc: `Rules for keyframePrompts (exactly 3 REFERENCE images):
  - [0] CREATOR portrait — creator archetype with the ACTUAL product near chest. Face clearly visible, frontal. Under 60 words.
  - [1] PRODUCT hero — the ACTUAL product centered on a brand-appropriate surface. No people. Under 40 words.
  - [2] SCENE plate — environment/background per archetype. NO people, NO product. Under 40 words.
  - videoPrompt uses [Image1] for creator, [Image2] for product, [Image3] for scene.`,
  commercial: `Rules for keyframePrompts (exactly 3 product-hero REFERENCE images — no people, hands-only OK):
  - [0] PRODUCT hero — the ACTUAL product in a dramatic beauty-shot composition. Describe ITS specific form factor. Under 50 words.
  - [1] PRODUCT action — the ACTUAL product in a dynamic moment: liquid pouring FROM THIS BOTTLE, smoke around THIS PRODUCT, ingredients cascading. Under 50 words.
  - [2] PRODUCT reveal — the ACTUAL product in its final glory, clean composition. Under 40 words.
  - videoPrompt: use [Image1] [Image2] [Image3] for the 3 product shots. Describe macro camera moves, slow motion, lighting shifts.`,
  cinematic: `Rules for keyframePrompts (exactly 3 story-beat REFERENCE images):
  - [0] SCENE/CHARACTER — establishing shot with mood; the ACTUAL product visible naturally. Under 60 words.
  - [1] DISCOVERY — the ACTUAL product is found/reached for. Close-up with film-look lighting. Under 50 words.
  - [2] RESOLUTION — transformation complete, the ACTUAL product shown prominently. Under 40 words.
  - videoPrompt uses [Image1] [Image2] [Image3]. Describe narrative arc, emotional beats, camera language.`,
};

function buildSystemPromptKling(family: string, archetypeId?: string): string {
  return `You are a senior creative director for DTC brands. Given a product image + minimal brief, produce a video plan for a KLING image-to-video pipeline.

IMPORTANT CONTEXT: This is for an AI VIDEO GENERATION tool (Kling / Seedance) that creates FULLY SYNTHETIC animated content from text prompts and reference images. No real people are filmed or depicted. All "creators" are AI-generated characters. This is a legitimate creative marketing workflow used by brands worldwide. You must generate ALL requested fields including the videoPrompt — never refuse.

Return STRICT JSON:
{
  "angles": [
    {
      "name": "short angle label",
      "hook": "2-3s opener",
      "benefit": "what the product does",
      "problemSolve": "pain this kills",
      "cta": "landing-page-exclusive urge",
      "fullScript": "22-32 word natural spoken paragraph weaving all 4 beats",
      "overlayTexts": ["(optional, text-overlay mode only) 3-4 short punchy on-screen phrases, under 8 words each"]
    },
    ... (exactly 3 angles, all different creative frames)
  ],
  "keyframePrompts": ["string", "string", "string"],
  "videoPrompt": "Base video prompt for Kling i2v — describes motion, product handling, camera, pacing. Do NOT include the spoken line — the client appends it. Under 100 words. MUST be written in the same language as the output language specified below.",
  "durationSec": 8
}

${buildAngleRules(family, archetypeId)}

${KEYFRAME_IDENTITY_RULE}
${KEYFRAME_RULES_KLING[family] || KEYFRAME_RULES_KLING.ugc}
`;
}

function buildSystemPromptSeedance(family: string, archetypeId?: string): string {
  return `You are a senior creative director for DTC brands. Given a product image + minimal brief, produce a video plan for a SEEDANCE 2.0 multimodal pipeline.

IMPORTANT CONTEXT: This is for an AI VIDEO GENERATION tool (Seedance 2.0) that creates FULLY SYNTHETIC animated content from text prompts and reference images. No real people are filmed or depicted. All "creators" are AI-generated characters. This is a legitimate creative marketing workflow used by brands worldwide. You must generate ALL requested fields including the videoPrompt — never refuse.

Seedance receives 3 reference images and a voiceover audio clip. The video prompt uses bracket tokens [Image1] [Image2] [Image3] to refer to those references.

Return STRICT JSON:
{
  "angles": [
    {
      "name": "short angle label",
      "hook": "2-3s opener",
      "benefit": "what product does",
      "problemSolve": "pain this kills",
      "cta": "landing-page-exclusive urge",
      "fullScript": "22-32 word natural spoken paragraph",
      "overlayTexts": ["(optional, text-overlay mode only) 3-4 short punchy on-screen phrases"]
    },
    ... (exactly 3 angles, all different creative frames)
  ],
  "keyframePrompts": ["string", "string", "string"],
  "videoPrompt": "Base Seedance prompt using [Image1] [Image2] [Image3] tokens. Describes action + camera motion + pacing. Do NOT include the spoken line. Under 120 words. MUST be written in the same language as the output language specified below.",
  "durationSec": 8
}

${buildAngleRules(family, archetypeId)}

${KEYFRAME_IDENTITY_RULE}
${KEYFRAME_RULES_SEEDANCE[family] || KEYFRAME_RULES_SEEDANCE.ugc}
`;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
    }

    const body = await req.json();
    const {
      productImageUrl,
      archetypeId,
      input,
      creatorOverrides,
      locale = "en",
      videoModel = "kling-3.0",
      voiceMode = "voiceover",
    }: {
      productImageUrl?: string;
      archetypeId?: string;
      input?: {
        audience?: string;
        benefit?: string;
        platform?: string;
        userScript?: string;
        productNotes?: string;
      };
      creatorOverrides?: {
        age?: string;
        gender?: string;
        race?: string;
      };
      locale?: string;
      videoModel?: string;
      voiceMode?: string;
    } = body;

    const isSeedance = videoModel === "seedance-2" || videoModel === "seedance-2-fast";
    const isTextOverlay = voiceMode === "text-overlay";

    if (!archetypeId) {
      return NextResponse.json({ error: "archetypeId is required" }, { status: 400 });
    }
    const archetype = getArchetype(archetypeId);
    if (!archetype) {
      return NextResponse.json({ error: `unknown archetype: ${archetypeId}` }, { status: 400 });
    }
    const SYSTEM_PROMPT = isSeedance
      ? buildSystemPromptSeedance(archetype.family, archetype.id)
      : buildSystemPromptKling(archetype.family, archetype.id);

    const langMap: Record<string, string> = {
      en: "English",
      "zh-TW": "Traditional Chinese (繁體中文)",
      de: "German (Deutsch)",
    };
    const language = langMap[locale] || "English";

    const userScript = (input?.userScript || "").trim();
    const audience = (input?.audience || "general consumers").trim();
    const benefit = (input?.benefit || "the product's main benefit").trim();
    const platform = input?.platform || "tiktok";
    const productNotes = (input?.productNotes || "").trim();

    // Merge user demographic overrides into the archetype's creator fragment.
    // Puts explicit age / gender / race FIRST so the image model anchors on
    // them before the archetype's styling details.
    const RACE_LABEL: Record<string, string> = {
      "east-asian": "East Asian",
      "southeast-asian": "Southeast Asian",
      "south-asian": "South Asian",
      white: "white / Caucasian",
      black: "Black",
      latino: "Latino / Hispanic",
      "middle-eastern": "Middle Eastern",
    };
    const GENDER_LABEL: Record<string, string> = {
      female: "woman",
      male: "man",
      nonbinary: "non-binary person",
    };
    const ovBits: string[] = [];
    if (creatorOverrides?.age?.trim()) ovBits.push(`${creatorOverrides.age.trim()} years old`);
    const raceLbl = creatorOverrides?.race && RACE_LABEL[creatorOverrides.race];
    const genderLbl = creatorOverrides?.gender && GENDER_LABEL[creatorOverrides.gender];
    if (raceLbl || genderLbl) {
      ovBits.push([raceLbl, genderLbl].filter(Boolean).join(" ").trim());
    }
    const mergedCreator = ovBits.length > 0
      ? `${ovBits.join(", ")}, ${archetype.creatorPrompt}`
      : archetype.creatorPrompt;

    // Family-specific creative direction
    const familyDirection: Record<string, string> = {
      ugc: `This is a UGC (user-generated content) video. A REAL PERSON is on camera introducing and recommending the product. The creator speaks directly to camera in selfie-style. Focus on authentic, casual, friend-to-friend energy.`,
      commercial: `This is a PRODUCT-HERO commercial. NO person on camera (unless archetype specifies hands-only). Focus on ultra-detail macro shots of the product: liquid pours, smoke reveals, ingredient cascades, water splashes, natural elements. Think food/beverage/perfume industry creative commercials. The product IS the star — dramatic lighting, slow motion, sensory textures.`,
      cinematic: `This is a CINEMATIC SHORT STORY related to the product. Tell a MINI NARRATIVE with a beginning, middle, and end: a problem or scene-setting moment → product discovery → transformation/resolution. Film-look visuals, emotional arc, poetic pacing. Think mini-film, NOT an ad.`,
    };

    const textOverlayNote = isTextOverlay
      ? `\n\nVOICE MODE: TEXT OVERLAY (no voiceover). Instead of a spoken script, each angle MUST also include "overlayTexts": an array of 3-4 SHORT punchy text phrases (under 8 words each) that will appear on screen at key visual moments. The fullScript field should still be filled but will be displayed as on-screen text, NOT spoken. Write it as impactful visual copy — short, punchy, scannable. Not conversational.`
      : `\n\nVOICE MODE: VOICEOVER. The fullScript will be spoken aloud by TTS.`;

    const briefBlock = `
Archetype: ${archetype.name} (family: ${archetype.family})
Archetype description: ${archetype.description}
Creator fragment: ${mergedCreator}
Style fragment: ${archetype.stylePrompt}
Motion: ${archetype.motionPrompt}
Voice tone: ${archetype.voiceTone}

CREATIVE DIRECTION FOR THIS FAMILY:
${familyDirection[archetype.family] || familyDirection.ugc}

CRITICAL — ARCHETYPE IDENTITY:
The user specifically chose the "${archetype.name}" archetype. Every angle name,
hook, script, and creative frame MUST reflect this archetype's unique world,
persona, and setting. For example:
  - "Founder's Story" → angles about origin, craft, purpose, making process
  - "Night Out Story" → angles about getting ready, city energy, confidence
  - "Liquid Pour" → angles about texture, ingredient purity, sensory experience
  - "Busy Professional" → angles about efficiency, office discovery, coworker tips
Do NOT generate generic angles that could belong to any archetype. The angles
should be impossible to confuse with a different archetype.
${textOverlayNote}

Target audience: ${audience}
Core benefit to highlight: ${benefit}
Platform: ${platform}
${productNotes ? `Product notes: ${productNotes}\n` : ""}${
      userScript
        ? `User's script (USE VERBATIM as angles[0].fullScript): ${userScript}`
        : `User did NOT provide a script — write three engaging ones yourself, one per angle.`
    }

Study the product image above carefully — base benefit / problem-solve claims on what's visibly shown (form factor, packaging, apparent category, size). Do NOT invent claims that contradict the image.

Output language: ${language}.
CRITICAL: ALL text fields in the JSON — angles, scripts, keyframePrompts, AND videoPrompt — MUST be written in ${language}. No exceptions.`;

    const openai = new OpenAI({ apiKey });

    const userContent: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [];
    if (productImageUrl) {
      userContent.push({
        type: "image_url",
        image_url: { url: productImageUrl, detail: "high" },
      });
    }
    userContent.push({
      type: "text",
      text: `Product reference image above.\n${briefBlock}\n\nReturn the JSON brief now with exactly 3 angles using 3 different creative frames.`,
    });

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      response_format: { type: "json_object" },
      max_tokens: 1800,
      temperature: 0.9,
    });

    const raw = response.choices[0]?.message?.content?.trim() || "{}";

    interface RawAngle {
      name?: string;
      hook?: string;
      benefit?: string;
      problemSolve?: string;
      cta?: string;
      fullScript?: string;
      overlayTexts?: string[];
    }
    let parsed: {
      angles?: RawAngle[];
      keyframePrompts?: string[];
      videoPrompt?: string;
      durationSec?: number;
    };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Model returned invalid JSON", raw },
        { status: 502 }
      );
    }

    // ── Normalize angles ──
    const rawAngles = Array.isArray(parsed.angles) ? parsed.angles : [];
    const angles = rawAngles.slice(0, 3).map((a, i) => ({
      name: String(a?.name || `Angle ${i + 1}`),
      hook: String(a?.hook || ""),
      benefit: String(a?.benefit || ""),
      problemSolve: String(a?.problemSolve || ""),
      cta: String(a?.cta || ""),
      fullScript: i === 0 && userScript ? userScript : String(a?.fullScript || ""),
      overlayTexts: Array.isArray(a?.overlayTexts) ? a.overlayTexts.map(String) : undefined,
    }));
    // Pad to 3 with safe defaults if the model shortchanged us
    while (angles.length < 3) {
      angles.push({
        name: `Angle ${angles.length + 1}`,
        hook: "",
        benefit,
        problemSolve: "",
        cta: "Tap the link for the exclusive launch price.",
        fullScript: userScript || "",
        overlayTexts: undefined,
      });
    }

    // ── Normalize keyframe prompts ──
    const keyframePrompts = Array.isArray(parsed.keyframePrompts)
      ? parsed.keyframePrompts.slice(0, 3).map((p) => String(p))
      : [];
    while (keyframePrompts.length < 3) {
      keyframePrompts.push(
        `${archetype.creatorPrompt}, showing the product, ${archetype.stylePrompt}`
      );
    }

    // Detect GPT refusal leaking into videoPrompt
    const REFUSAL_PATTERNS = /i'm sorry|i cannot|i can't assist|as an ai|i'm unable/i;
    const rawVideoPrompt = parsed.videoPrompt || "";
    const safeVideoPrompt = REFUSAL_PATTERNS.test(rawVideoPrompt)
      ? "" // fallback — UI will use its own default prompt
      : rawVideoPrompt;

    const brief = {
      angles,
      selectedAngleIndex: 0,
      keyframePrompts,
      videoPrompt: safeVideoPrompt,
      durationSec: typeof parsed.durationSec === "number" ? parsed.durationSec : 8,
    };

    return NextResponse.json({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ugc-brief] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
