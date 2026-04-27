"use client";

import { useState, useMemo, useEffect } from "react";
import { useGenerationStore, type HistoryItem } from "@/lib/stores/generation-store";
import { Trash2, Download, Type, Clock, Search, ImageIcon, Film, X, ExternalLink } from "lucide-react";
import OverlayEditor from "./OverlayEditor";

type SourceFilter = "all" | "studio" | "ugc" | "social";
type TypeFilter = "all" | "image" | "video";

export default function ContentHistoryPanel() {
  const history = useGenerationStore((s) => s.history);
  const removeHistoryItem = useGenerationStore((s) => s.removeHistoryItem);

  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [maximizedItem, setMaximizedItem] = useState<HistoryItem | null>(null);

  // Close maximized view on Escape
  useEffect(() => {
    if (!maximizedItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMaximizedItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maximizedItem]);

  const filtered = useMemo(() => {
    return history
      .filter((i) => i.mode !== "audio")
      .filter((i) => (typeFilter === "all" ? true : i.mode === typeFilter))
      .filter((i) => {
        if (sourceFilter === "all") return true;
        const src = i.source || "studio";
        return src === sourceFilter;
      })
      .filter((i) =>
        search ? (i.prompt || "").toLowerCase().includes(search.toLowerCase()) : true
      );
  }, [history, sourceFilter, typeFilter, search]);

  const handleDelete = (id: string) => {
    console.log("[ContentHistory] delete clicked, id:", id, "current deletingId:", deletingId);
    if (deletingId === id) {
      console.log("[ContentHistory] confirming delete for", id);
      removeHistoryItem(id);
      setDeletingId(null);
    } else {
      setDeletingId(id);
      // 5 seconds — give users a bit more time to find the button again
      setTimeout(() => setDeletingId((p) => (p === id ? null : p)), 5000);
    }
  };

  const handleDownload = async (item: HistoryItem) => {
    console.log("[ContentHistory] download clicked:", item.resultUrl);
    try {
      // Route cross-origin CDN URLs through our proxy so COEP credentialless
      // and CORS don't silently block the fetch. Same-origin URLs pass through.
      const isSameOrigin =
        item.resultUrl.startsWith("/") ||
        (typeof window !== "undefined" && item.resultUrl.startsWith(window.location.origin));
      const fetchUrl = isSameOrigin
        ? item.resultUrl
        : `/api/proxy-media?url=${encodeURIComponent(item.resultUrl)}`;

      const res = await fetch(fetchUrl);
      if (!res.ok) {
        throw new Error(`Fetch failed: HTTP ${res.status} ${res.statusText}`);
      }
      const blob = await res.blob();
      console.log(`[ContentHistory] got blob size=${(blob.size / 1024).toFixed(0)}KB type=${blob.type}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${item.mode}-${item.id.slice(0, 8)}.${item.mode === "video" ? "mp4" : "png"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke slightly — some browsers cancel the download if we revoke synchronously
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error("[ContentHistory] download failed:", msg);
      alert(`Download failed: ${msg}`);
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Content History
          </h2>
          <span className="ml-auto text-[11px] text-muted">{filtered.length} items</span>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Source filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/5 border border-border">
            {(["all", "studio", "ugc", "social"] as SourceFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setSourceFilter(s)}
                className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded transition-colors ${
                  sourceFilter === s
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex gap-1 p-1 rounded-lg bg-muted/5 border border-border">
            {(
              [
                { v: "all", label: "All", icon: null },
                { v: "image", label: "", icon: <ImageIcon className="w-3 h-3" /> },
                { v: "video", label: "", icon: <Film className="w-3 h-3" /> },
              ] as const
            ).map((t) => (
              <button
                key={t.v}
                onClick={() => setTypeFilter(t.v as TypeFilter)}
                className={`px-2.5 py-1 text-[11px] uppercase tracking-wider font-semibold rounded transition-colors flex items-center gap-1 ${
                  typeFilter === t.v
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[160px] relative">
            <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search prompts…"
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/5 border border-border rounded-lg focus:outline-none focus:border-accent/50"
            />
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Clock className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm">No content yet</p>
            <p className="text-xs mt-1">Generate images or videos in Studio or UGC</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setMaximizedItem(item)}
                className="group relative rounded-xl overflow-hidden border border-border hover:border-accent/40 transition-colors cursor-pointer"
              >
                {/* Media — draggable={false} disables the browser's native
                    HTML5 drag-image behaviour, which otherwise intercepts
                    mouse-down events and prevents the floating action buttons
                    (delete / download) from registering clicks. */}
                {item.mode === "video" ? (
                  <video
                    src={item.resultUrl}
                    draggable={false}
                    className="w-full aspect-square object-cover"
                    muted
                    playsInline
                    preload="metadata"
                    onMouseEnter={(e) => (e.target as HTMLVideoElement).play().catch(() => {})}
                    onMouseLeave={(e) => {
                      const v = e.target as HTMLVideoElement;
                      v.pause();
                      v.currentTime = 0;
                    }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.resultUrl}
                    alt=""
                    draggable={false}
                    onDragStart={(e) => e.preventDefault()}
                    className="w-full aspect-square object-cover select-none"
                    loading="lazy"
                  />
                )}

                {/* Hover actions — stop propagation + preventDefault so clicks
                    never reach the card's maximize handler. Explicit pointer-
                    events-auto guarantees click delivery even when the parent
                    is transitioning opacity. */}
                <div
                  className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-10"
                  onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  {item.mode === "image" && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); e.preventDefault(); setEditingItem(item); }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="p-1.5 rounded-md bg-black/50 text-white backdrop-blur-sm hover:bg-accent/80 transition-colors"
                      title="Add text overlay"
                    >
                      <Type className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDownload(item); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1.5 rounded-md bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDelete(item.id); }}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`p-1.5 rounded-md backdrop-blur-sm transition-colors ${
                      deletingId === item.id
                        ? "bg-red-500/90 text-white ring-2 ring-red-500"
                        : "bg-black/50 text-white hover:bg-red-500/80"
                    }`}
                    title={deletingId === item.id ? "Click again to confirm" : "Delete"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Footer */}
                <div className="p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">
                      {item.mode}
                    </span>
                    {item.source && item.source !== "studio" && (
                      <span
                        className={`text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                          item.source === "ugc"
                            ? "bg-accent/15 text-accent"
                            : "bg-blue-500/15 text-blue-400"
                        }`}
                      >
                        {item.source}
                      </span>
                    )}
                  </div>
                  {item.prompt && (
                    <p className="text-[11px] text-muted truncate mt-0.5" title={item.prompt}>
                      {item.prompt}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overlay Editor modal */}
      {editingItem && (
        <OverlayEditor
          item={editingItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {/* Maximized content viewer — lightbox */}
      {maximizedItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center p-4 animate-in fade-in"
          onClick={() => setMaximizedItem(null)}
        >
          {/* Close + actions bar (top-right) */}
          <div
            className="absolute top-4 right-4 flex gap-2 z-10"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={maximizedItem.resultUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
              title="Open in new tab"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            {maximizedItem.mode === "image" && (
              <button
                onClick={() => {
                  setEditingItem(maximizedItem);
                  setMaximizedItem(null);
                }}
                className="p-2 rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-accent/80 transition-colors"
                title="Add text overlay"
              >
                <Type className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleDownload(maximizedItem)}
              className="p-2 rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
              title="Download"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={() => setMaximizedItem(null)}
              className="p-2 rounded-lg bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Media — centered and clickable area stops propagation so clicks
              on the image itself don't close the lightbox */}
          <div
            className="max-w-full max-h-full flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {maximizedItem.mode === "video" ? (
              <video
                src={maximizedItem.resultUrl}
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl"
                controls
                autoPlay
                loop
                playsInline
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={maximizedItem.resultUrl}
                alt=""
                className="max-w-full max-h-[85vh] rounded-lg shadow-2xl object-contain"
              />
            )}
          </div>

          {/* Caption (bottom) */}
          <div
            className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-2xl px-4 py-2 rounded-lg bg-black/50 backdrop-blur-sm text-white text-xs"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="uppercase font-semibold tracking-wider text-[10px] text-white/60">
                {maximizedItem.mode}
              </span>
              {maximizedItem.source && maximizedItem.source !== "studio" && (
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-white/15">
                  {maximizedItem.source}
                </span>
              )}
              <span className="text-white/50">
                {new Date(maximizedItem.timestamp).toLocaleString([], {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {maximizedItem.prompt && (
              <p className="mt-1 text-white/80 line-clamp-2">{maximizedItem.prompt}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
