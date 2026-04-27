import { NextRequest, NextResponse } from "next/server";
import { fal } from "@fal-ai/client";

export const maxDuration = 120;

const MODEL_ID = "fal-ai/mmaudio-v2";

function configureFal() {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY environment variable is not set");
  fal.config({ credentials: key });
}

/**
 * Maps archetype ID to a focused music-mood description for MMAudio.
 * Shorter, genre-anchored prompts produce more consistent results than
 * long descriptions.
 */
const ARCHETYPE_MUSIC: Record<string, string> = {
  "ugc-busy-professional":
    "upbeat modern corporate pop, clean driving beat, professional energy, no vocals",
  "ugc-fitness-enthusiast":
    "high-energy electronic workout music, pulsating EDM beat, motivational, no vocals",
  "ugc-student":
    "chill lo-fi hip hop, warm vinyl texture, relaxed and cool, no vocals",
  "ugc-lifestyle-creator":
    "trendy aesthetic pop instrumental, modern indie vibes, aspirational, no vocals",
  "ugc-beauty-creator":
    "elegant soft pop instrumental, dreamy and aspirational, TikTok beauty vibe, no vocals",
  "ugc-foodie":
    "warm upbeat acoustic pop, cozy and inviting, feel-good vibes, no vocals",
};

const FAMILY_MUSIC: Record<string, string> = {
  ugc: "upbeat modern pop background music, TikTok social media style, energetic and catchy, no vocals",
  commercial:
    "elegant cinematic background music, luxury brand advertisement, subtle orchestral swells, no vocals",
  cinematic:
    "sweeping cinematic orchestral music, dramatic tension and release, film score quality, no vocals",
};

// POST — submit video to MMAudio for soundtrack generation
export async function POST(req: NextRequest) {
  try {
    configureFal();
    const body = await req.json();
    const { videoUrl, archetypeId, family, duration } = body;

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const musicPrompt =
      (archetypeId && ARCHETYPE_MUSIC[archetypeId]) ||
      (family && FAMILY_MUSIC[family]) ||
      FAMILY_MUSIC.ugc;

    const input = {
      video_url: videoUrl,
      prompt: musicPrompt,
      negative_prompt: "voice, speech, narration, singing, lyrics, human speech, talking",
      num_steps: 25,
      duration: typeof duration === "number" ? Math.min(duration, 10) : 8,
      cfg_strength: 4.5,
      mask_away_clip: false,
    };

    console.log(`[ugc/music] submit: archetype=${archetypeId} family=${family} prompt="${musicPrompt.slice(0, 60)}..."`);

    const { request_id } = await fal.queue.submit(MODEL_ID, { input });

    console.log(`[ugc/music] queued request_id=${request_id}`);
    return NextResponse.json({ request_id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[ugc/music] submit error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET — poll MMAudio status
export async function GET(req: NextRequest) {
  try {
    configureFal();
    const request_id = req.nextUrl.searchParams.get("request_id");
    if (!request_id) {
      return NextResponse.json({ error: "request_id required" }, { status: 400 });
    }

    const status = await fal.queue.status(MODEL_ID, { requestId: request_id });
    const raw = (status as { status?: string }).status || "";
    const normalized =
      raw === "COMPLETED"
        ? "success"
        : raw === "FAILED" || raw === "ERROR" || raw === "CANCELLED"
        ? "fail"
        : "pending";

    if (normalized === "success" || normalized === "fail") {
      let result: Record<string, unknown> = {};
      try {
        result = (await fal.queue.result(MODEL_ID, { requestId: request_id })) as Record<string, unknown>;
      } catch (err) {
        return NextResponse.json({ status: "fail", error: String(err) });
      }

      const data = (result.data ?? result) as Record<string, unknown>;

      if (normalized === "fail") {
        const errMsg =
          (data.error as string) ||
          (data.detail as string) ||
          "Music generation failed";
        console.error(`[ugc/music] ${request_id} failed:`, errMsg);
        return NextResponse.json({ status: "fail", error: errMsg });
      }

      // MMAudio returns { video: { url } }
      const videoData = data.video as { url?: string } | undefined;
      const videoUrl = videoData?.url;
      if (!videoUrl) {
        console.error(`[ugc/music] ${request_id} no video in result:`, JSON.stringify(data).slice(0, 300));
        return NextResponse.json({ status: "fail", error: "No video URL in result" });
      }

      console.log(`[ugc/music] ${request_id} success → ${videoUrl.slice(0, 80)}`);
      return NextResponse.json({ status: "success", videoUrl });
    }

    return NextResponse.json({ status: "pending" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[ugc/music] poll error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
