/**
 * UGC archetype catalog.
 *
 * Since the user now defines gender, age, and race separately via creator
 * overrides, archetypes focus on LIFESTYLE / ROLE / VIBE — what kind of
 * person is on camera, what world they live in, and how the content feels.
 *
 * Each archetype is a bundle of prompt fragments:
 *   - `creatorPrompt` — persona + styling (NO gender/age/race — those come
 *     from user overrides and are prepended at request time)
 *   - `stylePrompt`   — lighting, camera, aesthetic
 *   - `motionPrompt`  — how it moves (Kling motion hint)
 *   - `voiceTone`     — how the script should sound
 */

export type ArchetypeFamily = "ugc" | "commercial" | "cinematic";

export interface Archetype {
  id: string;
  family: ArchetypeFamily;
  name: string;
  description: string;
  creatorPrompt: string;
  stylePrompt: string;
  motionPrompt: string;
  voiceTone: string;
  /** OpenAI TTS voice hint — overridden by user gender/age settings. */
  ttsVoice: "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
}

export const ARCHETYPES: Archetype[] = [
  // ─── UGC (phone-selfie, authentic, conversational) ───
  // Each archetype now specifies: speech cadence, facial-expression palette,
  // hand-gesture vocabulary, emotional texture, and micro-context anchors
  // that make the 6 UGC personas actually distinguishable in generation.
  {
    id: "ugc-busy-professional",
    family: "ugc",
    name: "Busy Professional",
    description: "Efficient coworker sharing a real find between meetings",
    creatorPrompt:
      "a mid-career professional (30s-40s) in smart-casual attire (crewneck, collared shirt, or minimal blazer), hair neat but not styled, holding a smartphone at arm's length in selfie mode. Light stubble or minimal makeup. Visible work anchors: single coffee cup, corner of a laptop, lanyard or AirPods case. They move with purpose — quick precise gestures, slight forward lean. Their eyes engage directly with the lens. Tired-but-enthusiastic energy, like they just stepped out of a meeting to record this fast.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical selfie, asymmetrical framing (creator slightly off-center). Office breakroom, desk corner, or conference-room edge. Mixed fluorescent + window light creating asymmetric shadow on one side of face. Visible skin texture: pores, faint crow's-feet, no retouching. Warm white balance. Shallow phone-camera depth of field — desk clutter blurred behind. Slight handheld tremor.",
    motionPrompt:
      "rapid micro-movements, quick purposeful head tilts. Hook delivered at speed with slight forward lean. Hands gesture at chest level for emphasis. Product lift is deliberate, not showy. Micro-smile at the reveal — eyes crinkle genuinely. Speech cadence: FAST on the hook, slower + more measured on benefit/proof, crisp on CTA. Brief glance away to think, then back to lens (authentic beat). No wild arm gestures — this is boardroom energy in portable format.",
    voiceTone:
      "Efficient, credible, matter-of-fact. Peer-to-peer recommendation over coffee — 'I found something that saves me time every morning, you should know about it.' Slight emphasis on ROI/efficiency language. Confidence without hype. Thread of 'I'm busy like you, this actually works' underneath.",
    ttsVoice: "nova",
  },
  {
    id: "ugc-fitness-enthusiast",
    family: "ugc",
    name: "Fitness Enthusiast",
    description: "Post-workout real talk — performance-obsessed, body-confident, data-driven",
    creatorPrompt:
      "a visibly athletic person (mid-20s to early 40s) fresh from or still in workout clothes (sports bra, compression tank, lifting straps, or gym hoodie). Slight natural sheen of sweat on forehead/collarbone (just-finished energy, not drenched). Hair swept back pragmatically. Shoulders open, back straight. They hold the product with casual confidence — it's a tool they actually use, not a prop. Phone held slightly lower than eye-line (gym selfie angle). Visible anchors: water bottle, weight plate edge, gym mirror reflection, fitness tracker on wrist.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical. Gym floor, home-gym corner, or locker-room selfie spot. Bright overhead lighting with possible window light bleeding in — slight overexposure on brights, realistic phone-camera capture. Minimal background: yoga mat corner, dumbbells slightly out-of-focus, hydration bottle, mirror edge. Visible skin texture: real sweat, real pores, no filters. Warm color grade.",
    motionPrompt:
      "high energy but controlled. Hook: quick shoulder movement, energetic head nod, eyes bright. Benefit: slower deliberate lift of product (showing how it's used in routine). Hand stays steady and unwavering at product-demo height (strength signal). Stands tall. Breathing visible — still slightly elevated from workout. Micro-expressions: genuine smile widening, conviction in eyes. Speech cadence: FAST on the hook with energy, crisp and explanatory on benefit, emphatic on CTA. Occasional head nod for emphasis.",
    voiceTone:
      "High-energy motivational but credible. 'I've been training 5 years, I know supplements/gear, THIS is the one.' No corporate wellness language. Direct, confident, enthusiastic without being fake-peppy. Sounds like a friend who actually competes and genuinely uses the product.",
    ttsVoice: "echo",
  },
  {
    id: "ugc-student",
    family: "ugc",
    name: "College Student",
    description: "Broke-but-picky, peer-to-peer, Discord-group-chat energy",
    creatorPrompt:
      "a college-age person (18–25) in genuine dorm-life attire — oversized hoodie or band tee, headphones around neck, hair in its natural state (bedhead-adjacent, no styling). Skin shows normal texture: real pores, maybe light acne scarring or active blemishes (authenticity), no makeup or minimal. Slight smirk like they're letting you in on a secret. They hold the phone at arm's length with the casual ease of someone who records TikToks daily. Visible anchors: half-drunk energy drink, textbook stack, laptop corner, LED strip lights, posters.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical. Dorm room or shared apartment. Warm desk-lamp key light, possible RGB strip glow in background. Lived-in clutter visible but not chaotic: books, cups, sweatshirt on chair. Creator sits relaxed in chair, not posed. Camera held slightly low (eye-level-ish). Slight camera sway — no tripod. Skin texture: unfiltered, real. Warm color grade, slightly desaturated.",
    motionPrompt:
      "loose and conversational. Eyebrow raise on hook (surprise/realization), head tilt on benefit (thoughtful), eyes light up at the proof moment. Casual pointing gestures, open-palm emphasis (not aggressive). Possible false start or self-interrupt mid-sentence ('wait actually—'). Leans back in chair slightly (relaxed confidence). Speech cadence: conversational, slightly faster when excited, natural pauses. No polish — the imperfection IS the credibility.",
    voiceTone:
      "Relatable peer-to-peer, low-key passionate. 'I found this and it's genuinely good, especially for people like us who are broke but also don't want cheap-feeling stuff.' Mix of dry humor and sincerity. Casual language without trying too hard. Sounds like a Discord friend in a group chat, not a creator.",
    ttsVoice: "echo",
  },
  {
    id: "ugc-busy-parent",
    family: "ugc",
    name: "Busy Parent",
    description: "Tired-but-coping honest rec, lived-experience authority, juggle energy",
    creatorPrompt:
      "a parent (30s–50s) in comfortable functional clothing (slightly rumpled — kid-approved chaos level). Standing at a kitchen counter, sink, or entryway. Hair done-but-not-overdone, maybe a simple ponytail. Skin shows visible crow's-feet from smiling, possibly mild undereye shadow (real parent aesthetic). Physical presence of someone mid-juggle — one hand ready to move to another task. Kind direct eyes. Product held up naturally, like showing a friend something that worked. Visible anchors: toy on counter (blurred), dish rack, half-packed lunchbox, faint sound of a kid off-screen hinted.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical. Real kitchen or home interior. Natural midday window light. Lived-in background: blurred toy, dish rack corner, family calendar on fridge, half a banana on counter. Casual framing — creator slightly off-center, not posed. Visible skin texture, mild undereye shadow, real crow's-feet. Warm color grade, inviting and home-like. No ring light.",
    motionPrompt:
      "calm and purposeful, occasionally interrupted by external factors (a brief glance away at a sound, then back — authenticity marker). Hook: direct eye contact, knowing half-smile. Benefit: slower measured explanation (teaching tone, like to another parent). Product held steady and shown clearly. Micro-expressions: nod of acknowledgment, eyes crinkle in relief or satisfaction. One-handed gestures (the other hand busy). Speech cadence: slower than other archetypes, deliberate, with real breath moments. Authority from lived experience, not hype.",
    voiceTone:
      "Honest, practical, wise. 'As someone who has fifteen minutes to myself per day, this is what actually works.' No marketing language. Speaks from hard-won experience. Slight weary warmth — 'I've tried everything, this is the one.' Trust built through transparency about the chaos of parenting.",
    ttsVoice: "shimmer",
  },
  {
    id: "ugc-night-owl-creative",
    family: "ugc",
    name: "Night Owl Creative",
    description: "Intimate 2AM desk confession, ritual-builder, indie-aesthetic sensitivity",
    creatorPrompt:
      "a freelance creative (20s–40s) at a late-night desk, wearing a cozy oversized sweater or cardigan. Warm desk lamp provides key light. Warm drink nearby (coffee mug or glass). Intentional-but-not-forced aesthetic — plants, art prints, personal objects. Hair is soft, natural, slightly undone. Holds the phone at arm's length with relaxed confidence. Concentration mixed with warmth in the face. The environment feels like a sanctuary. Fully present despite the hour. Visible anchors: monitor glow edge in background, open notebook, coffee cup steam, potted plant.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical. Dimly lit room: warm desk lamp as key light, monitor backlight creating cool rim light on opposite side. Cozy chaos aesthetic — books stacked, a plant, a print on the wall. Creator in warm light pool, deep soft shadows around. Intimate framing. Warm tungsten color grade, slightly desaturated (nocturnal mood). Visible skin texture in warm lamplight (flattering but honest).",
    motionPrompt:
      "slow, intentional, introspective. Hook: lean-in to camera, conspiratorial energy, direct eye contact. Benefit: thoughtful explanation, possible hand-to-chin gesture (thinking pose), slow nod. Product held up in lamplight, turning it slightly to show detail. Eyes convey 'this is part of my ritual.' Slight smile of recognition, eyes of satisfaction. Hand movements: careful, deliberate, almost meditative. Natural pauses / breath moments. Speech cadence: SLOWER than others, generous silence, whisper-soft volume energy.",
    voiceTone:
      "Thoughtful, intimate, slightly philosophical. 'At 2 AM when I'm working on something important, this is what keeps me going.' Speaks like sharing a secret with a close friend. Mixes practical (it works) with poetic (part of the ritual). Indie-creator credibility — unsponsored, genuinely obsessed.",
    ttsVoice: "fable",
  },
  {
    id: "ugc-commuter",
    family: "ugc",
    name: "Daily Commuter",
    description: "Voice-memo energy, caught-in-the-moment, urgency-meets-conviction",
    creatorPrompt:
      "a daily commuter (mid-20s to early 50s) in practical outerwear — light jacket, backpack visible over one shoulder, scarf in cold months. Seated in a car, subway window-seat, or standing on a platform. Phone held at arm's length, recording like a quick voice memo. Slight body sway from vehicle motion. Energetic but grounded expression. Visible anchors: blurred city scenery out the window, coffee cup in holder, other commuters out-of-focus in background, train handrail edge.",
    stylePrompt:
      "shot on iPhone front camera, 9:16 vertical. Natural daylight through window or transit lighting. Background: blurred city scenery, reflected window surface, glimpses of other passengers all out-of-focus. Creator slightly to the side of frame (natural commute positioning). Slight consistent camera sway from vehicle motion. Warm daylight or cool overcast depending on time. Visible skin texture in natural light. Candid, unplanned aesthetic.",
    motionPrompt:
      "energetic but space-constrained. Hook: quick eye contact, eyebrow raise, slight head turn (natural commute behavior). Benefit: clear gestures despite limited arm space — product held up in confined position, demonstrated practically. Satisfied nod, knowing smile. Hands move with economy — no unnecessary gestures. Subtle sway from vehicle motion (authentic detail, do not over-stabilize). Speech cadence: FAST, clipped but clear, voice-note energy. Urgency mixed with conviction — 'I'm literally on the train but you need to know this.'",
    voiceTone:
      "Quick, on-the-go, authentic. 'I'm commuting right now and had to tell you about this before I forget.' Voice-note energy — conversational, slightly breathless, real. Speaks with urgency of someone who found something good and wants to share before the moment passes. Credible because it's unplanned.",
    ttsVoice: "nova",
  },

  // ─── Commercial (product-hero, ultra-detail, no person on camera) ───
  //
  // Commercial archetypes — organized in 3 distinct style families:
  //
  //   🏃 SPORT / B-ROLL       (Nike-style: quick cuts, speed ramps, macro-in-motion)
  //   ✨ LUXURY / ELEGANT     (Aesop-style: slow push/pull, restrained, sensory)
  //   🎨 FASHION / SURREAL    (Gucci/Loewe: monochrome voids, floating objects, scale shifts)
  //
  // All commercial archetypes are PRODUCT-HERO — no creator face on camera
  // (hands-only acceptable when the archetype calls for it).

  // ════════════════════════════════════════════════════════════════
  // 🏃 SPORT / B-ROLL FAMILY
  // ════════════════════════════════════════════════════════════════
  {
    id: "comm-sport-training-montage",
    family: "commercial",
    name: "Training Montage",
    description: "Nike-style kinetic montage — sweat, motion, product",
    creatorPrompt:
      "athlete body parts in motion (limbs, hands, feet, sweat detail) intercut with the product — NO visible face, the product is the star",
    stylePrompt:
      "cinematic sport B-roll aesthetic, teal-orange color grade, high contrast with crushed blacks, anamorphic lens flare, shallow depth of field f/2, rim-lit silhouettes against golden-hour backlight, desaturated background with the product isolated in focus, hard directional key lighting raking across texture, 35mm film grain",
    motionPrompt:
      "rapid montage at 8-12 cuts per 10 seconds, whip-pan transitions blurring between shots, speed ramps from real-time into 120fps slow motion on peak effort moments, gimbal glide approaches, percussive edit rhythm synced to a downbeat",
    voiceTone: "sparse and punchy, breath-driven, percussive — max 3-5 words of VO if any, otherwise music-only",
    ttsVoice: "onyx",
  },
  {
    id: "comm-sport-gear-hero",
    family: "commercial",
    name: "Gear Hero Macro",
    description: "Product close-ups synced to athletic energy",
    creatorPrompt:
      "the actual product in extreme macro — tread patterns, fabric weave, logo detail, material texture — with subtle hints of motion (a hand releasing, a foot stepping in) but NO face",
    stylePrompt:
      "extreme macro 8K product photography, f/1.4 razor depth of field, hard backlight creating rim separation, anamorphic flare streaking across the top of frame, teal-orange grade with the brand color popping, high-contrast darkroom feel, water droplets or sweat catching pinpoint highlights",
    motionPrompt:
      "slow 360° gimbal rotation around the product, punctuated by match cuts to adjacent texture details, speed ramp on a single hero reveal moment, hard cut on a percussion downbeat",
    voiceTone: "silent or single whispered product-name stab, let the visuals carry",
    ttsVoice: "onyx",
  },
  {
    id: "comm-sport-motion-match",
    family: "commercial",
    name: "Motion Match",
    description: "Product and athletic action fused through match cuts",
    creatorPrompt:
      "hands, feet, and torso in athletic motion (gripping, striking, flexing) match-cut to the product responding — compressing foam, flexing fabric, water beading on surface — no identifiable faces",
    stylePrompt:
      "cinematic sport commercial, dramatic rim light + bounced fill, teal-orange color grade, anamorphic compression, sharp focus on action elements against motion-blurred background, 24fps for real-time + 120fps for peak-effort slow motion",
    motionPrompt:
      "handheld gimbal follows athletic action, match cut from body motion to product response (foot compresses → shoe sole compresses in macro), speed ramps on impact moments, percussive cuts at 10+ per 10 seconds",
    voiceTone: "breath layering, occasional motivational vocal stab (2-3 words max), driven by percussion and bass drops",
    ttsVoice: "onyx",
  },

  // ════════════════════════════════════════════════════════════════
  // ✨ LUXURY / ELEGANT FAMILY
  // ════════════════════════════════════════════════════════════════
  {
    id: "comm-elegant-morning-ritual",
    family: "commercial",
    name: "Morning Light Ritual",
    description: "Slow push into product on marble, dawn window light",
    creatorPrompt:
      "the product resting on a marble or stone surface in a softly-lit bathroom or bedroom at dawn, a hand may enter late to reach toward it — NO face",
    stylePrompt:
      "soft directional window light at 45°, warm cream palette with muted neutrals, 15% desaturation for film-like flatness, lifted blacks (#1a1a1a), 85mm focal length, shallow depth of field f/2.8, anamorphic 2.39:1 aspect feel, matte 35mm film grain, single key light with intentional shadow, negative space dominance",
    motionPrompt:
      "6-8 second slow cinematic push-in toward product detail (glass catching light, label texture), mostly locked-off static with subtle parallax drift, one deliberate slow reveal moment, cross-dissolves (200ms) between beats",
    voiceTone: "whispered, intimate, confessional — a secret shared. Generous silence. 15-25 words maximum across the spot.",
    ttsVoice: "shimmer",
  },
  {
    id: "comm-elegant-hero-reveal",
    family: "commercial",
    name: "Hero Reveal (Pull-Back)",
    description: "ECU detail slowly pulls back to full product tableau",
    creatorPrompt:
      "extreme close-up texture detail (leather grain, glass facet, liquid meniscus, fabric weave) that slowly pulls back to reveal the full product in a composed still-life — NO people",
    stylePrompt:
      "cinematic product film, soft backlit minimalism with a single directional key light, warm neutral palette, deep matte shadows, slight bloom on highlights (optical softness not lens flare), 85mm+ focal length, shallow depth of field, anamorphic compression, film grain, editorial still-life composition with rule-of-thirds asymmetry and generous negative space",
    motionPrompt:
      "begin extreme close-up with warm blurred light behind, execute a smooth 8-second slow pull-back on a locked horizontal axis, end on a held 2-second wide of the product in composed tableau, finish with a micro-zoom onto product center, cross-dissolves between phases",
    voiceTone: "silent or one poetic phrase at 80% mark (max 3-5 words). Let the reveal breathe.",
    ttsVoice: "shimmer",
  },
  {
    id: "comm-elegant-ingredient-cascade",
    family: "commercial",
    name: "Ingredient Cascade",
    description: "Slow-mo liquid pour and ingredients cascading around product",
    creatorPrompt:
      "the product centered with its key ingredients caught mid-motion around it — liquid pour from a tilted container, suspended water droplets, petals, powder, fruit or botanical elements drifting in slow motion — NO people, NO faces",
    stylePrompt:
      "extreme macro 8K, warm neutral studio backdrop with soft directional key light, shallow depth of field f/2.8, visible caustics and light refractions through liquids, glistening suspended droplets frozen sharp, hyper-realistic material texture, muted natural saturation with the product label crisply in focus, film grain",
    motionPrompt:
      "10-second locked-off slow-motion pour (shot at 120fps, played back 5x), golden translucent stream catching a single hard key light, ingredients drift and settle in slow motion around the product, camera does a barely-perceptible parallax drift, no cuts during the pour — let it breathe",
    voiceTone: "silent or a single sensory word at 70% ('pure', 'flowing', 'essence') — let the visuals carry",
    ttsVoice: "shimmer",
  },

  // ════════════════════════════════════════════════════════════════
  // 🎨 FASHION / SURREAL FAMILY
  // ════════════════════════════════════════════════════════════════
  {
    id: "comm-surreal-floating",
    family: "commercial",
    name: "Floating Choreography",
    description: "Products defy gravity in a saturated monochrome void",
    creatorPrompt:
      "the actual product suspended mid-air in a saturated monochrome void (electric magenta, sulfur yellow, arctic blue, or cyan), rotating slowly on an invisible axis, occasionally multiplied into 3-5 variants at different scales and angles — NO people (a hand may briefly reach in late as a silhouette)",
    stylePrompt:
      "surreal fashion editorial aesthetic, single saturated monochrome background fills the entire frame (Pantone-perfect), theatrical spotlight key light on the floating product with hard colored gel fill, bold centered symmetrical composition, anamorphic horizontal lens flare, crisp product edges against chromatic void, 2.39:1 letterbox, dreamlike slow motion, Gucci / Loewe / Schiaparelli editorial lineage",
    motionPrompt:
      "slow 360° orbital camera motion around the suspended product (6-8 sec per rotation), product rotates counter to the camera for doubled motion, occasional sudden tilt-whip breaking the serenity, held dreamy tableaux of 4-5 seconds broken by sharp 0.5-sec cuts, match cuts on shape or color to the next surreal configuration",
    voiceTone: "silent, or a whispered poetic fragment as manifesto ('impossible weight', 'gravity as choice'). Breathy, ethereal.",
    ttsVoice: "nova",
  },
  {
    id: "comm-surreal-color-block",
    family: "commercial",
    name: "Color-Block Dreamscape",
    description: "Saturated monochrome environment with the product as sole pop of contrast",
    creatorPrompt:
      "the product is the ONLY object in a perfectly symmetrical, saturated monochrome environment (electric magenta, sulfur yellow, electric blue, emerald green — pick one hue for the scene), often placed dead-center on the vertical axis, occasionally paired with a single complementary-color prop or backdrop element — NO people",
    stylePrompt:
      "surreal color-field editorial, single saturated Pantone backdrop filling 100% of frame, hard colored gel lighting (magenta key against cyan fill, or sulfur yellow top-light), theatrical spotlight isolating the product, bold diagonal or centered symmetrical composition, tilt-shift miniature effect on selected shots, anamorphic compression, high contrast between product and chromatic void, gallery-installation mood",
    motionPrompt:
      "4-6 second static held tableaux of perfect symmetrical composition, broken by sharp 1-second sudden-cut rhythm changes, tilt-whip transitions between color states, occasional color-field morph where the background hue shifts mid-shot, match cuts on shape and color continuity",
    voiceTone: "silent, or short poetic manifesto fragments ('color as shelter', 'pattern becomes identity'). Designed to feel curated, not conversational.",
    ttsVoice: "nova",
  },
  {
    id: "comm-surreal-scale-disruption",
    family: "commercial",
    name: "Scale Disruption",
    description: "Surreal scale shifts — oversized or miniaturized product in impossible worlds",
    creatorPrompt:
      "the product rendered at impossible scale — either towering 50-feet tall in a vast warehouse or cathedral, OR miniaturized beside a normal-scale model/environment — juxtaposed with everyday objects for maximum scale shock. NO identifiable faces, only silhouettes or cropped limbs",
    stylePrompt:
      "surreal fashion film aesthetic, muted high-contrast palette with a single pop color, anamorphic wide-angle for the mega-scale shots, tilt-shift for the miniaturized shots (making the real world feel toy-like), theatrical lighting with deep chiaroscuro, architectural cleanness, dreamlike deliberate unreality",
    motionPrompt:
      "wide establishing shot → extreme macro → sudden reveal that the macro detail is actually the size of a person (scale inversion via match cut), orbital camera movements around oversized objects, dolly zoom on scale-shifting moments, held 3-4 second wide shots that let the impossibility sink in, sudden vertical-axis flips",
    voiceTone: "silent, or low whisper acknowledging the paradox ('size as metaphor', 'the scale of want'). Rare and deliberate.",
    ttsVoice: "nova",
  },

  // ─── Cinematic (short-story narrative, emotional arc, film look) ───
  //
  // Cinematic archetypes tell a MICRO STORY related to the product —
  // a problem moment → discovery → transformation. Think mini film,
  // not an ad. Emotional narrative with beginning/middle/end.
  {
    id: "cine-morning-ritual",
    family: "cinematic",
    name: "Morning Ritual",
    description: "Dawn to ready — a morning routine mini-story",
    creatorPrompt:
      "a person waking up, stretching, walking to the bathroom, reaching for the product as part of their morning ritual",
    stylePrompt:
      "warm golden dawn light streaming through curtains, soft bokeh, cinematic 2.39:1 aspect feel, intimate close-ups intercut with wide room shots, film grain, analog warmth",
    motionPrompt:
      "slow push-in on sleeping face, match-cut to running water, hands reach for product, close-up application, smile at mirror, confident walk out the door",
    voiceTone: "intimate, reflective, poetic, new-beginning energy",
    ttsVoice: "fable",
  },
  {
    id: "cine-before-after",
    family: "cinematic",
    name: "Before / After Journey",
    description: "Struggle → discovery → transformation arc",
    creatorPrompt:
      "a person first shown frustrated or struggling (bad skin, tired, stressed), then discovering the product, then shown transformed and confident",
    stylePrompt:
      "split-tone color grade — desaturated cool blue for 'before', warm golden for 'after', dramatic lighting shift at the product-reveal moment, cinematic shallow DOF, emotional close-ups",
    motionPrompt:
      "opens on frustrated expression, slow zoom out, cuts to product discovery moment with warm light bloom, time-lapse transformation, ends on confident smile and slow-motion hair flip or gesture",
    voiceTone: "empathetic, building hope, emotional crescendo, genuine transformation",
    ttsVoice: "onyx",
  },
  {
    id: "cine-night-out",
    family: "cinematic",
    name: "Night Out Story",
    description: "Getting ready, city lights, confidence moment",
    creatorPrompt:
      "a person getting ready for a night out — applying the product, checking the mirror, stepping into city nightlife with confidence",
    stylePrompt:
      "neon-lit urban palette, moody teal + magenta, reflections in mirrors and windows, shallow depth of field, cinematic slow motion, music-video aesthetic",
    motionPrompt:
      "mirror reflection applying product, cut to walking through city streets, neon signs reflected in puddles, slow-motion confident stride, final look-back at camera with a subtle smile",
    voiceTone: "magnetic, confident, nightlife energy, understated cool",
    ttsVoice: "onyx",
  },
  {
    id: "cine-nature-escape",
    family: "cinematic",
    name: "Nature Escape",
    description: "Quiet moment in nature, product as companion",
    creatorPrompt:
      "a person in a serene natural setting — forest, beach, or mountain — using the product in a moment of stillness and self-care",
    stylePrompt:
      "golden hour natural light, wide landscape establishing shots, intimate close-ups, earthy color palette, cinematic drone pull-back reveal, film grain, ASMR-adjacent sound design",
    motionPrompt:
      "drone shot over landscape, cut to person sitting by water, close-up of hands opening product, application with eyes closed, deep breath, content smile, drone pulls back to reveal vast nature",
    voiceTone: "serene, meditative, whispered, nature-connected, slow",
    ttsVoice: "fable",
  },
  {
    id: "cine-founder-story",
    family: "cinematic",
    name: "Founder's Story",
    description: "Behind-the-scenes origin story, craft & purpose",
    creatorPrompt:
      "a founder or craftsperson in their workshop, handling raw materials, showing the making process, revealing the finished product with pride",
    stylePrompt:
      "documentary handheld feel, 35mm film grain, natural mixed light, workshop interior with tools and materials, honest textures, warm color grade shifting from raw to polished",
    motionPrompt:
      "close-up of hands working raw materials, camera follows the process, cut to finished product on display, founder holds it up with quiet pride, looks at camera",
    voiceTone: "honest, founder-voice, purposeful, quiet passion, gravitas",
    ttsVoice: "onyx",
  },
];

export function getArchetype(id: string | null | undefined): Archetype | null {
  if (!id) return null;
  return ARCHETYPES.find((a) => a.id === id) ?? null;
}

export function archetypesByFamily(family: ArchetypeFamily): Archetype[] {
  return ARCHETYPES.filter((a) => a.family === family);
}

export const FAMILY_META: Record<
  ArchetypeFamily,
  { name: string; tagline: string; emoji: string }
> = {
  ugc: {
    name: "UGC",
    tagline: "Authentic phone-selfie content, creator-driven",
    emoji: "\u{1F4F1}",
  },
  commercial: {
    name: "Commercial",
    tagline: "Polished brand-safe studio production",
    emoji: "\u{1F3AF}",
  },
  cinematic: {
    name: "Cinematic",
    tagline: "Narrative storytelling with film-look visuals",
    emoji: "\u{1F3AC}",
  },
};
