"use client";

import { useState, useRef, useEffect } from "react";
import type { Template } from "@/lib/profiles/types";
import { useProfileStore } from "@/lib/stores/profile-store";

// Generate a consistent gradient based on template id
function getGradient(id: string): string {
  const gradients: Record<string, string> = {
    // Jewelry
    "clean-neutral": "linear-gradient(135deg, #f5f5f5 0%, #e8e6e3 50%, #faf9f7 100%)",
    "elemental-artistic": "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 100%)",
    "detail-closeup": "linear-gradient(135deg, #2d2d2d 0%, #4a4a4a 50%, #2d2d2d 100%)",
    "packaging-box": "linear-gradient(135deg, #1a0a2e 0%, #2d1b4e 50%, #4a2c6e 100%)",
    "natural-branches": "linear-gradient(135deg, #2d4a2d 0%, #4a6b3a 50%, #8fbc8f 100%)",
    "vintage-heritage": "linear-gradient(135deg, #8b7355 0%, #c4a882 50%, #dbc9a8 100%)",
    "moss-rock": "linear-gradient(135deg, #3a5a3a 0%, #6b8e6b 50%, #c8d8c8 100%)",
    "glass-display": "linear-gradient(135deg, #e8e8e8 0%, #f8f8f8 30%, #d0d0d0 100%)",
    "natural-surface": "linear-gradient(135deg, #b8a07a 0%, #d4c4a8 50%, #e8dcc8 100%)",
    "dark-dramatic": "linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #2a2a2a 100%)",
    "creative-floating": "linear-gradient(135deg, #f0e6ff 0%, #e6f0ff 50%, #f0f0ff 100%)",
    "high-end-model": "linear-gradient(135deg, #1a1a1a 0%, #333333 50%, #4a4a4a 100%)",
    "consistent-model": "linear-gradient(135deg, #2a2a3a 0%, #3a3a5a 50%, #4a4a6a 100%)",
    "clean-white-studio": "linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #ffffff 100%)",
    "ugc-model": "linear-gradient(135deg, #ffecd2 0%, #fcb69f 50%, #ff9a9e 100%)",
    // Clothing
    "flat-lay": "linear-gradient(135deg, #fafafa 0%, #f0f0f0 50%, #e5e5e5 100%)",
    "on-hanger": "linear-gradient(135deg, #f5f0eb 0%, #ede5db 50%, #f8f4ef 100%)",
    "ghost-mannequin": "linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)",
    "street-style": "linear-gradient(135deg, #4a5568 0%, #718096 50%, #a0aec0 100%)",
    "editorial-model": "linear-gradient(135deg, #1a1a2e 0%, #2d2d4e 50%, #16213e 100%)",
    "detail-texture": "linear-gradient(135deg, #3a3a3a 0%, #5a5a5a 50%, #3a3a3a 100%)",
    "lifestyle-casual": "linear-gradient(135deg, #ffeaa7 0%, #dfe6e9 50%, #fab1a0 100%)",
    "lookbook-studio": "linear-gradient(135deg, #f5f5f5 0%, #e8e8e8 50%, #f5f5f5 100%)",
    "seasonal-outdoor": "linear-gradient(135deg, #fbc531 0%, #e17055 50%, #d35400 100%)",
    "mix-match": "linear-gradient(135deg, #a29bfe 0%, #fd79a8 50%, #fdcb6e 100%)",
    // Furniture
    "white-studio": "linear-gradient(135deg, #ffffff 0%, #f8f8f8 50%, #f0f0f0 100%)",
    "room-modern": "linear-gradient(135deg, #e8e0d8 0%, #d4ccc4 50%, #f0e8e0 100%)",
    "room-cozy": "linear-gradient(135deg, #d4a373 0%, #e6c9a8 50%, #fae3c8 100%)",
    "detail-material": "linear-gradient(135deg, #5d4e37 0%, #7a6b52 50%, #5d4e37 100%)",
    "lifestyle-overhead": "linear-gradient(135deg, #ddd5c8 0%, #c8bfb2 50%, #e8e0d5 100%)",
    "scale-human": "linear-gradient(135deg, #e8e0d8 0%, #d4c8bc 50%, #c0b4a8 100%)",
    "catalog-angle": "linear-gradient(135deg, #e0e0e0 0%, #d0d0d0 50%, #c0c0c0 100%)",
    "seasonal-styled": "linear-gradient(135deg, #c0392b 0%, #e74c3c 30%, #2ecc71 70%, #27ae60 100%)",
    "outdoor-patio": "linear-gradient(135deg, #55a630 0%, #80b918 50%, #bfd200 100%)",
    "window-light": "linear-gradient(135deg, #fff3cd 0%, #ffeaa7 50%, #fdcb6e 100%)",
    "dark-moody": "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)",
    "minimalist-space": "linear-gradient(135deg, #f0ece8 0%, #e0dcd8 50%, #d0ccc8 100%)",
  };
  return gradients[id] || "linear-gradient(135deg, #e8e6e3 0%, #d4d1cd 50%, #c0bdb8 100%)";
}

// Extract mood keywords from description
function extractTags(description: string): string[] {
  const keywords = [
    "white", "neutral", "dark", "dramatic", "natural", "organic", "vintage",
    "editorial", "macro", "luxury", "studio", "lifestyle", "minimal",
    "artistic", "floating", "cozy", "modern", "outdoor", "urban", "moody",
    "clean", "warm", "golden", "texture", "fabric", "detail", "close-up",
    "flat lay", "overhead", "catalog", "seasonal", "UGC", "authentic",
    "street", "casual", "formal", "premium", "heritage", "elegant",
  ];
  const lower = description.toLowerCase();
  return keywords.filter((k) => lower.includes(k.toLowerCase())).slice(0, 4);
}

// Check if gradient is dark to determine text color
function isDarkGradient(id: string): boolean {
  const darkIds = [
    "elemental-artistic", "detail-closeup", "dark-dramatic", "high-end-model",
    "consistent-model", "editorial-model", "detail-texture", "detail-material",
    "dark-moody", "packaging-box",
  ];
  return darkIds.includes(id);
}

interface Props {
  template: Template;
  children: React.ReactNode;
}

export default function TemplatePreview({ template, children }: Props) {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState<"right" | "left">("right");
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleEnter = () => {
    timeoutRef.current = setTimeout(() => {
      // Decide which side to show the preview
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const spaceRight = window.innerWidth - rect.right;
        setPosition(spaceRight > 320 ? "right" : "left");
      }
      setShow(true);
    }, 300); // small delay to avoid flickering
  };

  const handleLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setShow(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const profileId = useProfileStore((s) => s.activeProfileId);
  const gradient = getGradient(template.id);
  const dark = isDarkGradient(template.id);
  const tags = extractTags(template.description);

  // Check for real preview image: /templates/{profileId}/{templateId}.jpg
  const previewSrc = profileId ? `/templates/${profileId}/${template.id}.jpg` : null;
  const [imgError, setImgError] = useState(false);
  const hasRealImage = previewSrc && !imgError;

  // Reset error when template changes
  useEffect(() => {
    setImgError(false);
  }, [template.id]);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      {show && (
        <div
          className={`absolute z-50 w-72 rounded-2xl overflow-hidden border border-border shadow-2xl transition-all animate-in fade-in zoom-in-95 duration-200 ${
            position === "right" ? "left-full ml-3 top-0" : "right-full mr-3 top-0"
          }`}
        >
          {/* Visual preview area */}
          {hasRealImage ? (
            <div className="relative h-48 overflow-hidden">
              <img
                src={previewSrc}
                alt={`${template.name} preview`}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
              {template.dynamic && (
                <span className="absolute top-2 right-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-black/50 text-white backdrop-blur-sm">
                  AI-Powered
                </span>
              )}
            </div>
          ) : (
            <div
              className="relative h-40 flex items-center justify-center overflow-hidden"
              style={{ background: gradient }}
            >
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-4 left-4 w-16 h-16 rounded-full bg-white/20 blur-xl" />
                <div className="absolute bottom-4 right-4 w-20 h-12 rounded-lg bg-black/10 blur-lg" />
              </div>

              <div className="relative flex flex-col items-center gap-2">
                <span className="text-5xl drop-shadow-lg">{template.icon}</span>
                {template.dynamic && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      dark ? "bg-white/20 text-white" : "bg-black/10 text-foreground/60"
                    }`}
                  >
                    AI-Powered
                  </span>
                )}
              </div>

              <div className="absolute top-2 right-3 w-2 h-2 rounded-full bg-white/30 animate-pulse" />
              <div className="absolute bottom-6 left-6 w-1.5 h-1.5 rounded-full bg-white/20 animate-pulse delay-500" />
            </div>
          )}

          {/* Info section */}
          <div className="bg-card p-4">
            <h4 className="font-semibold text-sm mb-1">{template.name}</h4>
            <p className="text-xs text-muted leading-relaxed mb-3">
              {template.description}
            </p>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-background border border-border text-muted font-medium"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Shot types hint for clothing */}
            {template.id !== "consistent-model" && !template.dynamic && (
              <p className="text-[10px] text-muted/60 mt-2 pt-2 border-t border-border">
                Click to select, then hit Generate
              </p>
            )}
            {template.dynamic && (
              <p className="text-[10px] text-accent mt-2 pt-2 border-t border-border font-medium">
                Uses AI analysis for custom prompts
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
