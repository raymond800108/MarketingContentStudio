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

  // ─── Commercial — SPORT / B-ROLL family ───
  "comm-sport-training-montage": `
  • Relentless effort ("train harder. period.")
  • Built for the work ("made for what you do every day")
  • No shortcut ("this is the gear. nothing more.")
  • Pure mechanics ("this is how it moves")`,
  "comm-sport-gear-hero": `
  • Engineered detail ("every millimeter matters")
  • Tech close-up ("look closer — this is why")
  • The edge you don't see ("what the camera finds you feel")
  • Pattern and precision ("designed by obsessives")`,
  "comm-sport-motion-match": `
  • Body and gear as one ("your body. our answer.")
  • Response in real-time ("it moves when you move")
  • Friction removed ("nothing stands between you and the work")
  • Kinetic harmony ("built for motion")`,

  // ─── Commercial — LUXURY / ELEGANT family ───
  "comm-elegant-morning-ritual": `
  • Quiet luxury ("the small ritual that changes the morning")
  • Sensory awakening ("first light. first touch.")
  • Understated power ("noticed only by those who look")
  • Daily return ("the object you reach for every day")`,
  "comm-elegant-hero-reveal": `
  • Craft revealed ("seen closely, made finely")
  • The detail within ("look at what we put in")
  • Form meets function ("beautiful enough to keep on the shelf")
  • Patience in the making ("slow. intentional. complete.")`,
  "comm-elegant-ingredient-cascade": `
  • Pure inside ("nothing but what it says on the label")
  • Ingredient as story ("each element, visible and honest")
  • Nature's formula ("we didn't reinvent — we respected")
  • The pour that matters ("one bottle, every morning")`,

  // ─── Commercial — FASHION / SURREAL family ───
  "comm-surreal-floating": `
  • Gravity is optional ("the impossible made intentional")
  • Product as portal ("step into what this is about")
  • Beyond the object ("a concept you can hold")
  • Dream logic ("what if this was always floating?")`,
  "comm-surreal-color-block": `
  • Color as language ("one shade tells the whole story")
  • The only thing worth looking at ("everything else is quiet")
  • Identity in hue ("this shade — and nothing else")
  • Pattern of one ("one product. one field. one meaning.")`,
  "comm-surreal-scale-disruption": `
  • Bigger than it seems ("everything you don't expect")
  • Size as metaphor ("the weight of want")
  • Worlds of one object ("what if this was the biggest thing?")
  • Impossible scale ("designed to feel vast")`,

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

  1. HOOK — the first 1-2 seconds (7-10 words). Must be pulled from a specific
     category in the HOOK LIBRARY below. Each of the 3 angles uses a DIFFERENT
     hook category. NEVER use the stale 2022 openers ("okay so", "wait I have
     to tell you", "you know how", "listen—", "oh my god", "so I've been
     using this"). These are AI-detection scroll-triggers in 2026.
  2. BENEFIT — what the product actually does (specific, not "glowing"/"amazing").
  3. PROBLEM-SOLVE — the concrete pain or gap (with sensory specificity).
  4. CTA — earned, casual, friend-level. Pick from the MODERN CTA LIBRARY below.
     NEVER use "link in bio" / "tap the link" / "grab one before they're gone"
     / "exclusive landing-page offer" — these signal paid-ad.

The three angles MUST use THREE DIFFERENT hook categories AND three different
creative frames.
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

Length: 15–22 words / 5–7 seconds at natural speaking pace (2026 TikTok
attention-span target — shorter is stronger, viewers' thumbs are ready to
scroll by word 18).
Reads as ONE continuous spoken paragraph — no labeled sections.
Matches the provided voice tone + archetype persona.
Include em-dashes (—) for breath/thinking pauses. Include at least one
self-correction or hesitation ("like", "I think", "wait—actually").
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

Rules for fullScript — UGC / CASUAL TONE (2026 edition):

The script MUST sound like a real person recording a voice memo to a friend.
NOT a marketing script. NOT a product description read aloud. NOT "content".
Viewers in 2026 scroll past "AI UGC" within 2 seconds — your job is to make
the script feel UNMISTAKABLY human.

═══════════════════════════════════════════════════════════════════
HOOK LIBRARY (2026) — pick 3 DIFFERENT categories across the 3 angles
═══════════════════════════════════════════════════════════════════

CRITICAL: The THREE angles must use THREE DIFFERENT hook categories from
the library below. Never use the same category twice. Never use the stale
2022 openers "okay so", "wait I have to tell you", "you know how", "listen—",
"oh my god" — these are now recognized as AI-UGC scroll-triggers and kill
performance. Mix in one unexpected category (confession, contrarian, ASMR)
alongside one safer category (numerical, transformation) for variety.

  1. VISUAL / POV HOOKS — pattern-interrupt visual declaration
     EN: "POV: you see this and you have to know what it is" · "Rate my [category] haul, but before you do—" · "Tell me this doesn't look like [X]"
     繁中: "你看到這個第一眼就想知道是什麼" · "幫我評分我的[類別]戰利品，不過在你評之前—" · "跟我講這個不是[某東西]"
     DE: "Erste Reaktion wenn man das sieht: das MUSS ich haben" · "Bewerte meinen [Kategorie]-Haul, aber vorher—" · "Sag mir das sieht nicht aus wie [X]"

  2. NUMERICAL / SPECIFICITY HOOKS — exact counts earn trust
     EN: "I've been doing this wrong for 10 years" · "Tried 15 [X] and this is the one" · "60 days in and I can't go back"
     繁中: "這件事我做錯了十年" · "試了15個[X]，這個才是對的" · "用了60天我再也回不去了"
     DE: "Ich hab das 10 Jahre lang falsch gemacht" · "15 [X] durchprobiert und das hier ist es" · "60 Tage drin und ich kann nicht mehr zurück"

  3. CONTRARIAN / DE-INFLUENCING HOOKS — rejection builds credibility
     EN: "Stop wasting money on [competitor]. Do this instead" · "I didn't want to like this but I do" · "Everyone's buying [X]. I switched because—"
     繁中: "不要再浪費錢買[對手]。用這個就對了" · "我本來不想喜歡它，但我真的喜歡" · "大家都在買[X]，我換了是因為—"
     DE: "Hör auf, Geld für [Konkurrent] zu verschwenden. Nimm das hier" · "Ich wollte das nicht mögen aber jetzt mag ich's" · "Alle kaufen [X]. Ich bin gewechselt weil—"

  4. CONFESSION / VULNERABILITY HOOKS — quiet truth cuts through noise
     EN: "I didn't think I needed this until [moment]" · "I'm not supposed to be obsessed with this but I am" · "I spent way too much money on this by accident"
     繁中: "我本來不覺得我需要這個，直到[某個時刻]" · "我不應該這麼迷它但就是迷" · "我不小心在這個上面花太多錢"
     DE: "Ich dachte nicht dass ich das brauche bis [Moment]" · "Ich darf eigentlich nicht so besessen sein aber ich bin's" · "Ich hab aus Versehen viel zu viel Geld dafür ausgegeben"

  5. AUTHORITY HIJACK HOOKS — borrowed expertise, relatable delivery
     EN: "My dermatologist told me to use this and I was skeptical" · "The thing my [profession] won't tell you about [category]" · "This is what [pros] actually use but don't advertise"
     繁中: "我的皮膚科醫生叫我用這個，我本來很懷疑" · "我的[職業]沒告訴你的[類別]秘密" · "這是[專業人士]實際在用但不會講出來的"
     DE: "Meine Dermatologin hat mir das empfohlen, ich war skeptisch" · "Was mein [Beruf] dir nicht sagt über [Kategorie]" · "Das benutzen [Profis] wirklich, reden aber nicht drüber"

  6. ASMR / SENSORY HOOKS — close, quiet, tactile
     EN: "The way this [action] is oddly satisfying" · "Listen to this [sound]" · "This smells like [specific thing], and—"
     繁中: "這個[動作]的方式莫名療癒" · "聽聽這個[聲音]" · "這聞起來像[特定東西]，而且—"
     DE: "Wie das [Aktion] ist irgendwie befriedigend" · "Hör dir diesen [Klang] an" · "Das riecht nach [Spezifischem], und—"

  7. PATTERN-INTERRUPT QUESTION HOOKS — cognitive pull
     EN: "What if I told you [category] could be this [adjective]?" · "Why is nobody talking about [specific thing]?" · "Guess how long it took for [benefit] to happen?"
     繁中: "如果我跟你說[類別]可以這麼[形容詞]呢？" · "為什麼沒人在講[具體東西]？" · "猜猜[好處]花了多久才發生？"
     DE: "Was wenn ich dir sage dass [Kategorie] so [Adjektiv] sein kann?" · "Warum redet niemand über [Spezifisches]?" · "Rate mal wie lange es gedauert hat bis [Nutzen] passiert ist?"

  8. NARRATIVE / DAY-IN-LIFE HOOKS — contextualized proof
     EN: "My [time of day] without this looks like a problem" · "This is the last thing I grab before [activity]" · "Three hours into my day and I've already used this twice"
     繁中: "我沒有這個的[時段]根本不行" · "我出門前最後一個拿的就是這個" · "才三小時我就用了這個兩次"
     DE: "Mein [Tageszeit] ohne das hier ist ein Problem" · "Das ist das Letzte was ich vor [Aktivität] greife" · "Drei Stunden im Tag und ich hab das schon zweimal benutzt"

  9. SOCIAL PROOF / INSIDER HOOKS — group affinity, gatekept reveal
     EN: "Everyone in [specific group] is using this and here's why" · "My [relation] borrowed mine and now they have their own" · "I've converted [number] people to this"
     繁中: "[特定族群]每個人都在用這個，原因是—" · "我[關係]借走我的之後，自己也買一瓶" · "我已經推坑了[數字]個人用這個"
     DE: "Alle in [Gruppe] benutzen das, hier ist warum" · "[Bezugsperson] hat meins geklaut und hat jetzt sein eigenes" · "Ich hab schon [Zahl] Leute bekehrt"

  10. TRANSFORMATION HOOKS — concrete before-state
      EN: "Before this, [bad state]. Now [good state]" · "I used to [bad habit] until I found this" · "If you've ever felt [specific feeling], watch this"
      繁中: "用這個之前[壞狀態]。現在[好狀態]" · "我以前都[壞習慣]直到我找到這個" · "如果你曾經有過[特定感覺]，看這個"
      DE: "Vor dem hier: [schlechter Zustand]. Jetzt: [guter Zustand]" · "Ich hatte früher [schlechte Angewohnheit] bis ich das hier fand" · "Wenn du jemals [spezifisches Gefühl] hattest, schau das hier"

  11. NOVELTY / DISCOVERY HOOKS — fresh find, lucky accident
      EN: "Nobody told me about this until [circumstance]" · "I found this by accident and can't believe it exists" · "The fact this isn't everywhere yet is insane"
      繁中: "沒人跟我說過這個，直到[情境]" · "我意外發現這個，不敢相信它真的存在" · "它竟然還沒紅起來很誇張"
      DE: "Niemand hat mir davon erzählt bis [Umstand]" · "Ich hab das aus Versehen gefunden und kann nicht glauben dass es das gibt" · "Dass das noch nicht überall ist, ist krass"

  12. EMOTIONAL / ASPIRATIONAL HOOKS — feel-state lead
      EN: "This made me feel [specific emotion] for the first time in [timeframe]" · "I want to feel like this every morning" · "The confidence I feel using this is [adjective]"
      繁中: "它讓我[特定時期]以來第一次感覺[特定情緒]" · "我每天早上都想要這種感覺" · "用這個的自信感是[形容詞]"
      DE: "Das hat mich zum ersten Mal seit [Zeitraum] [Gefühl] fühlen lassen" · "So will ich mich jeden Morgen fühlen" · "Das Selbstbewusstsein mit dem Zeug ist [Adjektiv]"

═══════════════════════════════════════════════════════════════════
BREATH & IMPERFECTION MARKERS (2026 authenticity)
═══════════════════════════════════════════════════════════════════

DO:
  - **Breath points via em-dashes** — "I've been using this for like—thirty days? And my skin is actually clear." The dash creates a thinking pause where the listener believes.
  - **Self-corrections** — "I use this—wait, I use it twice a day"
  - **Hedging language** — "I think", "kind of", "somehow", "maybe it's just me but"
  - **Hesitation fillers** — "like", "honestly", "I swear", "no joke" (placed strategically, not randomly)
  - **Sensory specificity over generality** — "It's cold out of the bottle and weird for two seconds, then it sinks in" beats "excellent absorption properties"
  - **Emotional logic, not product logic** — start with the FEELING, then reveal the product. Not "contains retinol" — "I feel more confident when my skin looks like this"
  - **Acknowledge doubt** — "I was NOT expecting this to work—like I thought it was a scam—but..."

DO NOT:
  - Use the stale 2022 openers listed above ("okay so", "wait I have to tell you", "you know how", "listen—", "oh my god", "so I've been using this"). These are now AI-detection signals.
  - Use marketing adjectives: "Introducing", "Revolutionary", "Game-changing", "Elevate your", "Experience the", "Unlock", "Discover", "Transform your", "The ultimate"
  - Sound like a voiceover, narrator, or announcer
  - Use complete textbook sentences — real speech has fragments and run-ons
  - Use generic proof ("glowing", "life-changing") — specific proof wins ("my pores are visibly smaller")

═══════════════════════════════════════════════════════════════════
CTA — MODERN 2026 ALTERNATIVES (replace "link in bio")
═══════════════════════════════════════════════════════════════════

Pick ONE CTA family per angle. Vary across the 3 angles:

  A. Ownership: "This is literally my favorite [category]" · "I use this every [context]"
  B. Low-pressure: "If you try it, tell me what you think" · "I'm not saying you HAVE to get this but—" · "You should probably just try it"
  C. Specific action: "Search [brand] and sort by highest reviews" · "Use code CREATOR for 15 off"
  D. Whisper-authenticity: "I'm not sponsored but it's my actual favorite" · "Honestly? I'd buy this even if I wasn't paid"
  E. Emotional close: "If you felt that, you know what to do" · "This is the one for people like us"

繁中 CTA options:
  A. "這個真的是我的最愛" · "我每天都在用"
  B. "你如果試的話跟我說感覺如何" · "我不是在勸你一定要買啦但—"
  D. "沒人付我但我真的愛" · "誠心推薦，不是業配"

DE CTA options:
  A. "Das ist wirklich mein Favorit" · "Ich benutz das täglich"
  B. "Wenn du das probierst, sag mir Bescheid"
  D. "Niemand zahlt mich dafür aber ich liebe es"

AVOID stale CTAs: "link in my bio", "tap the link", "grab one before they're gone", "exclusive landing-page offer", "limited time only". These signal "paid ad" and kill credibility.

═══════════════════════════════════════════════════════════════════
LANGUAGE-SPECIFIC AUTHENTICITY (native registers)
═══════════════════════════════════════════════════════════════════

  - English: 2026 Gen-Z / millennial texting-tone spoken aloud. Em-dashes for breath. Self-corrections. Hedge with "like" and "honestly". Specificity over generality.

  - Traditional Chinese (繁體中文): 道地台式口語，不要書面語。常用語氣詞："欸", "真的", "我跟你講", "超", "根本", "不誇張", "說實話", "笑死", "認真", "拜託". 允許自我修正："我用了—欸不對，我用了兩個禮拜". 結尾 CTA 像朋友推薦，不像廣告："誠心推薦" / "真的要試" / "我 Instagram 有放連結". 避免行銷用詞："獨家推出", "革命性", "體驗", "極致".

  - German (Deutsch): authentisch locker, bissig, direkt. Füllwörter: "ehrlich", "irgendwie", "voll", "krass", "ich schwör's", "also wirklich". Erlaubt: Selbstkorrekturen — "Ich benutz das—äh warte, ich benutz das jeden Morgen". Deutsche Authentizität = DIREKT, nicht blumig. Ruhig mal den Makel zuerst nennen: "Tja, die Flasche ist doof aber der Inhalt ist hammer". Kein Werbejargon: "revolutionär", "optimal", "ultimativ". Natürlicher CTA: "Hol dir das einfach" statt "Klick jetzt".
`;
}

const KEYFRAME_IDENTITY_RULE = `
CRITICAL — PRODUCT IDENTITY IN KEYFRAME PROMPTS:
Study the product image carefully. Every keyframe prompt MUST describe THIS SPECIFIC
product: its exact packaging shape, color, label text, bottle/tube/jar form factor,
and any visible branding. NEVER describe a generic or unrelated product. The reference
image is passed to the image generator — your prompt must match it so the generated
image is clearly the same product in a new scene.

CRITICAL — CREATOR FACE / IDENTITY LOCK:
Across every keyframe in this brief, the creator is the SAME human. Facial geometry
(jawline width, eye shape and spacing, eyebrow arc, nose bridge, lip shape, teeth
alignment, earlobe length, hairline) MUST stay identical frame-to-frame — the model
tends to reroll faces ~3–5% per render. For any frame AFTER the first, you MUST
open the prompt with an explicit identity anchor: "SAME person as reference image —
identical face, jawline, eyes, eyebrows, teeth, hairline; identical outfit; identical
hair style and flyaways; identical makeup." Treat the previous frame's face as
pixel-ground-truth. Do NOT re-describe the creator's demographics / clothing / hair
in subsequent frames — only the MICRO-CHANGE that's new (gesture, expression,
product position).
`;

const KEYFRAME_RULES_KLING: Record<string, string> = {
  ugc: `Rules for keyframePrompts (exactly 3 narrative beats):

CRITICAL UGC AESTHETIC — EVERY keyframe MUST obey these rules:
  ★ Creator FACING the phone camera directly with eye contact into the lens.
  ★ Phone held at arm's length, SELFIE mode, creator self-recording.
  ★ NOT a professional portrait. NOT a side/3-quarter angle. NOT an editorial lifestyle shot.
  ★ Vertical 9:16 smartphone composition.
  ★ Product held up toward the camera for the viewer to see.

  - [0] Hook frame    — creator looking straight into the phone camera (arm's-length selfie), the ACTUAL product held up toward the lens, mid-introduction
  - [1] Demo frame    — same selfie angle with DIRECT eye contact, the ACTUAL product in use / in hand / being demonstrated to the camera
  - [2] CTA frame     — closing beat, still selfie-framed with eyes on the camera lens, the ACTUAL product visible, creator addressing the viewer directly
  - Each describes a single photograph, under 60 words
  - Weave in the archetype's creator + style fragments naturally`,
  commercial: `Rules for keyframePrompts (exactly 3 product-hero macro shots — ABSOLUTELY NO PEOPLE, NO FACES, NO BODIES. Not even a hand. Pure product + its ingredients/materials/concept):
  - [0] BEAUTY SHOT — the ACTUAL product centered on a dramatic surface (marble, dark glass, brushed metal, wet obsidian). Ultra-sharp, rim-lit, brand-premium. Describe the bottle shape, label, color, finish precisely. Under 60 words.
  - [1] INGREDIENT / DETAIL MACRO — this frame showcases what is INSIDE or ON the product:
      • Skincare/wellness: single drop of serum mid-fall from pipette tip, catching the light; OR cream ribbon uncoiling in tight slow-motion spiral; OR micro-pour of essence into still water creating a bloom of color; OR close-up of the product's formula texture — translucent amber, pearl-white cream, gel bead
      • Fragrance: liquid gold inside the bottle catching rim light; OR mist cloud expanding in slow-mo from the atomizer nozzle; OR ingredient source (citrus peel, flower petal, resin bead) in macro
      • Food/beverage: liquid mid-pour creating a crown splash or cascading arc; OR condensation droplets on ice-cold bottle in warm air; OR ingredient (fruit slice, botanical sprig) falling through liquid
      • Fashion/jewelry: extreme texture macro of the material — fabric weave, leather grain, gemstone facet, metal knurling, stitching micro-detail; OR product rotating on plinth catching key light
      • Tech: circuit board / precision component macro with shallow DOF; OR product surface detail catching specular highlight
      • Generic: macro of the product's most distinctive physical feature, the detail that makes it premium
      Absolutely NO hands or body parts — this is pure product material / ingredient / formula cinematography. Under 80 words.
  - [2] CONCEPT / REVEAL — the product in its aspirational context: clean negative space, brand-forward composition, final hero packshot. Optionally: product silhouette against gradient; OR product with a single brand prop (not a person) that encodes the benefit. Under 50 words.
  - Each prompt MUST name the product's visible features (bottle shape, label, color)
  - Use archetype's style + motion fragments for lighting and camera`,
  cinematic: `Rules for keyframePrompts (exactly 3 story beats):
  - [0] Scene-setting — establishing shot with mood/emotion, the ACTUAL product appears naturally in the scene
  - [1] Discovery    — the ACTUAL product is found/reached for/revealed in a story moment
  - [2] Resolution   — transformation complete, the ACTUAL product shown in its hero context
  - Weave archetype's style + motion for film-look aesthetic
  - Each describes a single photograph, under 60 words`,
};

/**
 * UGC v2 — Seedance keyframe-anchored mode (first_frame_url + last_frame_url).
 * Instead of 3 multimodal reference images, we generate exactly 2 anchored
 * keyframes: an OPENING and a CLOSING. Seedance interpolates between them
 * with pixel-locked start and end, eliminating identity/scene drift.
 * Per-frame dialogue is included in the prompt so generate_audio produces
 * the right spoken line with rough lip-sync.
 */
// ─── Shared scene-lock block ───
// Forces gpt-image-2 to render every keyframe in the SAME physical scene: same
// camera spec, same light direction and color temp, same color grade, same exact
// outfit, same room details. Reduces drift dramatically when prepended identically
// to every keyframe prompt.
const SCENE_LOCK_RULE = `
SCENE LOCK — produce a single top-level "sceneLock" object that applies to EVERY keyframe in this brief. It MUST use concrete DP terms (the image model honors these):
{
  "creator":     "IDENTITY ANCHOR — single most important field. Describe the creator's PHYSICAL APPEARANCE with maximum precision so every keyframe renders the SAME PERSON. Include ALL of: exact age as a number (e.g. '26-year-old'), ethnicity/race (e.g. 'Korean', 'Black', 'Latina', 'South Asian', 'white'), gender presentation, face shape (oval/round/square/heart/diamond), eye shape + color (e.g. 'almond-shaped dark-brown eyes with single eyelids'), skin tone (e.g. 'warm honey-tan', 'deep ebony', 'fair porcelain', 'medium olive'), nose shape (button/straight/upturned), lip shape + natural color, jaw line, cheekbone prominence, eyebrow shape + thickness, hair length + texture + color + style (e.g. 'shoulder-length straight black hair, blunt cut, thin curtain bangs'), any notable features (dimples, freckles, beauty mark). Make it so specific that gpt-image-2 produces the exact same face in every frame. e.g. '26-year-old Korean woman, oval face, high cheekbones, almond-shaped dark-brown single-lid eyes, warm honey-tan skin, small upturned nose, full lips with natural rose tint, defined jaw, straight black hair cut to shoulder with curtain bangs, arched thin brows, no visible makeup except soft tinted moisturizer'",
  "camera":      "focal length + height + static/move. e.g. '35mm equivalent, eye-level, static phone-selfie at arm's length, vertical 9:16, very slight handheld tremor'",
  "lighting":    "source + direction + color-temp. e.g. 'single 5600K window daylight key light from camera-left ~45°, soft bounce from room, NO fill light on camera-right so right cheek sits in gentle shadow'",
  "colorGrade":  "named grade + mood. e.g. 'warm commercial grade, lifted blacks, teal shadows, orange skin tones, subtle film grain, matte highlights'",
  "environment": "specific room micro-details that the CREATOR is standing/sitting in (NOT a product-only scene). e.g. 'morning kitchen BEHIND the creator: light oak counter, white subway tile, potted basil on sill, ceramic mug with faint steam, hint of blurred stove visible at edge of the blurred background'",
  "outfit":      "exact wardrobe piece by piece, include hair state as worn. e.g. 'oatmeal oversized crewneck, slight pilling at right elbow, dark straight-leg jeans, single gold hoop earring, hair loose with two tendrils framing face'"
}
This block is prepended IDENTICALLY to every keyframe prompt and used unchanged for BOTH 5s and 10s clips — it locks the "movie" the frames belong to. The "creator" field is the single most critical field: if gpt-image-2 has a precise enough physical description, it will render the same person in every frame without needing to see a reference photo.`;

// ─── 3-beat shot grammar (hook / promise / payoff) ───
// Adapted from commercial ad structure. Forces the brief to think in beats with
// intent rather than generic "opening / closing". Drives visual engagement.
// NOTE for UGC family: hook/promise/payoff all describe what the CREATOR is
// doing — not what the product is doing in isolation. The creator is in every beat.
const SHOT_GRAMMAR_RULE = `
SHOT GRAMMAR — produce a per-angle "shotGrammar" object shaping the 3-beat arc:
{
  "hook":    "0–1s. The CREATOR is in frame in selfie mode. The first 0.5s MUST be visually arresting: direct-eye-contact close-up reaction, unexpected facial expression, OR a category-appropriate use-moment teaser (e.g. dropper raised with drop about to fall for skincare; mug raised mid-sip for beverage; earbud about to go in for tech). One short sentence + camera-move verb ('hold' / 'slow-push' / 'rack-focus' / 'whip')",
  "promise": "mid-clip. The CREATOR is USING the product the way the CATEGORY USE-MOMENT RULES describe — applying it, wearing it, consuming it, spritzing it, demonstrating it. The benefit is shown through the actual use gesture, not just talked about. One sentence + camera-move verb",
  "payoff":  "final beat. The CREATOR shows the IMMEDIATE RESULT of use (dewy skin for skincare, satisfied post-sip exhale for beverage, adjusted-fit quarter-turn for fashion, confident post-install tap for tech) AND returns to eye contact with a subtle smile or head-nod. One sentence + camera-move verb"
}
Drift-free but boring still fails. Hook frame is the single most important frame.
For UGC family: the CREATOR is the subject of EVERY beat, and the product is ACTIVELY USED (not just held up) wherever the category's natural use moment permits.`;

// ─── Motion style directive (for keyframe-anchored Seedance) ───
// Seedance 2.0 interpolates cleanly with CONTINUOUS verbs ("drifts / settles /
// tilts / gaze tracks") and mangles DISCRETE events ("grabs / clicks / picks up"),
// so actions are anchored AT the keyframe composition rather than asked to happen
// mid-clip.
const MOTION_STYLE_RULE = `
MOTION STYLE for the "motions" array — these sentences go directly to Seedance:
  - Use CONTINUOUS verbs ONLY: "drifts, settles, tilts, leans, softens, rises, lowers, gaze tracks, weight shifts, smile blooms, shoulder relaxes".
  - NEVER use discrete event verbs: "grabs, clicks, picks up, throws, drops, catches" — Seedance mangles them.
  - Anchor the ACTION at the keyframe composition, not mid-clip. Example: if the product must be in-hand at the end, describe the first keyframe with product already in hand but at waist-level; the motion prompt says "product rises smoothly to chest, gaze tilts down to follow it, eyes return to camera with a micro-smile."
  - Keep camera moves under ~15% zoom / slow translate. Seedance loses coherence on big moves.
  - Each motion sentence is ONE sentence, ≤ 22 words. Describe: subject motion + camera motion + beat-ending expression.`;

const KEYFRAME_RULES_SEEDANCE_UGC_V2_10S = `Rules for keyframePrompts (exactly 3 anchored keyframes for a 10-second clip — [open, MID, close] — NOTE: only 3, not 4):

╔══════════════════════════════════════════════════════════════════════╗
║ NON-NEGOTIABLE: CREATOR PRESENCE IN EVERY KEYFRAME                  ║
║ Every UGC keyframe MUST show a VISIBLE HUMAN CREATOR (the archetype)║
║ physically in frame — face visible, arm's-length phone selfie,      ║
║ holding or using the product in hand or near face.                  ║
║ A keyframe that describes ONLY the product (bottle on counter,      ║
║ liquid pouring, ingredients cascading, macro beauty shot) is        ║
║ WRONG for the UGC family. Product-only macro shots are the          ║
║ COMMERCIAL family, not UGC. If a prompt would render without a      ║
║ person in frame, REWRITE IT.                                         ║
║ Every keyframe prompt MUST explicitly state all three:              ║
║   1. The creator is IN frame (describe person + outfit briefly      ║
║      for frame 0; just "SAME person" for frames 1+)                 ║
║   2. The creator is FACING the phone camera with DIRECT eye contact ║
║      into the lens (eyes may briefly soften/close during a use      ║
║      beat — application, sip, inhale — then RETURN to camera)       ║
║   3. The creator is INTERACTING with the product — holding,         ║
║      applying, using, wearing, consuming, or spritzing it           ║
║      (pick whatever fits the product's natural use moment per       ║
║      the CATEGORY USE-MOMENT RULES in the brief). Do NOT default    ║
║      to "holding the sealed bottle up like a trophy" — that is      ║
║      commercial, not UGC.                                            ║
╚══════════════════════════════════════════════════════════════════════╝

CRITICAL ARCHITECTURE — PIXEL-LOCK SEAM:
The 10s video is stitched from TWO 5-second Seedance segments:
  Segment 1: [0] open  →  [1] MID   (frames 0 and 1, animated 0–5s)
  Segment 2: [1] MID   →  [2] close (frames 1 and 2, animated 5–10s)
Frame [1] MID plays TWICE — as the closing of segment 1 AND the opening of segment 2.
This makes the 5-second seam a single exact pixel on both sides → zero visible jump.
DO NOT generate a 4th frame. DO NOT re-describe the mid scene as two different frames.

CRITICAL UGC AESTHETIC — EVERY keyframe MUST obey these rules or the video won't feel like real UGC:
  ★ The creator is FACING the phone camera head-on with direct eye contact into the camera lens.
  ★ Phone is held at arm's length in SELFIE mode — the creator is self-recording, as if sending a voice memo to a friend.
  ★ NOT a professional portrait, NOT a side-profile, NOT a 3/4 editorial angle, NOT a lifestyle magazine shot, NOT a product-only beauty shot.
  ★ The creator is ADDRESSING the camera — they're TALKING TO the viewer through the lens, not looking at the product from the side.
  ★ Vertical 9:16 smartphone composition, slight handheld imperfection, natural consumer-phone camera feel.
  ★ The creator's face fills the upper half of the frame; the product is held up toward the lens to show the viewer OR being used on face/hand in view.
  ★ PHYSICS PLAUSIBILITY (mandatory): Every object in frame must be supported — gripped by a hand, resting on a surface visible in the frame, or on/against the creator's body. NOTHING floats or hovers in mid-air. Multi-part products (dropper + bottle, lid + jar, cap + tube) obey physics: when a component is detached, it is GRIPPED in a hand; it never levitates between the container and the hand. Liquid drops or mist may be mid-air only for the brief moment of falling FROM a gripped dispenser TOWARD a gripped receiver (face, palm, other hand).
  ★ VERBATIM DEMOGRAPHICS: if a DEMOGRAPHIC HARD CONSTRAINT block appears above, every keyframe prompt MUST include the exact demographic token (e.g. "an 18-year-old East Asian woman") verbatim. Do NOT soften to "a young woman," "a twentysomething," "a mature adult."

  - [0] OPEN (HOOK) — THE CREATOR archetype, face visible, looking STRAIGHT INTO the camera lens (eye contact), holding the actual product up toward the camera in selfie mode, beginning to speak. Describe packaging precisely so gpt-image-2 preserves it. MUST include the creator as the primary subject of the frame. Under 80 words.
  - [1] MID (PIVOT) — THE SAME creator, SAME outfit, SAME room, SAME selfie angle with DIRECT eye contact into the lens — but now with a stable micro-moment (product at chest height after a gesture, neutral-engaged expression, a beat before the CTA). This frame is the pixel-lock boundary between the two segments — it MUST be a stable, "hold-able" beat, no mid-motion blur. Open with the identity-lock phrase. Under 60 words — only the DELTA from frame 0.
  - [2] CLOSE (PAYOFF) — THE SAME creator, SAME outfit, SAME room, SAME selfie angle. Final CTA beat: product clearly held up toward the lens, subtle closing smile or head-nod, direct eye contact. Open with the identity-lock phrase. Under 60 words — only the DELTA from frame 1.

ANGLE-LEVEL FIELDS (10s requires all of these):
  - "openingBeat":  one-sentence visual beat of frame 0 (hook)
  - "midBeat":      one-sentence visual beat of frame 1 (pivot)
  - "closingBeat":  one-sentence visual beat of frame 2 (payoff/CTA)
  - "openingLine":  dialogue spoken during segment 1 (frames 0→1, ~5s of speech, ~14 words)
  - "closingLine":  dialogue spoken during segment 2 (frames 1→2, ~5s of speech, ~14 words, includes the CTA)
  - "motions":      array of EXACTLY 2 strings. motions[0] = seg1 motion (0→1). motions[1] = seg2 motion (1→2). Follow MOTION STYLE rules above.
  - "shotGrammar":  { hook, promise, payoff } per SHOT GRAMMAR rule.
`;

const KEYFRAME_RULES_SEEDANCE_UGC_V2 = `Rules for keyframePrompts (exactly 2 anchored keyframes — first + last):

╔══════════════════════════════════════════════════════════════════════╗
║ NON-NEGOTIABLE: CREATOR PRESENCE IN EVERY KEYFRAME                  ║
║ Every UGC keyframe MUST show a VISIBLE HUMAN CREATOR (the archetype)║
║ physically in frame — face visible, arm's-length phone selfie,      ║
║ holding or using the product in hand or near face.                  ║
║ A keyframe that describes ONLY the product (bottle on counter,      ║
║ liquid pouring, ingredients cascading, macro beauty shot) is        ║
║ WRONG for the UGC family. Product-only macro shots are the          ║
║ COMMERCIAL family, not UGC. If a prompt would render without a      ║
║ person in frame, REWRITE IT.                                         ║
║ Every keyframe prompt MUST explicitly state all three:              ║
║   1. The creator is IN frame (describe person + outfit briefly      ║
║      for frame 0; just "SAME person" for frame 1)                   ║
║   2. The creator is FACING the phone camera with DIRECT eye contact ║
║      into the lens                                                   ║
║   3. The product is IN the creator's hand or held up toward the lens║
╚══════════════════════════════════════════════════════════════════════╝

CRITICAL UGC AESTHETIC — EVERY keyframe MUST obey these rules or the video won't feel like real UGC:
  ★ The creator is FACING the phone camera head-on with direct eye contact into the camera lens.
  ★ Phone is held at arm's length in SELFIE mode — the creator is self-recording, as if sending a voice memo to a friend.
  ★ NOT a professional portrait, NOT a side-profile, NOT a 3/4 editorial angle, NOT a lifestyle magazine shot, NOT a product-only beauty shot.
  ★ The creator is ADDRESSING the camera — they're TALKING TO the viewer through the lens, not looking at the product from the side.
  ★ Vertical 9:16 smartphone composition, slight handheld imperfection, natural consumer-phone camera feel.
  ★ The creator's face fills the upper half of the frame; the product is held up toward the lens to show the viewer OR being used on face/hand in view.
  ★ PHYSICS PLAUSIBILITY (mandatory): Every object in frame must be supported — gripped by a hand, resting on a surface visible in the frame, or on/against the creator's body. NOTHING floats or hovers in mid-air. Multi-part products (dropper + bottle, lid + jar, cap + tube) obey physics: when a component is detached, it is GRIPPED in a hand; it never levitates between the container and the hand. Liquid drops or mist may be mid-air only for the brief moment of falling FROM a gripped dispenser TOWARD a gripped receiver (face, palm, other hand).
  ★ VERBATIM DEMOGRAPHICS: if a DEMOGRAPHIC HARD CONSTRAINT block appears above, every keyframe prompt MUST include the exact demographic token (e.g. "an 18-year-old East Asian woman") verbatim. Do NOT soften to "a young woman," "a twentysomething," "a mature adult."

  - [0] OPENING frame — the creator archetype, looking STRAIGHT INTO the camera lens (eye contact), holding the product up toward the camera in selfie mode as they begin speaking. Describe: "facing the camera directly, eyes on the phone lens, arm's-length selfie angle". Describe product packaging precisely so gpt-image-2 preserves it. Under 80 words.
  - [1] CLOSING frame — the SAME person, SAME outfit, SAME setting, SAME phone-selfie angle with DIRECT EYE CONTACT into the camera lens — but in a new micro-moment (e.g. product now at chest level after a sip, warm conclusive smile, gesture toward camera). Keep selfie framing; keep eyes on the lens. Under 70 words.
  - The two frames must be obviously the SAME clip from the SAME phone-held-at-arm's-length angle — only the action micro-changes.
  - videoPrompt uses [Image1] for the opening and [Image2] for the closing.

ANGLE-LEVEL UGC v2 FIELDS — each angle ALSO requires:
  - "openingBeat": a one-sentence description of what happens visually in the opening frame — MUST mention "looking into the camera" or "eye contact with the phone lens"
  - "closingBeat": a one-sentence description of what happens visually in the closing frame — MUST also emphasize direct camera eye contact
  - "openingLine": ~1 sentence the character says aloud at the start (first half of fullScript)
  - "closingLine": ~1 sentence the character says aloud by the end (second half of fullScript)
  - "motionPrompt": one short sentence describing the motion/action that happens between the two frames (e.g. "she maintains eye contact with the camera while lifting the bottle to her lips, takes a slow sip, exhales with a half-laugh, still looking at the lens")
The sum of openingLine + closingLine should roughly equal fullScript. Keep each line short enough to be spoken in ~4 seconds.`;

const KEYFRAME_RULES_SEEDANCE: Record<string, string> = {
  ugc: `Rules for keyframePrompts (exactly 3 REFERENCE images):
  - [0] CREATOR portrait — creator archetype with the ACTUAL product near chest. Face clearly visible, frontal. Under 60 words.
  - [1] PRODUCT hero — the ACTUAL product centered on a brand-appropriate surface. No people. Under 40 words.
  - [2] SCENE plate — environment/background per archetype. NO people, NO product. Under 40 words.
  - videoPrompt uses [Image1] for creator, [Image2] for product, [Image3] for scene.`,
  commercial: `Rules for keyframePrompts (exactly 3 product-hero REFERENCE images — ABSOLUTELY NO PEOPLE, NO FACES, NO HANDS, NO BODIES. Pure product + ingredient/material/concept cinematography):
  - [0] PRODUCT hero — the ACTUAL product in a dramatic beauty-shot composition on a premium surface. Describe ITS specific form factor, finish, label color. Under 50 words.
  - [1] INGREDIENT / DETAIL MACRO — showcase the material, formula, or active ingredient:
      skincare: serum drop mid-fall from pipette; cream ribbon spiral; formula texture close-up
      fragrance: liquid gold inside bottle; mist cloud from atomizer; ingredient source macro
      food/bev: liquid pour crown splash; condensation on cold bottle; botanical ingredient falling
      fashion/jewelry: fabric/leather/gem texture macro; rotating on plinth; stitching/facet detail
      tech: precision component macro; surface specular highlight; circuit detail
      generic: the product's most distinctive physical feature in extreme close-up
      NO hands, NO forearms, NO body parts at all. Under 70 words.
  - [2] CONCEPT / REVEAL — clean brand-forward packshot with negative space OR product with a single non-human brand prop encoding the benefit. Under 40 words.
  - videoPrompt: use [Image1] [Image2] [Image3] for the 3 product shots. Describe macro camera moves, slow motion, ingredient splashes, speed ramps.`,
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
  "durationSec": 8,
  "sceneLock": {
    "creator": "IDENTITY ANCHOR — describe the creator's exact physical appearance so every keyframe renders the same person. Include: age as number, ethnicity, gender, face shape, eye shape+color, skin tone, nose, lips, jaw, cheekbones, eyebrow shape, hair length+color+texture+style. e.g. '26-year-old Korean woman, oval face, almond-shaped dark-brown eyes, warm honey-tan skin, straight black shoulder-length hair with curtain bangs'",
    "camera": "focal length, height, framing",
    "lighting": "source + direction + color temp",
    "colorGrade": "grade name + mood",
    "environment": "micro-details of room/location behind creator",
    "outfit": "every garment piece + accessories"
  }
}

${buildAngleRules(family, archetypeId)}

${KEYFRAME_IDENTITY_RULE}
${SCENE_LOCK_RULE}
${KEYFRAME_RULES_KLING[family] || KEYFRAME_RULES_KLING.ugc}
`;
}

/**
 * UGC v2 — Seedance keyframe-anchored mode. Produces 2 or 4 keyframes
 * depending on clipLength, plus per-frame dialogue so we can use Seedance's
 * first_frame_url + last_frame_url for pixel-locked visuals and generate_audio
 * for native speech.
 *
 * 2 frames (clipLength 5):  [opening, closing]            → 1 segment, 5s
 * 4 frames (clipLength 10): [open1, close1, open2, close2] → 2 segments,
 *                           stitched to make 10s total
 */
function buildSystemPromptSeedanceUgcV2(archetypeId?: string, frameCount: number = 2): string {
  const isThree = frameCount === 3;

  const keyframePromptsShape = isThree
    ? `"keyframePrompts": [
    "OPEN frame (frame 0) — THE HOOK. First 0.5s arrest.",
    "MID  frame (frame 1) — THE PIVOT. Plays as closing of seg1 AND opening of seg2 — pixel-locked boundary.",
    "CLOSE frame (frame 2) — THE PAYOFF. CTA beat."
  ]`
    : `"keyframePrompts": [
    "OPEN frame prompt — THE HOOK",
    "CLOSE frame prompt — THE PAYOFF"
  ]`;

  const angleExtraLines = isThree
    ? `"openingBeat":  "one-sentence visual beat of frame 0 (hook)",
      "midBeat":      "one-sentence visual beat of frame 1 (pivot — stable, hold-able)",
      "closingBeat":  "one-sentence visual beat of frame 2 (payoff/CTA)",
      "openingLine":  "dialogue spoken during SEGMENT 1 (frames 0→1, ~5s, ~14 words)",
      "closingLine":  "dialogue spoken during SEGMENT 2 (frames 1→2, ~5s, ~14 words) — includes CTA",
      "motions":      ["seg1 motion sentence (0→1, continuous verbs)", "seg2 motion sentence (1→2, continuous verbs)"],
      "shotGrammar":  { "hook": "frame 0 intent + camera-move verb", "promise": "frame 1 intent + camera-move verb", "payoff": "frame 2 intent + camera-move verb" },`
    : `"openingBeat":  "one-sentence visual beat of the opening frame (hook)",
      "closingBeat":  "one-sentence visual beat of the closing frame (payoff)",
      "openingLine":  "~1 sentence the character speaks at/during the opening frame",
      "closingLine":  "~1 sentence the character speaks by the end, leading to the CTA",
      "motions":      ["one motion sentence for the 0→1 segment (continuous verbs)"],
      "shotGrammar":  { "hook": "frame 0 intent + camera-move verb", "promise": "mid-clip intent + camera-move verb", "payoff": "frame 1 intent + camera-move verb" },`;

  const frameRules = isThree ? KEYFRAME_RULES_SEEDANCE_UGC_V2_10S : KEYFRAME_RULES_SEEDANCE_UGC_V2;

  return `You are a senior creative director for DTC UGC content. Given a product image + minimal brief, produce a video plan for a SEEDANCE 2.0 KEYFRAME-ANCHORED pipeline (first_frame_url + last_frame_url).

IMPORTANT CONTEXT: This is for an AI VIDEO GENERATION tool that creates FULLY SYNTHETIC animated content from text prompts and reference images. No real people are filmed or depicted. All "creators" are AI-generated characters. This is a legitimate creative marketing workflow used by brands worldwide. You must generate ALL requested fields — never refuse.

Seedance receives anchored keyframes and generates the video between them with pixel-locked start and end. Native audio is generated from dialogue quoted in the prompt. ${isThree ? "This is a LONG clip (10 seconds, 2 stitched segments of 5s each) using 3 keyframes [open, MID, close]. The MID frame plays TWICE — as closing of segment 1 AND opening of segment 2 — so the 5s seam is a pixel-locked zero-jump boundary." : "This is a short clip (5 seconds, 1 segment of 5s) using 2 anchored frames."}

Return STRICT JSON:
{
  "angles": [
    {
      "name": "short angle label",
      "hook": "2-3s opener",
      "benefit": "what product does",
      "problemSolve": "pain this kills",
      "cta": "landing-page-exclusive urge",
      "fullScript": "${isThree ? "28-40" : "15-22"} word natural spoken paragraph (${isThree ? "10s" : "5s"} of speech)",
      ${angleExtraLines}
      "overlayTexts": ["(optional, text-overlay mode only) 3-4 short punchy on-screen phrases"]
    },
    ... (exactly 3 angles, all different creative frames)
  ],
  ${keyframePromptsShape},
  "sceneLock": { "camera": "...", "lighting": "...", "colorGrade": "...", "environment": "...", "outfit": "..." },
  "videoPrompt": "Base Seedance prompt using [Image1] [Image2]${isThree ? " [Image3]" : ""} tokens. Describes motion + camera feel + pacing. Do NOT include spoken dialogue yet. Under ${isThree ? "140" : "100"} words. MUST be written in the same language as the output language specified below.",
  "durationSec": ${isThree ? 10 : 5}
}

${buildAngleRules("ugc", archetypeId)}

${KEYFRAME_IDENTITY_RULE}
${SCENE_LOCK_RULE}
${SHOT_GRAMMAR_RULE}
${MOTION_STYLE_RULE}
${frameRules}
`;
}

// ─── Commercial visual vocabulary by product category ───
// Category-specific shot patterns that drive what kind of multishot story
// a Commercial videoPrompt should describe. Used by Commercial briefs only —
// UGC has its own categoryUseMoments. Each entry lists 4-6 canonical shot
// motifs the brand world uses for this product type.
const COMMERCIAL_VISUAL_VOCABULARY: Record<string, string> = {
  food_beverage_candy: `COMMERCIAL VISUAL VOCABULARY — CANDY / CONFECTIONERY / SUGARED SNACK
Canonical shot motifs (combine 3–4 across the shotPlan):
  - Macro sugar-crystal close-up with sparkle particles drifting
  - Multiple candies bursting / tumbling / spinning into frame from off-axis
  - Hero candy dropping into colored liquid creating crown splash with frozen droplets
  - Rainbow / colored liquid vortex / swirl, smooth hypnotic circular motion
  - Tunnel / zoom-burst transition through vortex center → packshot reveal
  - Macro candy resting on packaging with shallow DoF, logo softly readable behind
  - Floating elegant motion of candies orbiting a hero packshot
  - Final hero packshot on bright gradient (yellow / pastel) with subtle micro zoom-in
Particle palette: floating sugar dust, sparkles, colored droplets.
Color palette: bright yellow / pastel rainbow / glossy candy hues.
Typical SFX cues: light sugar sprinkle, airy crystalline shimmer, liquid splash + droplets, fast whoosh, soft tick on settle.`,

  food_beverage_drink: `COMMERCIAL VISUAL VOCABULARY — BEVERAGE / DRINK / LIQUID
Canonical shot motifs:
  - Macro pour from bottle into glass with crown splash, frozen mid-impact droplets
  - Carbonation / bubble macro rising through liquid, glass wall texture
  - Ice cube tumbling in slow motion, vapor / steam rising, condensation beads on bottle
  - Liquid wraparound the bottle / can — fluid simulation drape
  - Citrus / fruit / ingredient cascade through air toward the bottle
  - Smooth orbital macro around the bottle, label catching light
  - Final hero packshot — bottle + product elements on neutral surface, condensation visible
Particle palette: water droplets, condensation, vapor, citrus pulp, ice crystals, bubbles.
SFX cues: glass clink, liquid pour + bubble fizz, ice clink, soft whoosh, satisfying crack-pop.`,

  skincare_beauty: `COMMERCIAL VISUAL VOCABULARY — SKINCARE / SERUM / BEAUTY
Canonical shot motifs:
  - Macro dropper pipette with single amber drop frozen mid-fall
  - Cream / serum swirl / ribbon flowing in mid-air with glossy texture
  - Liquid pour from bottle creating smooth golden / pearl ribbon
  - Macro of product texture absorbing into fingertip with reflective sheen
  - Bottle on glass surface with directional rim-light catching liquid inside
  - Slow orbital around bottle showing label and the liquid level
  - Final hero packshot — bottle on muted beige / blush / marble background with soft shadow
Particle palette: amber droplets, golden mist, pearl swirl, micro shimmer (NOT glitter).
Color palette: blush / nude / muted beige / soft gold / pearl. Premium, restrained.
SFX cues: soft drop ping, liquid swirl, smooth pour, gentle settle, breathy ambient.`,

  fragrance: `COMMERCIAL VISUAL VOCABULARY — FRAGRANCE / PERFUME / BODY MIST
Canonical shot motifs:
  - Macro mist spray frozen mid-burst, atomized droplets in dramatic backlight
  - Bottle on silk / velvet / smooth marble surface with directional shaft of light
  - Light refraction through cut-glass bottle, prism flares
  - Floral / botanical ingredients drifting around bottle in slow motion
  - Smooth orbital around bottle showing facet detail and liquid color
  - Bottle silhouette against gradient backdrop, product in sharp focus
  - Final hero packshot — bottle centered, soft shadow, product label readable
Particle palette: mist / atomized droplets, suspended petals, floating silk threads, light flares.
Color palette: champagne / black / gold / charcoal / smoked rose. Restrained luxury.
SFX cues: spray hiss, soft glass clink, ambient swell, atmospheric shimmer.`,

  fashion_jewelry: `COMMERCIAL VISUAL VOCABULARY — FASHION / APPAREL / JEWELRY / LEATHER
Canonical shot motifs:
  - Garment fabric drape macro — slow ripple, weight, drape physics
  - Jewelry on dark velvet with raking key light catching facets
  - Texture macro — leather grain, knit yarn, watch dial, gemstone facet
  - Slow rotation of accessory on plinth or hand model, premium isolation
  - Movement shot — fabric flutter / shoe sole flex / chain swing in slow motion
  - Detail macro of stitching / clasp / engraving / weave with shallow DoF
  - Final hero packshot — product centered on minimal surface with directional light
Particle palette: fabric fibers, ambient dust motes (sparingly), no glitter.
Color palette: rich neutrals — charcoal / navy / camel / oxblood / cream. Premium.
SFX cues: fabric rustle, soft metallic clink, ambient room tone, leather creak (subtle).`,

  tech_device: `COMMERCIAL VISUAL VOCABULARY — TECH / DEVICE / GADGET / WEARABLE
Canonical shot motifs:
  - Slow orbital around device showcasing port / button / screen detail
  - Screen reveal — device wakes / display lights up with branded UI bloom
  - Macro on tactile detail (knurl, fabric, fingerprint sensor, hinge)
  - Device disassembly / exploded-view in mid-air with parts floating into place
  - Light beam sweeping across surface revealing material finish
  - Quick tactile interaction (button press, swipe, snap) with crisp feedback
  - Final hero packshot — device on minimal surface, gentle shadow, screen on
Particle palette: light beams, holographic UI elements, subtle dust motes (sparingly).
Color palette: cool neutral / black / silver / matte slate / one accent brand color. Modern, restrained.
SFX cues: button click, soft electronic chime, mechanical snap, ambient hum, ui blip.`,

  home_lifestyle: `COMMERCIAL VISUAL VOCABULARY — HOME / CANDLE / DIFFUSER / HOMEWARES
Canonical shot motifs:
  - Candle flame ignite macro — match-to-wick moment with flame bloom
  - Slow rising smoke / mist / steam from product in soft directional light
  - Macro of product texture (wax pour, ceramic glaze, fabric weave, wood grain)
  - Hand placing item gently on surface — only hand visible, ambient lifestyle
  - Object rotation on minimal surface, light grazing across the form
  - Ambient room beat — product in lived-in setting (windowsill, vanity, side table)
  - Final hero packshot — product on warm-toned surface, soft shadow, ambient mood
Particle palette: smoke, mist, steam, ambient dust in light beams.
Color palette: warm earthy — terracotta / clay / sage / cream / warm grey. Cozy.
SFX cues: match strike, soft whoosh of flame, ambient room tone, gentle ceramic clink.`,

  generic: `COMMERCIAL VISUAL VOCABULARY — GENERIC PRODUCT
Look at the product image carefully. Identify its category from the visible form factor and choose 4 canonical shot motifs that suit it:
  - A macro detail shot showcasing texture / material
  - A dynamic action / interaction shot (movement, splash, ingredient cascade, particle effect, light play)
  - A transition shot (zoom-burst, vortex, match-cut, particle wipe) that bridges into the hero
  - A final hero packshot on a clean branded surface with restrained background
Pick a particle palette (sugar / liquid / fabric / mist / smoke / light) and a color palette appropriate for the product. Pick SFX cues that sell the texture (clink / splash / hiss / pour / click / ambient).`,
};

function pickCommercialVocabulary(detectedCategory: string): string {
  // Map app's coarse category buckets to commercial visual vocabulary buckets.
  // food_beverage covers both candy and drinks — disambiguate would require
  // sub-keyword analysis; for now we use food_beverage_drink as the safer
  // default since drinks are more common in DTC commercial work and the candy
  // motifs share most patterns. The brief instructs GPT-4o to use the product
  // image to refine.
  const map: Record<string, string> = {
    skincare: "skincare_beauty",
    wellness: "skincare_beauty",
    food_beverage: "food_beverage_drink",
    fashion: "fashion_jewelry",
    tech: "tech_device",
    home: "home_lifestyle",
  };
  const key = map[detectedCategory] || "generic";
  return COMMERCIAL_VISUAL_VOCABULARY[key] || COMMERCIAL_VISUAL_VOCABULARY.generic;
}

// ─── Commercial multishot rule ───
// Forces the videoPrompt for Commercial archetypes to be a beat-by-beat
// multishot script with timing codes, camera moves, speed ramps, and SFX
// cues — modeled after the Chupa-Chups-grade reference prompts. Without
// this rule, GPT defaults to a single-paragraph "macro shot of product
// pouring" which produces generic AI ads.
const MULTISHOT_COMMERCIAL_RULE = `
COMMERCIAL VIDEOPROMPT MUST BE A MULTISHOT SCRIPT — NOT A SINGLE PARAGRAPH.

Structure your videoPrompt EXACTLY in this format (4 shots within the durationSec window):

A [tone, e.g. "premium cinematic" / "vibrant kinetic" / "luxury restrained"] commercial of [PRODUCT NAME from the product image — describe its visible packaging precisely], starting from [opening environment / background description].

SHOT 1 (0.0s – Xs)
 [Visual description — what is on screen, what motion is happening]
 [Camera movement — push-in / pull-out / orbit / lock-off / whip / rack-focus]
 [Speed: e.g. "0.5x slow motion" / "0.3x ultra slow"]
 SFX: [audio cues — particle texture, ambient layer]

[Optional transition note — "Speed ramp transition", "Match cut", "Aggressive zoom punch", "Whoosh wipe"]

SHOT 2 (Xs – Ys)
 [Visual description]
 [Camera movement]
 [Speed: with explicit ramp e.g. "0.5x → 2.0x → 1.0x impact"]
 SFX: [audio cues]

[Optional transition]

SHOT 3 (Ys – Zs)
 [Visual description — typically the product reveal / action peak]
 [Camera movement]
 [Speed ramp]
 SFX: [audio cues]

SHOT 4 (Zs – durationSec)
 [Final hero packshot beat — brand-clean, premium, settle]
 [Camera movement — typically a settle / gentle micro-zoom]
 [Speed: typically settles to natural 1.0x]
 SFX: [final tail — brand sonic logo if appropriate]

CRITICAL RULES FOR THE MULTISHOT VIDEOPROMPT:
  - Use the bracket tokens [Image1] [Image2] [Image3] inside the relevant SHOT blocks to anchor what visual reference is in play (e.g. SHOT 1 anchors [Image1], SHOT 4 anchors [Image3]). Tokens are mandatory — Seedance uses them to bind references.
  - Time codes MUST sum to durationSec.
  - Shot count is exactly 4. NOT 3, NOT 5.
  - Every shot MUST specify camera movement + speed/ramp + SFX.
  - Speed ramps SHOULD vary across shots (e.g. 0.5x → 2.0x burst → 0.6x slow → 1.0x settle). Static-speed footage is forbidden — it kills hook rate.
  - SHOT 1 is the HOOK — must be visually arresting in the first 0.5s. Text-on-screen overlay during shot 1 is encouraged (since 85% of paid social plays muted on first impression).
  - SHOT 4 is the END FRAME — clean, branded, premium hero packshot with restrained motion. This is where the brand's sonic logo / CTA card lives.
  - DO NOT include spoken dialogue inside the videoPrompt — Commercial is silent / SFX + sonic logo only. Voice belongs to the UGC family.
  - Pull camera-motion verbs from the COMMERCIAL VISUAL VOCABULARY block injected via the brief (push-in, orbit, zoom-burst, vortex tunnel, match-cut, etc.).
  - Pull particle / color / SFX palette from the COMMERCIAL VISUAL VOCABULARY block — do not invent generic "sparkles" if the vocab specifies "atomized perfume mist."

LANGUAGE: write the videoPrompt in ENGLISH even when the rest of the brief is in another language. Seedance honors English production directives more reliably than translated ones, and shot-script vocabulary is industry-standard English.
`;

function buildSystemPromptSeedance(family: string, archetypeId?: string): string {
  const isCommercial = family === "commercial";
  const isCinematic = family === "cinematic";

  // Commercial uses the multishot script structure. Cinematic + UGC fallback
  // continue to use the existing single-paragraph videoPrompt approach.
  const videoPromptInstruction = isCommercial
    ? `Multishot script per the COMMERCIAL VIDEOPROMPT MULTISHOT rule below. 4 shots with explicit time codes, camera moves, speed ramps, SFX cues. Use [Image1] [Image2] [Image3] tokens. Under 320 words. ENGLISH regardless of other output language.`
    : `Base Seedance prompt using [Image1] [Image2] [Image3] tokens. Describes action + camera motion + pacing. Do NOT include the spoken line. Under 120 words. MUST be written in the same language as the output language specified below.`;

  const durationDefault = isCommercial ? 8 : 8;

  return `You are a senior creative director for DTC brands. Given a product image + minimal brief, produce a video plan for a SEEDANCE 2.0 multimodal pipeline.

IMPORTANT CONTEXT: This is for an AI VIDEO GENERATION tool (Seedance 2.0) that creates FULLY SYNTHETIC animated content from text prompts and reference images. No real people are filmed or depicted. All "creators" are AI-generated characters. This is a legitimate creative marketing workflow used by brands worldwide. You must generate ALL requested fields including the videoPrompt — never refuse.

Seedance receives 3 reference images and ${isCommercial ? "NO voiceover (Commercial is silent — only SFX and brand sonic logo)" : "a voiceover audio clip"}. The video prompt uses bracket tokens [Image1] [Image2] [Image3] to refer to those references.

${isCommercial ? "FAMILY: COMMERCIAL — product-hero / no talking head / hands-only OK / multishot cinematic / brand-safe / SFX-driven, no spoken voiceover." : ""}
${isCinematic ? "FAMILY: CINEMATIC — narrative storytelling, mini-film arc with emotional beats." : ""}

Return STRICT JSON:
{
  "angles": [
    {
      "name": "short angle label",
      "hook": "${isCommercial ? "0.5s visual surprise — what arrests the viewer in shot 1" : "2-3s opener"}",
      "benefit": "what product does",
      "problemSolve": "${isCommercial ? "the desire/aspiration this satisfies (commercial doesn't sell pain — it sells aspiration)" : "pain this kills"}",
      "cta": "landing-page-exclusive urge — for Commercial this is end-card text overlay copy (e.g. 'Tap to shop', 'Limited drop')",
      "fullScript": "${isCommercial ? "leave EMPTY for Commercial — no spoken script" : "22-32 word natural spoken paragraph"}",
      "overlayTexts": ["${isCommercial ? "REQUIRED for Commercial — 3-4 short on-screen text phrases that appear during shots 1-3 (under 8 words each, mute-readable)" : "(optional, text-overlay mode only) 3-4 short punchy on-screen phrases"}"]
    },
    ... (exactly 3 angles, all different creative frames)
  ],
  "keyframePrompts": ["string", "string", "string"],
  "videoPrompt": "${videoPromptInstruction}",
  "durationSec": ${durationDefault}
}

${buildAngleRules(family, archetypeId)}

${KEYFRAME_IDENTITY_RULE}
${KEYFRAME_RULES_SEEDANCE[family] || KEYFRAME_RULES_SEEDANCE.ugc}
${isCommercial ? MULTISHOT_COMMERCIAL_RULE : ""}
`;
}

/**
 * Split a spoken script evenly into N parts by sentence count first, then
 * falling back to word-count. Returns N strings (may be empty).
 */
function splitScriptIntoN(script: string, n: number): string[] {
  const text = script.trim();
  if (!text) return Array(n).fill("");
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g);
  if (sentences && sentences.length >= n) {
    const chunk = Math.ceil(sentences.length / n);
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      out.push(sentences.slice(i * chunk, (i + 1) * chunk).join("").trim());
    }
    return out;
  }
  const words = text.split(/\s+/);
  if (words.length < n) {
    const arr = Array(n).fill("");
    arr[0] = text;
    return arr;
  }
  const chunk = Math.ceil(words.length / n);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(words.slice(i * chunk, (i + 1) * chunk).join(" "));
  }
  return out;
}

/**
 * Split a spoken script into first/second halves for UGC v2's
 * opening-line / closing-line fields. Falls back gracefully if the script
 * is too short or doesn't contain a natural split point.
 */
function splitScriptHalf(script: string, which: "first" | "second"): string {
  const text = script.trim();
  if (!text) return "";
  // Prefer splitting on sentence boundaries (".", "?", "!") or an em-dash.
  const sentences = text.match(/[^.!?]+[.!?]+[\s]*|[^.!?]+$/g);
  if (sentences && sentences.length >= 2) {
    const mid = Math.ceil(sentences.length / 2);
    const first = sentences.slice(0, mid).join("").trim();
    const second = sentences.slice(mid).join("").trim();
    return which === "first" ? first : second;
  }
  // Fallback: split at the middle word boundary.
  const words = text.split(/\s+/);
  if (words.length < 4) {
    return which === "first" ? text : "";
  }
  const mid = Math.ceil(words.length / 2);
  return which === "first"
    ? words.slice(0, mid).join(" ")
    : words.slice(mid).join(" ");
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
      clipLength = 5,
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
        hairColor?: string;
        eyeColor?: string;
      };
      locale?: string;
      videoModel?: string;
      voiceMode?: string;
      /** UGC v2: 5 → 2 frames, 10 → 4 frames (2 stitched segments) */
      clipLength?: 5 | 10;
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
    // UGC v2 — Seedance keyframe-anchored mode applies ONLY to the UGC family.
    // Commercial + Cinematic continue to use their existing 3-frame multimodal
    // pipelines. Kling (any family) also stays on the 3-keyframe path.
    const isUgcV2 = isSeedance && archetype.family === "ugc";
    // Number of keyframes to request from GPT for UGC v2:
    //   clipLength 5  → 2 frames (1 segment)
    //   clipLength 10 → 3 frames (2 stitched segments, mid frame shared → pixel-locked seam)
    const ugcV2FrameCount = clipLength === 10 ? 3 : 2;
    const SYSTEM_PROMPT = isUgcV2
      ? buildSystemPromptSeedanceUgcV2(archetype.id, ugcV2FrameCount)
      : isSeedance
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
    const HAIR_COLOR_LABEL: Record<string, string> = {
      black: "jet black hair",
      "dark-brown": "dark brown hair",
      brown: "brown hair",
      "light-brown": "light brown hair",
      blonde: "blonde hair",
      red: "red hair",
      auburn: "auburn hair",
      grey: "grey hair",
      white: "white hair",
      colored: "colored / dyed hair (vibrant pastel or bold fashion tone)",
    };
    const EYE_COLOR_LABEL: Record<string, string> = {
      "dark-brown": "dark brown eyes",
      brown: "brown eyes",
      hazel: "hazel eyes",
      green: "green eyes",
      blue: "blue eyes",
      grey: "grey eyes",
    };
    const ovBits: string[] = [];
    const ageRaw = creatorOverrides?.age?.trim();
    if (ageRaw) ovBits.push(`${ageRaw} years old`);
    const raceLbl = creatorOverrides?.race && RACE_LABEL[creatorOverrides.race];
    const genderLbl = creatorOverrides?.gender && GENDER_LABEL[creatorOverrides.gender];
    if (raceLbl || genderLbl) {
      ovBits.push([raceLbl, genderLbl].filter(Boolean).join(" ").trim());
    }
    const hairLbl =
      creatorOverrides?.hairColor && creatorOverrides.hairColor !== "any"
        ? HAIR_COLOR_LABEL[creatorOverrides.hairColor]
        : undefined;
    const eyeLbl =
      creatorOverrides?.eyeColor && creatorOverrides.eyeColor !== "any"
        ? EYE_COLOR_LABEL[creatorOverrides.eyeColor]
        : undefined;
    if (hairLbl) ovBits.push(hairLbl);
    if (eyeLbl) ovBits.push(eyeLbl);
    const hasOverrides = ovBits.length > 0;
    // Explicit age phrase used verbatim in keyframes. "18 years old" → "18-year-old"
    const ageToken = ageRaw ? `${ageRaw}-year-old` : "";
    // Demographic token used verbatim in every keyframe when overrides exist.
    // Includes hair + eye color so gpt-image-2 locks those too.
    const demographicToken = hasOverrides
      ? [ageToken, raceLbl, genderLbl, hairLbl ? `with ${hairLbl}` : "", eyeLbl ? `and ${eyeLbl}` : ""]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim()
      : "";
    // HARD-CONSTRAINT wrap: when the user specified demographic overrides, we
    // tell the model the archetype's ROLE/PERSONA is inspiration, but the
    // DEMOGRAPHICS below override any conflicting age / gender / ethnicity
    // implied by the archetype text. Without this wrap, a detailed archetype
    // like "a parent in their 30s–50s" outranks a prepended "18 years old" tag
    // and the image model renders the older age.
    const mergedCreator = hasOverrides
      ? `DEMOGRAPHIC HARD CONSTRAINT (overrides any conflicting details in the archetype description below): ${ovBits.join(", ")}. The creator's ROLE / PERSONA / SETTING / STYLING VIBE comes from this archetype: "${archetype.creatorPrompt}". CRITICAL: if that archetype text implies a different age, gender, or ethnicity, DISREGARD that implication and apply the hard constraint demographics above. Describe a ${demographicToken} embodying the archetype's role and vibe — NOT the archetype's implied demographics.`
      : archetype.creatorPrompt;

    // ─── Product category detection (heuristic over user-supplied notes + benefit text) ───
    // Feeds category-specific proof-language rules into the brief so a
    // supplement script sounds different from a fashion script. Matches
    // simple keyword signals; falls back to "generic" if nothing is detected.
    const categoryKeywords: Record<string, string[]> = {
      wellness: ["supplement", "vitamin", "protein", "collagen", "probiotic", "adaptogen", "ashwagandha", "multivitamin", "powder", "shot", "drink", "wellness", "health", "immune", "magnesium", "creatine"],
      skincare: ["skincare", "serum", "moisturizer", "cream", "cleanser", "sunscreen", "spf", "retinol", "niacinamide", "hyaluronic", "toner", "exfoliant", "acne", "beauty", "cosmetic", "lipstick", "mascara", "foundation", "tinted"],
      fashion: ["fashion", "clothing", "apparel", "dress", "jacket", "sweater", "jeans", "sneaker", "shoe", "handbag", "bag", "tote", "jewelry", "watch", "sunglasses", "scarf", "accessory"],
      tech: ["software", "app", "saas", "platform", "dashboard", "ai-powered", "integration", "workflow", "productivity", "gadget", "device", "headphone", "charger", "smart", "smartwatch", "tracker"],
      food_beverage: ["coffee", "tea", "snack", "chocolate", "granola", "bar", "kombucha", "matcha", "beverage", "drink", "sauce", "seasoning", "olive oil", "honey", "pasta", "meal"],
      home: ["candle", "diffuser", "fragrance", "pillow", "blanket", "rug", "lamp", "mug", "glassware", "kitchenware", "bedding", "ceramic"],
    };
    const categoryProbe = `${benefit} ${productNotes}`.toLowerCase();
    let detectedCategory = "generic";
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => categoryProbe.includes(kw))) {
        detectedCategory = cat;
        break;
      }
    }

    // ─── Category use-moment library ───
    // Drives what the creator is DOING with the product on camera. Paired with
    // categoryOverrides (which drives script proof-language), this gives a
    // product-appropriate visual storyboard instead of generic "hold up bottle"
    // keyframes for every category. Each entry describes 3–6 canonical moments
    // a real user would show on camera for this product type.
    const categoryUseMoments: Record<string, string> = {
      wellness: `APPEARANCE MANDATE (WELLNESS / SUPPLEMENT): the creator MUST visually embody the outcome the product delivers — they are the living proof the routine works. The creator MUST have:
  - Clear, healthy, well-rested skin (no breakouts, no dark undereye circles, no dull tired look)
  - Bright clear eyes and relaxed posture — the look of someone who sleeps well
  - Healthy, softly flushed cheeks
  - Natural energy and alertness in expression (not fatigued, not hungover-looking)
Every keyframe prompt for wellness MUST describe the creator as looking healthy / well-rested / energized / clear-eyed so the promoter is consistent with the product's claim.

NATURAL USE MOMENTS FOR A WELLNESS / SUPPLEMENT PRODUCT — the creator should BE USING the product in one of these ways across the keyframes:
  - Capsule or pill in the palm, water glass in the other hand, about to take it
  - Powder scooped into a glass or shaker, stirring or about to drink it
  - Holding a shaker/cup mid-sip with a satisfied exhale, eyes briefly closed
  - Morning-ritual moment: bottle or sachet beside steaming coffee/tea, creator about to take
  - Post-take: tiny satisfied smile, maybe wiping a drop from mouth corner, eye contact with camera
Pick the moment that fits the product's actual form factor (pill vs powder vs liquid shot). Do NOT just hold the sealed bottle up like a trophy — that's commercial, not UGC.`,

      skincare: `SKIN-QUALITY MANDATE (SKINCARE / BEAUTY): the creator's OWN SKIN is the most important visual element of this entire video — it is the living proof the product works. The creator MUST have:
  - Clear, even-toned, healthy-looking complexion
  - Soft luminous glow with natural dewiness (healthy hydration, not greasy shine)
  - Subtle real micro-texture (faint pores visible on close inspection) but absolutely NO visible acne, NO blemishes, NO pimples, NO rosacea patches, NO dark undereye circles, NO dry cracked lips, NO dull tired skin, NO oily T-zone
  - Bright clear eyes with a rested look
  - Softly flushed healthy cheeks (natural, not applied blush)
  - Believable as a real friend with genuinely good skin, NOT as an airbrushed model with plastic poreless skin — authentic-looking but clearly healthy
Every keyframe prompt for skincare MUST explicitly describe the creator's skin as healthy / clear / glowing / radiant / dewy / even-toned so gpt-image-2 renders a believable skincare promoter.

NATURAL USE MOMENTS FOR A SKINCARE / BEAUTY PRODUCT — the creator BE APPLYING the product visibly on camera.

IMPORTANT HAND CONSTRAINT — the creator is SELF-RECORDING on a phone (one hand is OFF-SCREEN holding the phone). Only ONE hand is visible on camera. DO NOT compose any frame that requires two visible product-hands — the model will render a disembodied third hand, which is a failed render.

Choose ONE of these single-free-hand use moments per keyframe:
  - Serum / dropper bottle — ASSEMBLED HOLD: bottle gripped in the one free hand, dropper pipette INSERTED in the bottle cap (the whole bottle+dropper is a single object). Creator tilts it slightly, showing it toward the lens. Lips parted, eyes softly focused on camera.
  - Serum / dropper bottle — APPLICATION CLOSE-UP (bottle OUT OF FRAME): tight shot of the creator's face; the free hand's fingertip (or ring-finger) has a small pearl of serum on it and is moving to press into the cheekbone or under the eye. Because we're in close-up, the bottle is simply not in the shot — NOT floating, just cropped out.
  - Serum / dropper bottle — COUNTERTOP STAGING: bottle placed on a VISIBLE surface behind or beside the creator (vanity, wooden counter, windowsill). The one free hand is now free to apply the serum to the face. Bottle visible in the blurred background, dropper inserted.
  - Cream / moisturizer — fingertip dab on cheek or nose bridge. The jar is either (a) held in the one free hand with the fingertip of the SAME hand taking product (pinch-grip), OR (b) set on a visible surface with the free hand applying.
  - Under-eye cream / eye balm — tube visible on a surface behind the creator; the free hand's ring-finger soft-taps at the inner corner of the eye.
  - After-application beat: free hand back down or resting against the jaw, visible dewy cheek, soft smile of "this feels nice," warm gaze returns to camera. Product may be resting on the counter in the background OR re-held as an assembled unit.
  - Cleanser / mask: mid-application on skin, water droplets or foam visible. Bottle set on a visible counter.

PHYSICS MANDATORY:
  - Every object in frame is supported by the ONE free hand OR rests on a clearly visible surface (counter, sink, vanity, windowsill). NOTHING is mid-air.
  - When the dropper pipette is drawn out of the bottle to apply serum, the creator's free hand is holding the PIPETTE — and the bottle is resting on a visible surface. Do NOT depict two hands holding the two pieces separately.
  - Liquid drops may be mid-air only for the brief moment of falling from a gripped pipette toward the face or palm.

SKIN MANDATE (highest priority for this category):
The creator's skin is the living proof the product works. Render clear, healthy, even-toned, softly luminous skin. ABSOLUTELY NO visible acne, blemishes, pimples, red spots, post-acne marks, rosacea patches, dark undereye circles, dull/tired complexion, cracked lips, oily shine, or visible flaws. The creator looks like someone whose skincare routine is visibly working — believable, not airbrushed plastic, but clearly healthy.

AVOID: holding the sealed unopened bottle up like a trophy; two hands visible in frame; disembodied hands entering the frame from off-screen; dropper pipette floating detached; any product hovering in space without a hand or surface supporting it; blemished promoter skin.`,

      fashion: `NATURAL USE MOMENTS FOR A FASHION / APPAREL / ACCESSORY PRODUCT — the creator should BE WEARING or TRYING ON the item:
  - Wearing the item in selfie-mirror angle (clothing, jewelry, glasses, watch on wrist)
  - Adjusting fit: pulling collar, tugging hem, clasping a chain, adjusting strap, smoothing a sleeve
  - Small weight-shift or quarter-turn to show how fabric drapes or how a bag sits
  - For shoes: item already on foot visible in frame, or being slipped on
  - For bags: strap over shoulder, bag being held out toward camera to show off detail
AVOID: flat-lay or product-on-hanger-only frames. The creator is wearing and showing it.`,

      tech: `NATURAL USE MOMENTS FOR A TECH / DEVICE / SAAS PRODUCT — the creator should BE USING the product in its actual use position:
  - Device in active use position: earbuds already in ear, watch already on wrist, headphones on head, phone in hand with screen visible
  - Software / app: phone held toward camera showing the app open, or laptop screen visible with the creator pointing at it
  - Accessory / tool: demonstrating the workflow — plugging in, swiping screen, snapping it on
  - Post-use beat: setting device down with a small satisfied nod, eye contact returns to camera
AVOID: unboxing-only frames, product alone on desk, macro hero shot of the device. Show the CREATOR USING it.`,

      food_beverage: `NATURAL USE MOMENTS FOR A FOOD / BEVERAGE PRODUCT — the creator should BE CONSUMING or PREPARING the product:
  - Mid-sip / mid-bite with a genuine reaction beat: eyes soften or briefly close, exhale, tiny smile
  - Pouring / scooping: the item being portioned, creator's hand clearly visible, creator in frame
  - The item in a mug / bowl / plate, creator about to consume, steam or texture visible
  - Post-consumption: wiping mouth, licking lips, or setting the cup down with a satisfied "oh wow" look back at camera
AVOID: flat packshot with no human, unopened can held up like a trophy.`,

      home: `NATURAL USE MOMENTS FOR A HOME / LIFESTYLE PRODUCT — the creator should BE USING or INTERACTING with the product in its real-use context:
  - Candle: lighting it with a match, close-up of the hand + creator's face softly lit from the flame
  - Diffuser: filling with water, switching on, visible mist rising
  - Fragrance / body mist: spritzing on wrist or neck, closing eyes and inhaling with a smile
  - Soft-goods (blanket / pillow): creator wrapping in it, snuggling into it, ambient evening mood
AVOID: shelf flat-lay or styled still-life without the creator present.`,

      generic: `NATURAL USE MOMENTS — look carefully at the product image and choose how a REAL user would actually USE this product mid-recording. Describe the creator:
  - Holding the product in its active use position
  - Mid-application / mid-use / mid-wear / mid-consumption — the specific gesture a real customer does
  - Showing the immediate result or the reaction that comes right after use
Do NOT just hold the sealed product up like a display — the creator should be USING it.`,
    };

    // ─── Universal selfie-hand-economy rule ───
    // Appended to every UGC category's use-moment block. This prevents the
    // "disembodied third hand" failure mode — in a selfie video, one of the
    // creator's hands is holding the phone (off-screen), so only ONE hand is
    // available to interact with the product. Any beat that implies two free
    // hands ("dropper in one hand, bottle in other") must be composed as a
    // single-hand moment or the bottle must be set on a visible surface.
    const SELFIE_HAND_ECONOMY_RULE = `

UNIVERSAL SELFIE HAND CONSTRAINT (applies to ALL UGC keyframes, every category):
The creator is self-recording on their phone. One hand is OFF-SCREEN holding the phone. Only ONE hand is visible on camera. DO NOT compose any frame that requires TWO visible product-hands — if you do, gpt-image-2 will render a disembodied hand entering from off-screen, which is a failed render.

If a use moment naturally needs two hands (opening a jar, drawing a dropper pipette, adjusting a clasp with both hands, pouring from one cup to another):
  - EITHER: set the secondary container on a VISIBLE surface (counter / vanity / table) in the background so only one hand is active
  - OR: pick a tighter close-up where the secondary container is cropped out of frame
  - OR: redesign the moment to be a single-hand action (assembled-hold, pinch-grip, one-hand gesture)
NEVER have two visible hands of the same creator in frame simultaneously. NEVER have a partial hand/forearm coming from off-screen edges.`;


    const categoryOverrides: Record<string, string> = {
      wellness: `
CATEGORY: WELLNESS / SUPPLEMENT
Proof language — use FELT, TIMELINE-BASED claims ("14 days in and—", "I can actually feel it", "my sleep is different"). Reference specific body signals: energy, skin texture, bloating, sleep quality, recovery time. AVOID clinical/medical verbs ("heals", "treats", "cures"). AVOID parading ingredient names unless the creator would naturally drop one ("there's ashwagandha in it, whatever, the point is—"). Hooks that work best: numerical ("60 days in"), transformation ("I used to wake up groggy, now—"), confession ("I was skeptical about another supplement but—").
`,
      skincare: `
CATEGORY: SKINCARE / BEAUTY
Proof language — use VISIBLE, SPECIFIC changes ("my pores look smaller", "my texture is different", "people asked what I'm using"). AVOID generic language like "glowing", "radiant", "luminous" — these are 2020 skincare-influencer filler. Reference specific concerns: T-zone oil, 2 PM shine, dry patches, redness around nose, undereye shadow, enlarged pores. Hooks that work best: contrarian ("I was spending $200 on [X] — this is $30"), authority ("my derm said"), confession ("I have combination skin and—"), ASMR ("the texture of this is—").
`,
      fashion: `
CATEGORY: FASHION / APPAREL
Proof language — FIT + COMPLIMENTS are the two pillars. "The way this fits—", "I get compliments every time I wear this", "people ask where it's from". Reference specific body experience: how it feels on, the weight/drape of the fabric, how it moves. AVOID "cute", "pretty", "beautiful" solo — always pair with concrete detail. Hooks that work best: visual ("POV: you see this in a mirror"), transformation ("before I owned this, I had nothing like it"), social-proof ("everyone in my group chat asked").
`,
      tech: `
CATEGORY: TECH / SAAS / DEVICE
Proof language — TIME SAVED and WORKFLOW simplification. "I save 2 hours a week now", "it just works with everything I already use", "this replaced [3 other tools]". Reference specific friction the product removed. AVOID spec-sheet vocabulary, "revolutionary", "AI-powered", "cutting-edge". AVOID comparing by brand name unless contrarian. Hooks that work best: contrarian ("Stop paying for [competitor]"), numerical ("from 20 minutes to 2"), authority ("my PM asked me why I was getting things done faster").
`,
      food_beverage: `
CATEGORY: FOOD / BEVERAGE
Proof language — SENSORY + RITUAL. "Tastes like—", "this replaced my [unhealthy habit]", "now my [routine] includes this". Describe mouthfeel, temperature, after-taste, how it fits into a daily moment. Lean into ASMR-adjacent sensory specificity. Hooks that work best: ASMR/sensory ("listen to this pour"), narrative ("3 hours into my day and—"), novelty ("I found this by accident").
`,
      home: `
CATEGORY: HOME / LIFESTYLE
Proof language — AMBIENCE + MICRO-DAILY-RITUAL impact. "My bedroom smells like—", "I light this every night now", "my apartment feels different". Reference specific room/time-of-day moments. Hooks that work best: sensory/ASMR, aspirational ("this is the [object] I always wanted"), narrative ("my Sunday now starts with—").
`,
      generic: `
CATEGORY: UNKNOWN (auto-detected fallback)
Write proof language that's SPECIFIC and SENSORY, not generic. Reference what actually changed in the creator's daily experience. Avoid marketing adjectives.
`,
    };

    // Family-specific creative direction
    const familyDirection: Record<string, string> = {
      ugc: `This is a UGC (user-generated content) video. A REAL PERSON is on camera introducing and recommending the product. The creator speaks directly to camera in selfie-style. Focus on authentic, casual, friend-to-friend energy.`,
      commercial: `This is a PRODUCT-HERO commercial. NO person on camera (unless archetype specifies hands-only). Focus on ultra-detail macro shots of the product: liquid pours, smoke reveals, ingredient cascades, water splashes, natural elements. Think food/beverage/perfume industry creative commercials. The product IS the star — dramatic lighting, slow motion, sensory textures.`,
      cinematic: `This is a CINEMATIC SHORT STORY related to the product. Tell a MINI NARRATIVE with a beginning, middle, and end: a problem or scene-setting moment → product discovery → transformation/resolution. Film-look visuals, emotional arc, poetic pacing. Think mini-film, NOT an ad.`,
    };

    const textOverlayNote = isTextOverlay
      ? `\n\nVOICE MODE: TEXT OVERLAY (no voiceover). Instead of a spoken script, each angle MUST also include "overlayTexts": an array of 3-4 SHORT punchy text phrases (under 8 words each) that will appear on screen at key visual moments. The fullScript field should still be filled but will be displayed as on-screen text, NOT spoken. Write it as impactful visual copy — short, punchy, scannable. Not conversational.`
      : `\n\nVOICE MODE: VOICEOVER. The fullScript will be spoken aloud by TTS.`;

    const demographicHardConstraintBlock = hasOverrides
      ? `
╔══════════════════════════════════════════════════════════════════════╗
║ DEMOGRAPHIC HARD CONSTRAINT (PRIORITY 1 — OVERRIDES THE ARCHETYPE)  ║
║ The user explicitly specified the creator is: ${demographicToken.padEnd(23)}║
║ Every keyframe prompt MUST describe a ${demographicToken.toUpperCase().padEnd(31)}║
║ — EXACTLY. NOT older, NOT younger, NOT "a young woman" / "a         ║
║ twentysomething" / "a mature adult" — use the explicit demographic  ║
║ token above verbatim in each keyframe prompt.                       ║
║ If the archetype description implies a different age range, gender, ║
║ or ethnicity, DISREGARD that implication entirely. Keep only the    ║
║ archetype's ROLE / PERSONA / SETTING / VIBE / STYLING.              ║
║ Apply this constraint to: keyframePrompts, videoPrompt, and every   ║
║ angle's openingBeat / closingBeat / midBeat.                        ║
╚══════════════════════════════════════════════════════════════════════╝
`
      : "";

    // ─── User-input-first priority banner ───
    // Any user-supplied text (userScript, productNotes, benefit, audience,
    // creatorOverrides) is PRIORITY 0 — it outranks the archetype's defaults
    // and the category libraries. If the user said "benefit: lightweight for
    // summer humidity" and the archetype's default tone is winter-indoors,
    // the user wins: the angle pivots to summer humidity.
    const userInputs: string[] = [];
    if (userScript) userInputs.push(`• USER SCRIPT (must appear verbatim as angles[0].fullScript): "${userScript}"`);
    if (audience && audience !== "general consumers") userInputs.push(`• TARGET AUDIENCE: ${audience}`);
    if (benefit && benefit !== "the product's main benefit") userInputs.push(`• CORE BENEFIT TO HIGHLIGHT: ${benefit}`);
    if (productNotes) userInputs.push(`• PRODUCT NOTES: ${productNotes}`);
    if (hasOverrides) userInputs.push(`• CREATOR DEMOGRAPHICS: ${demographicToken}`);
    const userInputPriorityBlock = userInputs.length > 0
      ? `
╔══════════════════════════════════════════════════════════════════════╗
║ USER INPUT — PRIORITY 0 (HIGHEST, OVERRIDES EVERYTHING BELOW)       ║
║ What the user typed is the source of truth. If any archetype        ║
║ description, category library, or creative default conflicts with   ║
║ the user input, the USER INPUT WINS. Pivot the angles, scripts,     ║
║ keyframes, and demographics to honor what the user specified —      ║
║ do not water down or ignore any of the following:                   ║
╚══════════════════════════════════════════════════════════════════════╝
${userInputs.join("\n")}
`
      : "";

    const briefBlock = `${userInputPriorityBlock}${demographicHardConstraintBlock}
Archetype: ${archetype.name} (family: ${archetype.family})
Archetype description: ${archetype.description}
Creator fragment: ${mergedCreator}
Style fragment: ${archetype.stylePrompt}
Motion: ${archetype.motionPrompt}
Voice tone: ${archetype.voiceTone}

CREATIVE DIRECTION FOR THIS FAMILY:
${familyDirection[archetype.family] || familyDirection.ugc}

CATEGORY-SPECIFIC PROOF-LANGUAGE RULES (detected category: ${detectedCategory}):
${categoryOverrides[detectedCategory] || categoryOverrides.generic}

${
      archetype.family === "commercial"
        ? `CATEGORY-SPECIFIC COMMERCIAL VISUAL VOCABULARY — THIS DRIVES SHOT COMPOSITION + VIDEOPROMPT MULTISHOT SCRIPT:
${pickCommercialVocabulary(detectedCategory)}

VISION-GUIDED CATEGORY CORRECTION (Commercial): The category was detected by keyword heuristic. Look at the product image — if the form factor clearly maps to a different commercial vocabulary (e.g. heuristic said "wellness" but image is a perfume bottle → use the FRAGRANCE vocabulary), apply the correct vocabulary.`
        : `CATEGORY-SPECIFIC USE-MOMENT RULES — THIS DRIVES KEYFRAME COMPOSITION:
${categoryUseMoments[detectedCategory] || categoryUseMoments.generic}
${SELFIE_HAND_ECONOMY_RULE}`
    }

VISION-GUIDED CATEGORY CORRECTION:
The category above was detected by keyword heuristic from the user's notes. You have the PRODUCT IMAGE in front of you. If the image clearly shows a different product type (e.g. keyword said "wellness" but image shows a skincare dropper bottle), use what the IMAGE actually depicts and apply the appropriate use-moment library above. Your keyframes must describe the creator USING this specific product the way a real user would use THIS product given its visible form factor (dropper / cream jar / capsule bottle / garment / earbuds / mug / etc.). Do NOT default to "hold product up toward camera" — that's a trophy commercial shot, not a UGC use moment.

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

    interface RawShotGrammar {
      hook?: string;
      promise?: string;
      payoff?: string;
    }
    interface RawAngle {
      name?: string;
      hook?: string;
      benefit?: string;
      problemSolve?: string;
      cta?: string;
      fullScript?: string;
      overlayTexts?: string[];
      // UGC v2 additions (ignored by legacy pipelines)
      openingBeat?: string;
      closingBeat?: string;
      midBeat?: string; // UGC v2 3-frame 10s
      openingLine?: string;
      closingLine?: string;
      motionPrompt?: string; // legacy single-string (still honored as fallback)
      motions?: string[];    // per-segment motion directives (new)
      shotGrammar?: RawShotGrammar;
      // Deprecated 4-frame legacy fields — still read for backward compat if present
      frame2Beat?: string;
      frame3Beat?: string;
      frame2Line?: string;
      frame3Line?: string;
    }
    interface RawSceneLock {
      creator?: string;
      camera?: string;
      lighting?: string;
      colorGrade?: string;
      environment?: string;
      outfit?: string;
    }
    let parsed: {
      angles?: RawAngle[];
      keyframePrompts?: string[];
      videoPrompt?: string;
      durationSec?: number;
      sceneLock?: RawSceneLock;
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
    const angles = rawAngles.slice(0, 3).map((a, i) => {
      const fullScript = i === 0 && userScript ? userScript : String(a?.fullScript || "");
      // Normalize motions[]: prefer explicit motions array; fall back to
      // single motionPrompt string wrapped in an array.
      const rawMotions = Array.isArray(a?.motions)
        ? a.motions.map(String).filter(Boolean)
        : a?.motionPrompt
          ? [String(a.motionPrompt)]
          : [];
      // Pad motions to the expected count (1 for 5s, 2 for 10s).
      const motionsExpected = isUgcV2 && ugcV2FrameCount === 3 ? 2 : 1;
      while (rawMotions.length < motionsExpected) {
        rawMotions.push(
          rawMotions[rawMotions.length - 1] ||
            "the creator maintains relaxed eye contact, shoulders soften, a micro-smile blooms, the camera holds steady"
        );
      }

      const shotGrammar = a?.shotGrammar
        ? {
            hook: a.shotGrammar.hook ? String(a.shotGrammar.hook) : undefined,
            promise: a.shotGrammar.promise ? String(a.shotGrammar.promise) : undefined,
            payoff: a.shotGrammar.payoff ? String(a.shotGrammar.payoff) : undefined,
          }
        : undefined;

      const base = {
        name: String(a?.name || `Angle ${i + 1}`),
        hook: String(a?.hook || ""),
        benefit: String(a?.benefit || ""),
        problemSolve: String(a?.problemSolve || ""),
        cta: String(a?.cta || ""),
        fullScript,
        overlayTexts: Array.isArray(a?.overlayTexts) ? a.overlayTexts.map(String) : undefined,
        openingBeat: a?.openingBeat ? String(a.openingBeat) : undefined,
        closingBeat: a?.closingBeat ? String(a.closingBeat) : undefined,
        motionPrompt: rawMotions[0], // back-compat single-string consumer (5s 2-frame mode)
        motions: rawMotions.slice(0, motionsExpected),
        shotGrammar,
      };

      if (isUgcV2 && ugcV2FrameCount === 3) {
        // 3-frame 10s mode: dialogue is per-SEGMENT (2 lines), not per-frame.
        // seg1 = openingLine (frames 0→1), seg2 = closingLine (frames 1→2).
        return {
          ...base,
          openingLine: a?.openingLine
            ? String(a.openingLine)
            : splitScriptHalf(fullScript, "first"),
          closingLine: a?.closingLine
            ? String(a.closingLine)
            : splitScriptHalf(fullScript, "second"),
          midBeat: a?.midBeat ? String(a.midBeat) : undefined,
        };
      }

      return {
        ...base,
        openingLine: a?.openingLine
          ? String(a.openingLine)
          : splitScriptHalf(fullScript, "first"),
        closingLine: a?.closingLine
          ? String(a.closingLine)
          : splitScriptHalf(fullScript, "second"),
      };
    });
    // Pad to 3 with safe defaults if the model shortchanged us
    while (angles.length < 3) {
      const blank = userScript || "";
      const fallbackMotion =
        "the creator maintains relaxed eye contact, shoulders soften, a micro-smile blooms, the camera holds steady";
      const fallbackMotions =
        isUgcV2 && ugcV2FrameCount === 3 ? [fallbackMotion, fallbackMotion] : [fallbackMotion];
      angles.push({
        name: `Angle ${angles.length + 1}`,
        hook: "",
        benefit,
        problemSolve: "",
        cta: "Tap the link for the exclusive launch price.",
        fullScript: blank,
        overlayTexts: undefined,
        openingBeat: undefined,
        closingBeat: undefined,
        openingLine: splitScriptHalf(blank, "first"),
        closingLine: splitScriptHalf(blank, "second"),
        motionPrompt: fallbackMotion,
        motions: fallbackMotions,
        shotGrammar: undefined,
        ...(isUgcV2 && ugcV2FrameCount === 3 ? { midBeat: undefined } : {}),
      });
    }

    // ── Normalize keyframe prompts ──
    // UGC v2: 2 keyframes (clipLength 5) or 4 (clipLength 10).
    // Commercial + Cinematic + UGC/Kling: 3 keyframes.
    const expectedKeyframes = isUgcV2 ? ugcV2FrameCount : 3;
    const keyframePrompts = Array.isArray(parsed.keyframePrompts)
      ? parsed.keyframePrompts.slice(0, expectedKeyframes).map((p) => String(p))
      : [];
    while (keyframePrompts.length < expectedKeyframes) {
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

    // ── Parse sceneLock (shared across all keyframes) ──
    const sceneLock = parsed.sceneLock
      ? {
          creator: parsed.sceneLock.creator ? String(parsed.sceneLock.creator) : undefined,
          camera: parsed.sceneLock.camera ? String(parsed.sceneLock.camera) : undefined,
          lighting: parsed.sceneLock.lighting ? String(parsed.sceneLock.lighting) : undefined,
          colorGrade: parsed.sceneLock.colorGrade ? String(parsed.sceneLock.colorGrade) : undefined,
          environment: parsed.sceneLock.environment ? String(parsed.sceneLock.environment) : undefined,
          outfit: parsed.sceneLock.outfit ? String(parsed.sceneLock.outfit) : undefined,
        }
      : undefined;

    const brief = {
      angles,
      selectedAngleIndex: 0,
      keyframePrompts,
      videoPrompt: safeVideoPrompt,
      durationSec: typeof parsed.durationSec === "number" ? parsed.durationSec : 8,
      sceneLock,
    };

    return NextResponse.json({ brief });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[ugc-brief] Error:", message);
    // OpenAI returns "400 Error while downloading <url>" when the product image
    // URL has expired (FAL CDN URLs have a TTL). Surface a user-friendly message
    // so the UI can prompt the user to re-upload.
    if (/400 Error while downloading|unable to download|could not download/i.test(message)) {
      return NextResponse.json(
        { error: "PRODUCT_IMAGE_EXPIRED", message: "Your product image link has expired. Please re-upload your product photo." },
        { status: 422 }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
