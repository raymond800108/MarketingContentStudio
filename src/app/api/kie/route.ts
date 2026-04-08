import { NextRequest, NextResponse } from "next/server";

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
    } = body;

    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    let endpoint: string;
    let payload: Record<string, unknown>;

    if (type === "video") {
      endpoint = `${KIE_BASE}/jobs/createTask`;
      const isImageToVideo = !!reference_image;

      const modelMap: Record<string, { text: string; image: string }> = {
        "kling-2.6": { text: "kling-2.6/text-to-video", image: "kling-2.6/image-to-video" },
        "kling-3.0": { text: "kling-3.0", image: "kling-3.0" },
        "kling-2.5-turbo": { text: "kling-2.5-turbo", image: "kling-2.5-turbo" },
      };

      const mapped = modelMap[video_model] || modelMap["kling-2.6"];
      const model = isImageToVideo ? mapped.image : mapped.text;

      const input: Record<string, unknown> = {
        prompt,
        aspect_ratio: aspect_ratio || "16:9",
      };

      if (reference_image) {
        input.image_urls = [reference_image];
      }
      input.sound = false;
      input.duration = "5";

      payload = { model, input };
    } else {
      endpoint = `${KIE_BASE}/jobs/createTask`;
      const input: Record<string, unknown> = {
        prompt: negative_prompt ? `${prompt}. Avoid: ${negative_prompt}` : prompt,
        aspect_ratio: aspect_ratio || "1:1",
        resolution: resolution || "2K",
        output_format: output_format || "jpg",
      };
      if (image_input && Array.isArray(image_input) && image_input.length > 0) {
        input.image_input = image_input.slice(0, 14);
      }
      payload = { model: "nano-banana-2", input };
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
    const result: Record<string, unknown> = {
      taskId: task.taskId,
      status: task.state,
      type,
    };

    if (task.state === "success" && task.resultJson) {
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

    if (task.state === "fail") {
      result.error = task.failMsg || "Generation failed";
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[kie] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
