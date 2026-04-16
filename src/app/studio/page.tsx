"use client";

import { useProfileStore } from "@/lib/stores/profile-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
import { pollManager } from "@/lib/poll-manager";
import { getProfile } from "@/lib/profiles";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  Upload,
  Image as ImageIcon,
  Video,
  Sparkles,
  X,
  Plus,
  Download,
  Maximize2,
  Loader2,
  Film,
  GripVertical,
  Clock,
  Trash2,
} from "lucide-react";
import TemplatePreview from "@/components/studio/TemplatePreview";
import { useT, useTMaybe } from "@/lib/i18n";
import { trackApiCall, calcVideoCost } from "@/lib/stores/api-usage-store";

interface SourceImage {
  id: string;
  url: string;
  file: File | null;
}

export default function StudioPage() {
  const router = useRouter();
  const t = useT();
  const tM = useTMaybe();
  const profileId = useProfileStore((s) => s.activeProfileId);
  const profile = profileId ? getProfile(profileId) : null;

  const {
    contentType, setContentType,
    aspectRatio, setAspectRatio,
    videoModel, setVideoModel,
    selectedTemplate, setSelectedTemplate,
    productDimension, setProductDimension,
  } = useUIStore();

  const generatedImages = useGenerationStore((s) => s.generatedImages);
  const generatedVideo = useGenerationStore((s) => s.generatedVideo);
  const addImages = useGenerationStore((s) => s.addImages);
  const setVideo = useGenerationStore((s) => s.setVideo);
  const clearResults = useGenerationStore((s) => s.clearResults);
  const addHistory = useGenerationStore((s) => s.addHistory);
  const history = useGenerationStore((s) => s.history);
  const clearHistory = useGenerationStore((s) => s.clearHistory);

  // Source images
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null);

  // Character descriptor (fuses into the model prompt for clothing / fashion)
  const [characterGender, setCharacterGender] = useState<string>("any");
  const [characterAge, setCharacterAge] = useState<string>("any");

  // Video mode — free-form idea prompt + refined prompt
  const [videoIdea, setVideoIdea] = useState<string>("");
  const [refinedPrompt, setRefinedPrompt] = useState<string>("");
  const [refining, setRefining] = useState(false);

  // History picker
  const [showHistoryPicker, setShowHistoryPicker] = useState(false);
  const imageHistory = history.filter((h) => h.mode === "image");

  const buildCharacterDescriptor = (gender: string, age: string): string => {
    if (gender === "any" && age === "any") return "";
    // Kid age ranges use child-specific vocabulary (boy / girl / child)
    const isKid = age === "0-3" || age === "4-7" || age === "8-12" || age === "13-17";
    const genderWord = isKid
      ? (gender === "female" ? "girl"
        : gender === "male" ? "boy"
        : "child")
      : (gender === "female" ? "woman"
        : gender === "male" ? "man"
        : gender === "nonbinary" ? "androgynous person"
        : "person");
    const ageWord =
      age === "0-3" ? "toddler aged 1 to 3"
      : age === "4-7" ? "young child aged 4 to 7"
      : age === "8-12" ? "pre-teen aged 8 to 12"
      : age === "13-17" ? "teenager aged 13 to 17"
      : age === "18-24" ? "in their early twenties"
      : age === "25-34" ? "in their late twenties to early thirties"
      : age === "35-44" ? "in their late thirties"
      : age === "45-54" ? "in their late forties"
      : age === "55+" ? "in their sixties"
      : "";
    const phrase = ageWord
      ? (isKid ? `a ${ageWord} ${genderWord === "child" ? "" : `(${genderWord})`}`.trim() : `a ${genderWord} ${ageWord}`)
      : `a ${genderWord}`;
    return `MODEL CHARACTER: The model MUST be ${phrase}. Render their face, body and styling to match this age and gender exactly. `;
  };

  const IMAGE_RATIOS = [
    { value: "1:1", label: `1:1 ${t("studio.square")}` },
    { value: "4:3", label: `4:3 ${t("studio.landscape")}` },
    { value: "3:4", label: `3:4 ${t("studio.portrait")}` },
    { value: "16:9", label: `16:9 ${t("studio.wide")}` },
    { value: "9:16", label: `9:16 ${t("studio.tall")}` },
  ];

  // Kling video models only support these aspect ratios
  const VIDEO_RATIOS = [
    { value: "16:9", label: `16:9 ${t("studio.wide")}` },
    { value: "9:16", label: `9:16 ${t("studio.tall")}` },
    { value: "1:1", label: `1:1 ${t("studio.square")}` },
  ];

  const RATIOS = contentType === "video" ? VIDEO_RATIOS : IMAGE_RATIOS;

  // Redirect if no profile
  useEffect(() => {
    if (!profileId) router.replace("/");
  }, [profileId, router]);

  // Set default aspect ratio from profile
  useEffect(() => {
    if (profile) {
      setAspectRatio(profile.defaultAspectRatio);
    }
  }, [profile, setAspectRatio]);

  const addSourceFromFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    setSourceImages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url, file },
    ]);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) addSourceFromFile(files[i]);
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    [addSourceFromFile]
  );

  const addSourceFromUrl = useCallback((url: string) => {
    setSourceImages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), url, file: null },
    ]);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropOver(false);

      // Check for a generated image URL dragged from results
      const imageUrl = e.dataTransfer.getData("text/generated-image-url");
      if (imageUrl) {
        addSourceFromUrl(imageUrl);
        return;
      }

      // Standard file drop
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) addSourceFromFile(files[i]);
      }
    },
    [addSourceFromFile, addSourceFromUrl]
  );

  const removeSource = (id: string) => {
    setSourceImages((prev) => prev.filter((s) => s.id !== id));
  };

  const uploadSource = async (src: SourceImage): Promise<string | null> => {
    // Already a hosted URL — use directly
    if (src.url.startsWith("http")) return src.url;

    // Get the file to upload — either from the stored File or by fetching a blob URL
    let file = src.file;
    if (!file && src.url.startsWith("blob:")) {
      try {
        const blob = await fetch(src.url).then((r) => r.blob());
        file = new File([blob], "source.png", { type: blob.type || "image/png" });
      } catch (err) {
        console.error("[studio] Failed to fetch blob URL:", err);
        return null;
      }
    }

    if (!file) {
      console.error("[studio] Source has no file and non-uploadable URL:", src.url);
      return null;
    }

    const formData = new FormData();
    formData.append("file", file);
    try {
      return await trackApiCall("fal", "file_upload", "/api/upload", async () => {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (data.error) {
          console.error("[studio] Upload API error:", data.error);
          return null;
        }
        return data.url || null;
      });
    } catch (err) {
      console.error("[studio] Upload failed:", err);
      return null;
    }
  };

  const analyzeProduct = async (imageUrl: string) => {
    return trackApiCall("openai", "product_analysis", "/api/analyze/product", async () => {
      const res = await fetch("/api/analyze/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imageUrl, profileId }),
      });
      return res.json();
    });
  };

  const handleGenerate = async () => {
    const isVideo = contentType === "video";
    if (!profile || sourceImages.length === 0) return;
    // Image mode requires a template; video mode does not
    if (!isVideo && !selectedTemplate) return;

    const template = isVideo ? null : profile.templates.find((t) => t.id === selectedTemplate);
    if (!isVideo && !template) return;

    setLoading(true);
    setError(null);
    clearResults();

    let pendingCount = 0;

    const createAndPollTask = async (prompt: string, ratio: string, imageInput: string[], sourceId: string, sourceUrl: string, bodyOverride?: Record<string, unknown>) => {
      pendingCount++;

      const body: Record<string, unknown> = bodyOverride ?? {
        type: contentType,
        prompt,
        aspect_ratio: ratio,
        image_input: imageInput,
      };

      if (!bodyOverride) {
        if (isVideo) {
          body.video_model = videoModel;
        } else {
          body.resolution = "2K";
        }
      }

      const studioModel = (body.video_model as string) || videoModel;
      const studioVideoCost = isVideo ? calcVideoCost(studioModel, 5, imageInput.length > 0) : undefined;

      const data = await trackApiCall("kie", isVideo ? "video_generation" : "image_generation", "/api/kie", async () => {
        const res = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.json();
      }, isVideo ? { costOverride: studioVideoCost, model: studioModel } : undefined);
      if (data.error) {
        setError(data.error);
        pendingCount--;
        if (pendingCount <= 0) setLoading(false);
        return;
      }

      const taskId = data.taskId;

      // Use global poll manager so polling survives page navigation
      pollManager.start({
        taskId,
        type: isVideo ? "video" : "image",
        intervalMs: 3000,
        budgetMs: 5 * 60 * 1000,
        callbacks: {
          onSuccess: (pollData) => {
            const genStore = useGenerationStore.getState();
            const pd = pollData as Record<string, unknown>;
            if (isVideo && (pd.videos as { url: string }[] | undefined)?.length) {
              const video = { url: (pd.videos as { url: string }[])[0].url };
              genStore.setVideo(video);
              genStore.addHistory({
                id: crypto.randomUUID(),
                sourceUrl,
                resultUrl: video.url,
                profileId: profileId!,
                mode: "video",
                prompt,
                timestamp: Date.now(),
              });
            } else if ((pd.images as { url: string }[] | undefined)?.length) {
              const imgs = (pd.images as { url: string }[]).map((img) => ({
                url: img.url,
                sourceId,
              }));
              genStore.addImages(imgs);
              for (const img of imgs) {
                genStore.addHistory({
                  id: crypto.randomUUID(),
                  sourceUrl,
                  resultUrl: img.url,
                  profileId: profileId!,
                  mode: "image",
                  prompt,
                  timestamp: Date.now(),
                });
              }
            }
            pendingCount--;
            if (pendingCount <= 0) useGenerationStore.getState().setLoading(false);
          },
          onError: (err) => {
            useGenerationStore.getState().setError(err);
            pendingCount--;
            if (pendingCount <= 0) useGenerationStore.getState().setLoading(false);
          },
        },
      });
    };

    try {
      for (const src of sourceImages) {
        const hostedUrl = await uploadSource(src);
        if (!hostedUrl) {
          console.error("[studio] Failed to upload source image:", src.id);
          continue;
        }

        if (isVideo) {
          // Video mode — use refined prompt if available, otherwise raw idea or fallback
          const prompt = refinedPrompt.trim()
            ? refinedPrompt
            : videoIdea.trim()
              ? videoIdea
              : "Cinematic product showcase video. Slow orbiting camera movement around the product, beautiful lighting, shallow depth of field with soft bokeh background, the product gently rotating to reveal all angles, professional commercial quality.";
          const body: Record<string, unknown> = {
            type: "video",
            prompt,
            aspect_ratio: aspectRatio,
            video_model: videoModel,
            reference_image: hostedUrl,
          };
          await createAndPollTask(prompt, aspectRatio, [hostedUrl], src.id, hostedUrl, body);
        } else {
          // Image mode — run product analysis
          let analysis;
          try {
            analysis = await analyzeProduct(hostedUrl);
          } catch (analyzeErr) {
            console.error("[studio] Product analysis failed:", analyzeErr);
            analysis = { type: "product", description: "", body_placement: "" };
          }
          if (analysis.error) {
            console.error("[studio] Analysis error:", analysis.error);
            analysis = { type: "product", description: "", body_placement: "" };
          }

          const sizePrompt = productDimension && profile.sizeConfig
            ? profile.sizeConfig.getSizePrompt(analysis.type || "", analysis.body_placement || "", productDimension)
            : "";
          const productContext = `The product is a ${analysis.type || "item"}: ${analysis.description || ""}. `;
          const characterDescriptor = buildCharacterDescriptor(characterGender, characterAge);

          if (profile.shotTypes.length > 0) {
            for (const shot of profile.shotTypes) {
              const prompt = `${characterDescriptor}${sizePrompt}${productContext}${shot.scenePrompt} ${template!.prompt}`;
              const ratio = shot.aspectRatio || aspectRatio;
              await createAndPollTask(prompt, ratio, [hostedUrl], src.id, hostedUrl);
            }
          } else {
            const prompt = `${characterDescriptor}${sizePrompt}${productContext}${template!.prompt}`;
            await createAndPollTask(prompt, aspectRatio, [hostedUrl], src.id, hostedUrl);
          }
        }
      }

      // If no tasks were created, stop loading
      if (pendingCount === 0) {
        setError("Failed to upload source images. Please try again.");
        setLoading(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setLoading(false);
    }
  };

  // Generate video from a single generated image (image-to-video via Kling)
  const handleGenerateVideoFromImage = async (imageUrl: string) => {
    if (!profile || loading) return;

    // Switch to video mode
    setContentType("video");
    setLoading(true);
    setError(null);
    clearResults();

    try {
      // Build a video prompt from the profile
      const { buildVideoPrompt } = await import("@/lib/utils/prompt-builder");
      const prompt = buildVideoPrompt(profile, "product", "", productDimension);

      const body = {
        type: "video",
        prompt,
        aspect_ratio: aspectRatio === "1:1" ? "16:9" : aspectRatio,
        video_model: videoModel,
        reference_image: imageUrl,
      };

      const i2vCost = calcVideoCost(videoModel, 5, !!imageUrl);

      const data = await trackApiCall("kie", "video_generation", "/api/kie", async () => {
        const res = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.json();
      }, { costOverride: i2vCost, model: videoModel });

      if (data.error) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const taskId = data.taskId;

      pollManager.start({
        taskId,
        type: "video",
        intervalMs: 3000,
        budgetMs: 5 * 60 * 1000,
        callbacks: {
          onSuccess: (pollData) => {
            const genStore = useGenerationStore.getState();
            const pd = pollData as Record<string, unknown>;
            if ((pd.videos as { url: string }[] | undefined)?.length) {
              const video = { url: (pd.videos as { url: string }[])[0].url };
              genStore.setVideo(video);
              genStore.addHistory({
                id: crypto.randomUUID(),
                sourceUrl: imageUrl,
                resultUrl: video.url,
                profileId: profileId!,
                mode: "video",
                prompt,
                timestamp: Date.now(),
              });
            }
            genStore.setLoading(false);
          },
          onError: (err) => {
            useGenerationStore.getState().setError(err);
            useGenerationStore.getState().setLoading(false);
          },
        },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video generation failed");
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Content type toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setContentType("image")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            contentType === "image"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-foreground"
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          {t("studio.staticImage")}
        </button>
        <button
          onClick={() => {
            setContentType("video");
            // Auto-correct aspect ratio if current one isn't supported by Kling
            const validVideoRatios = ["16:9", "9:16", "1:1"];
            if (!validVideoRatios.includes(aspectRatio)) {
              setAspectRatio("16:9");
            }
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
            contentType === "video"
              ? "bg-primary text-white"
              : "border border-border text-muted hover:text-foreground"
          }`}
        >
          <Video className="w-4 h-4" />
          {t("studio.video")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column — Sources + Controls */}
        <div className="space-y-4">
          {/* Source images */}
          <div className="rounded-2xl border border-border bg-card/50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {t("studio.sourceImages")}
            </h2>
            <div
              className={`rounded-xl border-2 border-dashed transition-all min-h-[200px] flex flex-col items-center justify-center ${
                dropOver ? "border-accent bg-accent/5" : "border-border"
              }`}
              onDragOver={(e) => { e.preventDefault(); setDropOver(true); }}
              onDragLeave={() => setDropOver(false)}
              onDrop={handleDrop}
            >
              {sourceImages.length === 0 ? (
                <>
                  <Upload className="w-10 h-10 text-muted/40 mb-3" />
                  <p className="text-sm font-medium text-foreground/70">{t("studio.dropImages")}</p>
                  <p className="text-xs text-muted mt-1">{t("studio.fileTypes")}</p>
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition-colors"
                    >
                      {t("studio.browseFiles")}
                    </button>
                    {imageHistory.length > 0 && (
                      <button
                        onClick={() => setShowHistoryPicker(true)}
                        className="px-5 py-2.5 rounded-full text-sm font-medium border border-border hover:border-accent hover:text-accent transition-colors flex items-center gap-1.5"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        {t("studio.fromHistory")}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="w-full p-3">
                  <div className="flex gap-3 flex-wrap">
                    {sourceImages.map((src) => (
                      <div key={src.id} className="group relative w-24 h-24 rounded-xl overflow-hidden border border-border">
                        <img src={src.url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeSource(src.id)}
                          className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3 text-white" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="text-[10px] mt-1">{t("studio.add")}</span>
                    </button>
                    {imageHistory.length > 0 && (
                      <button
                        onClick={() => setShowHistoryPicker(true)}
                        className="w-24 h-24 rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center text-muted hover:border-accent hover:text-accent transition-colors"
                      >
                        <Clock className="w-4 h-4" />
                        <span className="text-[10px] mt-1">{t("studio.history")}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />

            {contentType === "video" ? (
              <>
                {/* Video mode — idea prompt + refine + model selector */}
                <div className="mt-4 pt-3 border-t border-border space-y-3">
                  <div>
                    <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.videoIdeaLabel")}</label>
                    <textarea
                      value={videoIdea}
                      onChange={(e) => { setVideoIdea(e.target.value); setRefinedPrompt(""); }}
                      placeholder={t("studio.videoIdeaPlaceholder")}
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all placeholder:text-muted/40 resize-none"
                    />
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-muted">{t("studio.videoIdeaHint")}</p>
                      <button
                        onClick={async () => {
                          if (!videoIdea.trim() || refining) return;
                          setRefining(true);
                          try {
                            // Use the first source image URL if available for context
                            let imgUrl: string | undefined;
                            if (sourceImages.length > 0 && sourceImages[0].url.startsWith("http")) {
                              imgUrl = sourceImages[0].url;
                            }
                            const res = await fetch("/api/analyze/refine-video-prompt", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ idea: videoIdea, imageUrl: imgUrl }),
                            });
                            const data = await res.json();
                            setRefinedPrompt(data.prompt || videoIdea);
                          } catch {
                            setRefinedPrompt(videoIdea);
                          } finally {
                            setRefining(false);
                          }
                        }}
                        disabled={!videoIdea.trim() || refining}
                        className="shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-foreground/5 border border-border hover:border-accent/40 hover:bg-accent/5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {refining ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                        {refining ? t("studio.refining") : t("studio.aiRefine")}
                      </button>
                    </div>
                  </div>

                  {/* Refined prompt — editable */}
                  {refinedPrompt && (
                    <div>
                      <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.refinedPromptLabel")}</label>
                      <textarea
                        value={refinedPrompt}
                        onChange={(e) => setRefinedPrompt(e.target.value)}
                        rows={5}
                        className="w-full px-3 py-2 rounded-xl bg-accent/5 border border-accent/20 text-sm focus:outline-none focus:border-accent/40 transition-all resize-none"
                      />
                      <p className="text-[10px] text-muted mt-1">{t("studio.refinedPromptHint")}</p>
                    </div>
                  )}

                  <div className="flex items-end gap-3">
                    <div className="shrink-0">
                      <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.aspectRatio")}</label>
                      <select
                        value={aspectRatio}
                        onChange={(e) => setAspectRatio(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                      >
                        {RATIOS.map((r) => (
                          <option key={r.value} value={r.value}>{r.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="shrink-0">
                      <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.videoModel")}</label>
                      <select
                        value={videoModel}
                        onChange={(e) => setVideoModel(e.target.value)}
                        className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                      >
                        <option value="kling-2.6">Kling 2.6</option>
                        <option value="kling-3.0">Kling 3.0</option>
                        <option value="kling-2.5-turbo">Kling 2.5 Turbo</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || sourceImages.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {t("studio.generate")}
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Image mode — controls row */}
                <div className="flex flex-wrap items-end gap-3 mt-4 pt-3 border-t border-border">
                  <div className="shrink-0">
                    <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.aspectRatio")}</label>
                    <select
                      value={aspectRatio}
                      onChange={(e) => setAspectRatio(e.target.value)}
                      className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                    >
                      {RATIOS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                  </div>

                  {profile.sizeConfig && (
                    <div className="shrink-0">
                      <label className="text-[11px] font-medium text-foreground/70 mb-1 block">
                        {tM(profile.sizeConfig.label, profile.sizeConfig.label)}
                      </label>
                      <input
                        type="text"
                        value={productDimension}
                        onChange={(e) => setProductDimension(e.target.value)}
                        placeholder={tM(profile.sizeConfig.placeholder, profile.sizeConfig.placeholder)}
                        className="w-28 px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all placeholder:text-muted/40"
                      />
                    </div>
                  )}

                  {profile.id === "clothing" && (
                    <>
                      <div className="shrink-0">
                        <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.gender")}</label>
                        <select
                          value={characterGender}
                          onChange={(e) => setCharacterGender(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                        >
                          <option value="any">{t("studio.genderAny")}</option>
                          <option value="female">{t("studio.genderFemale")}</option>
                          <option value="male">{t("studio.genderMale")}</option>
                          <option value="nonbinary">{t("studio.genderNonbinary")}</option>
                        </select>
                      </div>
                      <div className="shrink-0">
                        <label className="text-[11px] font-medium text-foreground/70 mb-1 block">{t("studio.age")}</label>
                        <select
                          value={characterAge}
                          onChange={(e) => setCharacterAge(e.target.value)}
                          className="px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all appearance-none"
                        >
                          <option value="any">{t("studio.ageAny")}</option>
                          <option value="0-3">{t("studio.ageToddler")}</option>
                          <option value="4-7">{t("studio.ageKid")}</option>
                          <option value="8-12">{t("studio.agePreteen")}</option>
                          <option value="13-17">{t("studio.ageTeen")}</option>
                          <option value="18-24">18–24</option>
                          <option value="25-34">25–34</option>
                          <option value="35-44">35–44</option>
                          <option value="45-54">45–54</option>
                          <option value="55+">55+</option>
                        </select>
                      </div>
                    </>
                  )}
                </div>

                {/* Generate button */}
                <div className="flex justify-end mt-3">
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !selectedTemplate || sourceImages.length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    {t("studio.generate")}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Template selector — image mode only */}
          {contentType !== "video" && (
          <div className="rounded-2xl border border-border bg-card/50 p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
              {tM(`profile.${profile.id}`, profile.name)} {t("studio.templates")}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {profile.templates.map((tmpl) => (
                <TemplatePreview key={tmpl.id} template={tmpl}>
                  <button
                    onClick={() => setSelectedTemplate(tmpl.id === selectedTemplate ? null : tmpl.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                      tmpl.id === selectedTemplate
                        ? "border-accent bg-accent/5"
                        : "border-border hover:border-border-hover"
                    }`}
                  >
                    <span className="text-xl shrink-0">{tmpl.icon}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{tM(`tpl.${tmpl.id}.name`, tmpl.name)}</p>
                      <p className="text-[11px] text-muted leading-relaxed line-clamp-2">{tM(`tpl.${tmpl.id}.desc`, tmpl.description)}</p>
                    </div>
                  </button>
                </TemplatePreview>
              ))}
            </div>
          </div>
          )}
        </div>

        {/* Right column — Results */}
        <div className="rounded-2xl border border-border bg-card/50 p-4 min-h-[400px]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
            {t("studio.generatedResults")}
          </h2>

          {error && (
            <div className="mb-3 p-3 rounded-xl bg-danger/10 border border-danger/20 text-sm text-danger">
              {error}
            </div>
          )}

          {loading && generatedImages.length === 0 && !generatedVideo && (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <Loader2 className="w-8 h-8 animate-spin mb-3" />
              <p className="text-sm">{t("studio.generating")}</p>
              <p className="text-xs mt-1">{t("studio.generatingTime")}</p>
            </div>
          )}

          {!loading && generatedImages.length === 0 && !generatedVideo && (
            <div className="flex flex-col items-center justify-center py-20 text-muted">
              <ImageIcon className="w-12 h-12 text-muted/30 mb-3" />
              <p className="text-sm">{t("studio.emptyResults")}</p>
              <p className="text-xs mt-1">{t("studio.emptyHint")}</p>
            </div>
          )}

          {generatedVideo && (
            <div className="mb-3">
              <video
                src={generatedVideo.url}
                controls
                autoPlay
                loop
                className="w-full rounded-xl border border-border"
                             />
              <a
                href={generatedVideo.url}
                download
                target="_blank"
                className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-sm rounded-full border border-border hover:border-accent transition-colors"
              >
                <Download className="w-4 h-4" />
                {t("studio.downloadVideo")}
              </a>
            </div>
          )}

          {generatedImages.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {generatedImages.map((img, i) => (
                <div
                  key={i}
                  className="group relative rounded-xl overflow-hidden border border-border bg-card cursor-grab active:cursor-grabbing"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/generated-image-url", img.url);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                >
                  {/* Drag hint */}
                  <div className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-70 transition-opacity">
                    <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
                  </div>
                  <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleGenerateVideoFromImage(img.url)}
                      disabled={loading}
                      className="w-9 h-9 bg-accent/90 hover:bg-accent rounded-full flex items-center justify-center shadow-lg disabled:opacity-40"
                      title={t("studio.generateVideoFromImage")}
                    >
                      <Film className="w-4 h-4 text-white" />
                    </button>
                    <button
                      onClick={() => setMaximizedImage(img.url)}
                      className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>
                    <a
                      href={img.url}
                      download
                      target="_blank"
                      className="w-9 h-9 bg-white/90 rounded-full flex items-center justify-center"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  </div>
                  {/* Video generation label */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white/80 font-medium">{t("studio.dragOrClickVideo")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content History */}
      {history.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/50 p-4 mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {t("studio.contentHistory")}
            </h2>
            <button
              onClick={clearHistory}
              className="text-[10px] text-muted hover:text-danger transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              {t("studio.clearHistory")}
            </button>
          </div>
          <p className="text-[10px] text-muted mb-3">{t("studio.historyDragHint")}</p>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {history.filter((h) => h.mode === "image").map((item) => (
              <div
                key={item.id}
                className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-card cursor-grab active:cursor-grabbing hover:border-accent/40 transition-colors"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/generated-image-url", item.resultUrl);
                  e.dataTransfer.effectAllowed = "copy";
                }}
              >
                <img
                  src={item.resultUrl}
                  alt=""
                  className="w-full h-full object-cover"
                                   loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <GripVertical className="w-4 h-4 text-white drop-shadow-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History picker modal */}
      {showHistoryPicker && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6"
          onClick={() => setShowHistoryPicker(false)}
        >
          <div
            className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-lg max-h-[70vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-sm font-semibold">{t("studio.selectFromHistory")}</h3>
              <button
                onClick={() => setShowHistoryPicker(false)}
                className="w-7 h-7 rounded-full hover:bg-foreground/5 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-2">
                {imageHistory.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      addSourceFromUrl(item.resultUrl);
                      setShowHistoryPicker(false);
                    }}
                    className="group relative aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-accent transition-colors"
                  >
                    <img
                      src={item.resultUrl}
                      alt=""
                      className="w-full h-full object-cover"
                                           loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Plus className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  </button>
                ))}
              </div>
              {imageHistory.length === 0 && (
                <p className="text-sm text-muted text-center py-8">{t("studio.noHistoryYet")}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Maximized overlay */}
      {maximizedImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8"
          onClick={() => setMaximizedImage(null)}
        >
          <img
            src={maximizedImage}
            alt=""
            className="max-w-full max-h-full rounded-xl"
                     />
          <button
            onClick={() => setMaximizedImage(null)}
            className="absolute top-6 right-6 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
      )}
    </div>
  );
}
