"use client";

import { useProfileStore } from "@/lib/stores/profile-store";
import { useUIStore } from "@/lib/stores/ui-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
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
} from "lucide-react";
import TemplatePreview from "@/components/studio/TemplatePreview";
import { useT, useTMaybe } from "@/lib/i18n";
import { trackApiCall } from "@/lib/stores/api-usage-store";

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

  // Source images
  const [sourceImages, setSourceImages] = useState<SourceImage[]>([]);
  const [dropOver, setDropOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [maximizedImage, setMaximizedImage] = useState<string | null>(null);

  const RATIOS = [
    { value: "1:1", label: `1:1 ${t("studio.square")}` },
    { value: "4:3", label: `4:3 ${t("studio.landscape")}` },
    { value: "3:4", label: `3:4 ${t("studio.portrait")}` },
    { value: "16:9", label: `16:9 ${t("studio.wide")}` },
    { value: "9:16", label: `9:16 ${t("studio.tall")}` },
  ];

  // Redirect if no profile
  useEffect(() => {
    if (!profileId) router.replace("/onboarding");
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

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDropOver(false);
      const files = e.dataTransfer.files;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) addSourceFromFile(files[i]);
      }
    },
    [addSourceFromFile]
  );

  const removeSource = (id: string) => {
    setSourceImages((prev) => prev.filter((s) => s.id !== id));
  };

  const uploadSource = async (src: SourceImage): Promise<string | null> => {
    if (src.url.startsWith("http")) return src.url;
    if (!src.file) return null;
    const formData = new FormData();
    formData.append("file", src.file);
    try {
      return await trackApiCall("fal", "file_upload", "/api/upload", async () => {
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        return data.url || null;
      });
    } catch {
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
    if (!profile || !selectedTemplate || sourceImages.length === 0) return;

    const template = profile.templates.find((t) => t.id === selectedTemplate);
    if (!template) return;

    const isVideo = contentType === "video";

    setLoading(true);
    setError(null);
    clearResults();

    let pendingCount = 0;

    const createAndPollTask = async (prompt: string, ratio: string, imageInput: string[], sourceId: string, sourceUrl: string) => {
      pendingCount++;

      const body: Record<string, unknown> = {
        type: contentType,
        prompt,
        aspect_ratio: ratio,
        image_input: imageInput,
      };

      if (isVideo) {
        body.video_model = videoModel;
      } else {
        body.resolution = "2K";
      }

      const data = await trackApiCall("kie", isVideo ? "video_generation" : "image_generation", "/api/kie", async () => {
        const res = await fetch("/api/kie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        return res.json();
      });
      if (data.error) {
        setError(data.error);
        pendingCount--;
        if (pendingCount <= 0) setLoading(false);
        return;
      }

      const taskId = data.taskId;
      const poll = setInterval(async () => {
        try {
          const pollRes = await fetch(`/api/kie?taskId=${taskId}&type=${contentType}`);
          const pollData = await pollRes.json();

          if (pollData.status === "success") {
            clearInterval(poll);
            if (isVideo && pollData.videos?.length) {
              const video = { url: pollData.videos[0].url };
              setVideo(video);
              addHistory({
                id: crypto.randomUUID(),
                sourceUrl,
                resultUrl: video.url,
                profileId: profileId!,
                mode: "video",
                prompt,
                timestamp: Date.now(),
              });
            } else if (pollData.images) {
              const newImages = pollData.images.map((img: { url: string }) => ({
                url: img.url,
                sourceId,
              }));
              addImages(newImages);
              for (const img of newImages) {
                addHistory({
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
            if (pendingCount <= 0) setLoading(false);
          } else if (pollData.status === "fail") {
            clearInterval(poll);
            setError(pollData.error || "Generation failed");
            pendingCount--;
            if (pendingCount <= 0) setLoading(false);
          }
        } catch {
          // Transient error, keep polling
        }
      }, 3000);
    };

    try {
      for (const src of sourceImages) {
        const hostedUrl = await uploadSource(src);
        if (!hostedUrl) continue;

        const analysis = await analyzeProduct(hostedUrl);

        const sizePrompt = productDimension && profile.sizeConfig
          ? profile.sizeConfig.getSizePrompt(analysis.type || "", analysis.body_placement || "", productDimension)
          : "";

        const productContext = `The product is a ${analysis.type || "item"}: ${analysis.description || ""}. `;

        if (profile.shotTypes.length > 0) {
          for (const shot of profile.shotTypes) {
            const prompt = `${sizePrompt}${productContext}${shot.scenePrompt} ${template.prompt}`;
            const ratio = shot.aspectRatio || aspectRatio;
            await createAndPollTask(prompt, ratio, [hostedUrl], src.id, hostedUrl);
          }
        } else {
          const prompt = `${sizePrompt}${productContext}${template.prompt}`;
          await createAndPollTask(prompt, aspectRatio, [hostedUrl], src.id, hostedUrl);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
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
          onClick={() => setContentType("video")}
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
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 px-6 py-2.5 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition-colors"
                  >
                    {t("studio.browseFiles")}
                  </button>
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

            {/* Controls row */}
            <div className="flex items-end gap-3 mt-4 pt-3 border-t border-border">
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
                    {profile.sizeConfig.label}
                  </label>
                  <input
                    type="text"
                    value={productDimension}
                    onChange={(e) => setProductDimension(e.target.value)}
                    placeholder={profile.sizeConfig.placeholder}
                    className="w-28 px-3 py-2 rounded-xl bg-card border border-border text-sm focus:outline-none focus:border-accent/30 transition-all placeholder:text-muted/40"
                  />
                </div>
              )}

              {contentType === "video" && (
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
              )}

              <button
                onClick={handleGenerate}
                disabled={loading || !selectedTemplate || sourceImages.length === 0}
                className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-accent text-white rounded-full text-sm font-semibold hover:bg-accent-light transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {t("studio.generate")}
              </button>
            </div>
          </div>

          {/* Template selector */}
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
                crossOrigin="anonymous"
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
                <div key={i} className="group relative rounded-xl overflow-hidden border border-border bg-card">
                  <img src={img.url} alt="" className="w-full aspect-square object-cover" crossOrigin="anonymous" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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
            crossOrigin="anonymous"
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
