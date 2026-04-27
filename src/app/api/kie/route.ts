import { NextRequest, NextResponse } from "next/server";

// Kie.ai gpt-image-2 polling can stretch past 60s on busy days. Allow 90s.
export const maxDuration = 90;

const KIE_BASE = "https://api.kie.ai/api/v1";

function getKey() {
  const key = process.env.KIE_API_KEY;
  if (!key) throw new Error("KIE_API_KEY environment variable is not set");
  return key;
}

function headers() {
  return {
    Authorization: `Bearer ${getKey()}`,
    "Content-Type": "application/json",
  };
}

// ─── Kie.ai gpt-image-2 image generation ───
// Routes through Kie's unified /jobs/createTask endpoint — same endpoint
// Seedance/Kling video already use, so polling flows through the existing
// /jobs/recordInfo handler with no special prefix needed.
//
// Models on Kie:
//   gpt-image-2-text-to-image  → prompt only
//   gpt-image-2-image-to-image → prompt + input_urls (1-16 reference images)
//
// Aspect ratios: auto | 1:1 | 9:16 | 16:9 | 4:3 | 3:4 (9:16 native!)
// Resolution:    1K | 2K | 4K  (note: 1:1 cannot go to 4K)
//
// Kie's organization is verified with OpenAI, so individual users don't
// need to verify their own OpenAI org for gpt-image-2.

function aspectRatioToKieGptImage2(aspect_ratio: string): "1:1" | "9:16" | "16:9" | "4:3" | "3:4" {
  // Kie gpt-image-2 supports 1:1, 9:16, 16:9, 4:3, 3:4. Map our broader set:
  if (aspect_ratio === "9:16" || aspect_ratio === "2:3") return "9:16";
  if (aspect_ratio === "3:4") return "3:4";
  if (aspect_ratio === "16:9" || aspect_ratio === "3:2" || aspect_ratio === "21:9") return "16:9";
  if (aspect_ratio === "4:3") return "4:3";
  return "1:1";
}

// POST — create image or video generation task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      type = "image",
      prompt,
      negative_prompt = "",
      aspect_ratio = "1:1",
      resolution = "2K",
      output_format = "jpg",
      image_input = [],
      video_model = "kling-2.6",
      reference_image,
      // Seedance-specific inputs (ignored by Kling):
      reference_image_urls = [],
      reference_audio_urls = [],
      first_frame_url,
      last_frame_url,
      generate_audio = true,
      duration,
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    let endpoint: string;
    let payload: Record<string, unknown>;

    if (type === "video") {
      endpoint = `${KIE_BASE}/jobs/createTask`;

      const isSeedance = video_model === "seedance-2" || video_model === "seedance-2-fast";

      if (isSeedance) {
        // ByteDance Seedance 2.0 on Kie.ai.
        // Three mutually-exclusive conditioning modes:
        //   A) prompt-only
        //   B) first_frame_url (+ optional last_frame_url)
        //   C) reference_image_urls / reference_audio_urls / reference_video_urls
        const model =
          video_model === "seedance-2-fast"
            ? "bytedance/seedance-2-fast"
            : "bytedance/seedance-2";

        // Seedance supports richer AR set than Kling
        const VALID = ["1:1", "4:3", "3:4", "16:9", "9:16", "21:9", "adaptive"];
        const ratio = VALID.includes(aspect_ratio) ? aspect_ratio : "9:16";

        const input: Record<string, unknown> = {
          prompt,
          aspect_ratio: ratio,
          resolution: resolution === "1080p" ? "720p" : (resolution || "720p"),
          duration: typeof duration === "number" ? duration : 8,
          generate_audio: generate_audio !== false,
        };

        // Mode B vs C — enforce exclusivity
        const hasRefs =
          (Array.isArray(reference_image_urls) && reference_image_urls.length > 0) ||
          (Array.isArray(reference_audio_urls) && reference_audio_urls.length > 0);
        const hasKeyframes = !!first_frame_url || !!last_frame_url;

        if (hasKeyframes && hasRefs) {
          return NextResponse.json(
            { error: "Seedance: keyframes (first/last) and reference_image_urls/reference_audio_urls are mutually exclusive — send only one group." },
            { status: 400 }
          );
        }

        if (hasKeyframes) {
          if (first_frame_url) input.first_frame_url = first_frame_url;
          if (last_frame_url) input.last_frame_url = last_frame_url;
        } else if (hasRefs) {
          if (reference_image_urls.length > 0) {
            input.reference_image_urls = (reference_image_urls as string[]).slice(0, 9);
          }
          if (reference_audio_urls.length > 0) {
            input.reference_audio_urls = (reference_audio_urls as string[]).slice(0, 3);
          }
        }

        payload = { model, input };
      } else {
        // Kling family
        const isImageToVideo = !!reference_image;

        const modelMap: Record<string, { text: string; image: string }> = {
          "kling-2.6": { text: "kling-2.6/text-to-video", image: "kling-2.6/image-to-video" },
          "kling-3.0": { text: "kling-3.0/video", image: "kling-3.0/video" },
          "kling-2.5-turbo": { text: "kling-2.5-turbo", image: "kling-2.5-turbo" },
        };

        const mapped = modelMap[video_model] || modelMap["kling-2.6"];
        const model = isImageToVideo ? mapped.image : mapped.text;

        // Kling only supports 16:9, 9:16, and 1:1 — map anything else to closest
        const VALID_VIDEO_RATIOS = ["16:9", "9:16", "1:1"];
        const VIDEO_RATIO_MAP: Record<string, string> = {
          "4:3": "16:9",
          "3:4": "9:16",
          "3:2": "16:9",
          "2:3": "9:16",
        };
        let videoRatio = aspect_ratio || "16:9";
        if (!VALID_VIDEO_RATIOS.includes(videoRatio)) {
          videoRatio = VIDEO_RATIO_MAP[videoRatio] || "16:9";
          console.log(`[kie] Mapped unsupported video aspect_ratio "${aspect_ratio}" → "${videoRatio}"`);
        }

        const input: Record<string, unknown> = {
          prompt,
          aspect_ratio: videoRatio,
        };

        if (reference_image) {
          input.image_urls = [reference_image];
        }
        input.sound = false;
        input.duration = "5";
        if (video_model === "kling-3.0") {
          input.mode = "std";
          input.multi_shots = false;
        }

        payload = { model, input };
      }
    } else {
      // ─── IMAGE PATH — Kie.ai gpt-image-2 via /jobs/createTask ───
      // Routes through Kie's unified jobs endpoint — same one Seedance + Kling
      // already use, so polling flows through the standard /jobs/recordInfo
      // handler below with no special prefix needed. Kie's org is verified
      // with OpenAI, so individual users don't need to verify their own.
      endpoint = `${KIE_BASE}/jobs/createTask`;
      const fullPrompt = negative_prompt ? `${prompt}. Avoid: ${negative_prompt}` : prompt;
      const refs: string[] = Array.isArray(image_input)
        ? image_input.slice(0, 16).filter(Boolean)
        : [];
      const ratio = aspectRatioToKieGptImage2(aspect_ratio || "1:1");
      // Kie constraint: 1:1 cannot go to 4K. Default to 2K otherwise.
      const kieResolution = resolution === "4K" && ratio === "1:1" ? "2K" : (resolution === "4K" || resolution === "1K" ? resolution : "2K");
      const model =
        refs.length > 0
          ? "gpt-image-2-image-to-image"
          : "gpt-image-2-text-to-image";
      const input: Record<string, unknown> = {
        prompt: fullPrompt,
        aspect_ratio: ratio,
        resolution: kieResolution,
      };
      if (refs.length > 0) input.input_urls = refs;
      payload = { model, input };
      console.log(
        `[kie/gpt-image-2] model=${model} prompt(${fullPrompt.length} chars) refs=${refs.length} ar=${ratio} res=${kieResolution}`
      );
    }

    console.log(`[kie] Creating ${type} task:`, JSON.stringify(payload).slice(0, 500));

    const res = await fetch(endpoint, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (data.code !== 200) {
      console.error("[kie] Create error:", JSON.stringify(data));
      return NextResponse.json(
        { error: data.msg || `Failed to create task (code ${data.code})` },
        { status: res.status >= 400 ? res.status : 500 }
      );
    }

    const taskId = data.data?.taskId;
    console.log(`[kie] Task created: ${taskId}`);
    return NextResponse.json({ taskId, type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[kie] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET — poll task status
export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get("taskId");
    const type = req.nextUrl.searchParams.get("type") || "image";

    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    // gpt-image-2 image tasks now route through Kie's unified /jobs/createTask
    // (same as Seedance/Kling video), so the standard /jobs/recordInfo poll
    // below handles them — no special prefix needed.
    const endpoint = `${KIE_BASE}/jobs/recordInfo?taskId=${taskId}`;
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${getKey()}` },
    });

    const data = await res.json();

    if (data.code !== 200) {
      console.error("[kie] Poll error:", JSON.stringify(data));
      return NextResponse.json(
        { error: data.msg || "Failed to get task status" },
        { status: 500 }
      );
    }

    const task = data.data;
    // Kie.ai states: "pending", "processing", "success", "fail"
    // Normalize to ensure we handle all cases
    const rawState = (task.state || "").toLowerCase();
    const normalizedState = rawState === "completed" ? "success"
      : rawState === "failed" || rawState === "error" ? "fail"
      : rawState; // "pending", "processing", "success", "fail"

    console.log(`[kie] Poll ${taskId}: state=${task.state} (normalized=${normalizedState}), hasResult=${!!task.resultJson}`);

    const result: Record<string, unknown> = {
      taskId: task.taskId,
      status: normalizedState,
      type,
    };

    if (normalizedState === "success" && task.resultJson) {
      try {
        const parsed =
          typeof task.resultJson === "string"
            ? JSON.parse(task.resultJson)
            : task.resultJson;

        if (type === "video") {
          const urls = parsed.resultUrls || parsed.videos;
          if (urls && Array.isArray(urls) && urls.length > 0) {
            result.videos = urls.map((url: string) => ({ url }));
          }
        } else {
          if (parsed.resultUrls && Array.isArray(parsed.resultUrls)) {
            result.images = parsed.resultUrls.map((url: string) => ({ url }));
          }
        }
      } catch {
        console.error("[kie] Failed to parse resultJson:", task.resultJson);
      }
    }

    if (normalizedState === "fail") {
      // Include every scrap of diagnostic info Kie hands back so failures
      // surface with actionable context (code, task id, message, etc.)
      const failCode = task.failCode || task.errorCode;
      const failMsg = task.failMsg || task.errorMsg || "Generation failed";
      result.error =
        failCode && failCode !== 200
          ? `${failMsg} (code ${failCode}, taskId ${task.taskId})`
          : `${failMsg} (taskId ${task.taskId})`;
      console.error(
        `[kie] Task ${task.taskId} failed — code=${failCode} msg=${failMsg}`,
        JSON.stringify(task).slice(0, 500)
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[kie] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
