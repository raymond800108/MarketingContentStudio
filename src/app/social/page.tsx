"use client";

import { useProfileStore } from "@/lib/stores/profile-store";
import { useGenerationStore, type HistoryItem } from "@/lib/stores/generation-store";
import { useBlotatoStore } from "@/lib/stores/blotato-store";
import { useCalendarStore, type CalendarPost } from "@/lib/stores/calendar-store";
import { getProfile } from "@/lib/profiles";
import type { SocialPreset } from "@/lib/profiles/types";
import {
  Share2,
  Globe,
  ExternalLink,
  Link2,
  Unlink,
  CheckCircle2,
  Loader2,
  Send,
  Clock,
  Video,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  GripVertical,
  Edit3,
  Sparkles,
  Timer,
  Radio,
  Eye,
  Play,
  ZoomIn,
  Search,
} from "lucide-react";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useT, useI18nStore } from "@/lib/i18n";
import { trackApiCall } from "@/lib/stores/api-usage-store";
import { useAuth } from "@/lib/useAuth";

// ── Constants ──

const PLATFORM_ICONS: Record<string, string> = {
  twitter: "\ud835\udd4f", instagram: "\ud83d\udcf8", linkedin: "\ud83d\udcbc",
  facebook: "\ud83d\udcd8", tiktok: "\ud83c\udfb5", pinterest: "\ud83d\udccc",
  threads: "\ud83e\uddf5", bluesky: "\ud83e\udd8b", youtube: "\u25b6\ufe0f",
};
const PLATFORM_LABELS: Record<string, string> = {
  twitter: "X (Twitter)", instagram: "Instagram", linkedin: "LinkedIn",
  facebook: "Facebook", tiktok: "TikTok", pinterest: "Pinterest",
  threads: "Threads", bluesky: "Bluesky", youtube: "YouTube",
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const DAY_LABELS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ── Named account bundles ──
// Maps a human-friendly brand name to a Blotato accountId. The user switches
// the active bundle via the buttons in the header; the selected accountId is
// then used as the default for all new posts.
const ACCOUNT_BUNDLES: Array<{ id: string; label: string }> = [
  { id: "40541", label: "Socialfashionizing" },
  { id: "41782", label: "innery.lab" },
  { id: "41768", label: "necksy_de" },
];

const MIN_YEAR = 2026;
const MAX_YEAR = 2030;

const COMMON_TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Anchorage", label: "Alaska (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii (HT)" },
  { value: "UTC", label: "UTC" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Shanghai", label: "China (CST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Hong_Kong", label: "Hong Kong (HKT)" },
];

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

// ── Helpers ──

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function getMonthGrid(year: number, month: number): (number | null)[][] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7;
  const weeks: (number | null)[][] = [];
  let week: (number | null)[] = new Array(startOffset).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

function todayStr(): string {
  const t = new Date();
  return formatDate(t.getFullYear(), t.getMonth(), t.getDate());
}

function formatTime12(time24: string | undefined): string {
  if (!time24) return "12:00 PM";
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

// ── Drag payload types ──

interface DragContentPayload {
  type: "content";
  historyItem: HistoryItem;
  presetId: string | null;
  presetLabel: string | null;
  platform: string | null;
}
interface DragMovePayload {
  type: "move";
  postId: string;
}
type DragPayload = DragContentPayload | DragMovePayload;

// ── Component ──

export default function SocialPage() {
  const t = useT();
  const locale = useI18nStore((s) => s.locale);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const boundAccountId = user?.blotatoAccountId ?? null;
  const boundAccountLabel = user?.blotatoAccountLabel ?? null;
  const profileId = useProfileStore((s) => s.activeProfileId);
  const profile = profileId ? getProfile(profileId) : null;
  const history = useGenerationStore((s) => s.history);

  const {
    apiKey, connected, accounts, defaultAccountId,
    setApiKey, setConnected, setAccounts, setDefaultAccountId, disconnect,
  } = useBlotatoStore();

  // If the logged-in user is bound to a specific Blotato accountId (e.g.
  // innery.lab), lock the default to that account so every post they publish
  // goes to it — regardless of what the store had cached from a previous session.
  useEffect(() => {
    if (boundAccountId && defaultAccountId !== boundAccountId) {
      setDefaultAccountId(boundAccountId);
    }
  }, [boundAccountId, defaultAccountId, setDefaultAccountId]);
  const {
    posts: calendarPosts, addPost, updatePost, removePost, movePost,
  } = useCalendarStore();

  // ── Connection state ──
  const [keyInput, setKeyInput] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  // ── Calendar navigation ──
  const today = todayStr();
  const [calYear, setCalYear] = useState(2026);
  const [calMonth, setCalMonth] = useState(3);

  // ── Content tray ──
  const [selectedPreset, setSelectedPreset] = useState<SocialPreset | null>(null);

  // ── Default timezone (detect once) ──
  const [defaultTimezone] = useState(() => getLocalTimezone());

  // ── Edit modal ──
  const [editingPost, setEditingPost] = useState<CalendarPost | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editTime, setEditTime] = useState("12:00");
  const [editTimezone, setEditTimezone] = useState(defaultTimezone);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  // ── Publishing ──
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  // ── Blotato diagnostic panel ──
  // Paste a postSubmissionId and get Blotato's raw response for it, so you
  // can see exactly why a post is stuck in QUEUED on their side.
  const [diagnoseId, setDiagnoseId] = useState("");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnoseResult, setDiagnoseResult] = useState<{
    ok: boolean;
    httpStatus: number;
    body: unknown;
  } | null>(null);

  // ── Preview lightbox ──
  const [previewItem, setPreviewItem] = useState<HistoryItem | null>(null);

  // ── Drag state ──
  const dragPayloadRef = useRef<DragPayload | null>(null);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);

  // ── Live clock (client-only to avoid hydration mismatch) ──
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const tick = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(tick);
  }, []);

  const pendingScheduled = useMemo(
    () => calendarPosts.filter((p) => p.status === "draft").length,
    [calendarPosts]
  );

  const blotatoHeaders = useCallback(() => {
    return { "x-blotato-key": apiKey, "Content-Type": "application/json" };
  }, [apiKey]);

  // Fetch accounts on mount
  useEffect(() => {
    if (connected && apiKey) {
      trackApiCall("blotato", "blotato_accounts", "/api/blotato/accounts", async () => {
        const r = await fetch("/api/blotato/accounts", { headers: { "x-blotato-key": apiKey, "Content-Type": "application/json" } });
        const d = await r.json();
        if (Array.isArray(d)) setAccounts(d);
        return d;
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  // ── Connection handlers ──
  const handleConnect = async () => {
    if (!keyInput.trim()) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const { res, data } = await trackApiCall("blotato", "blotato_accounts", "/api/blotato/accounts", async () => {
        const r = await fetch("/api/blotato/accounts", {
          headers: { "x-blotato-key": keyInput.trim(), "Content-Type": "application/json" },
        });
        const d = await r.json();
        return { res: r, data: d };
      });
      if (!res.ok) { setConnectError(data.error || "Failed to connect"); setConnecting(false); return; }
      setApiKey(keyInput.trim());
      setConnected(true);
      if (Array.isArray(data)) setAccounts(data);
      setKeyInput("");
    } catch { setConnectError("Network error"); }
    setConnecting(false);
  };

  // ── Calendar navigation ──
  const prevMonth = () => {
    if (calMonth === 0) {
      if (calYear > MIN_YEAR) { setCalYear(calYear - 1); setCalMonth(11); }
    } else setCalMonth(calMonth - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) {
      if (calYear < MAX_YEAR) { setCalYear(calYear + 1); setCalMonth(0); }
    } else setCalMonth(calMonth + 1);
  };
  const canPrev = calYear > MIN_YEAR || calMonth > 0;
  const canNext = calYear < MAX_YEAR || calMonth < 11;

  const weeks = useMemo(() => getMonthGrid(calYear, calMonth), [calYear, calMonth]);
  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MIN_YEAR + i);

  const postsByDate = useMemo(() => {
    const map: Record<string, CalendarPost[]> = {};
    for (const p of calendarPosts) { (map[p.date] ??= []).push(p); }
    // Sort each day by time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.time.localeCompare(b.time));
    }
    return map;
  }, [calendarPosts]);

  // ── Drag from content tray ──
  const handleContentDragStart = (e: React.DragEvent, item: HistoryItem) => {
    dragPayloadRef.current = {
      type: "content",
      historyItem: item,
      presetId: selectedPreset?.id || null,
      presetLabel: selectedPreset ? `${selectedPreset.platform} ${selectedPreset.label}` : null,
      platform: selectedPreset?.platform.toLowerCase() || null,
    };
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", "content");
  };

  const handlePostDragStart = (e: React.DragEvent, postId: string) => {
    dragPayloadRef.current = { type: "move", postId };
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", "move");
  };

  // ── Drop on calendar date — auto-generate caption ──
  const handleDrop = async (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    setDragOverDate(null);
    const payload = dragPayloadRef.current;
    if (!payload) return;

    if (payload.type === "content") {
      const { historyItem, presetId, presetLabel, platform } = payload;
      const postId = crypto.randomUUID();
      addPost({
        id: postId,
        date: dateStr,
        time: "12:00",
        timezone: defaultTimezone,
        mediaUrl: historyItem.resultUrl,
        mediaType: historyItem.mode === "audio" ? "video" : historyItem.mode,
        sourceImageUrl: historyItem.sourceUrl || undefined,
        prompt: historyItem.prompt || undefined,
        caption: "",
        presetId,
        presetLabel,
        platform,
        accountId: defaultAccountId || null,
        status: "draft",
        blotatoPostId: null,
      });
      // Fire-and-forget caption generation
      // For images: use the result image directly
      // For videos: use the source image (original product photo) if available
      const captionImageUrl = historyItem.mode === "video"
        ? historyItem.sourceUrl || null
        : historyItem.resultUrl;
      if (captionImageUrl) {
        generateCaptionFor(postId, captionImageUrl, platform, historyItem.prompt);
      }
    } else if (payload.type === "move") {
      movePost(payload.postId, dateStr);
    }
    dragPayloadRef.current = null;
  };

  const handleDragOver = (e: React.DragEvent, dateStr: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragPayloadRef.current?.type === "move" ? "move" : "copy";
    setDragOverDate(dateStr);
  };

  // ── AI caption generation ──
  const generateCaptionFor = async (postId: string, imageUrl: string, platform: string | null, promptContext?: string) => {
    try {
      await trackApiCall("openai", "caption_generation", "/api/analyze/caption", async () => {
        const res = await fetch("/api/analyze/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_url: imageUrl, platform, locale, prompt_context: promptContext }),
        });
        const data = await res.json();
        if (res.ok && data.caption) {
          updatePost(postId, { caption: data.caption });
        }
        return data;
      });
    } catch {
      // Silently fail — user can write caption manually
    }
  };

  const handleGenerateCaptionInModal = async () => {
    if (!editingPost) return;
    setGeneratingCaption(true);
    try {
      const isVideo = editingPost.mediaType === "video";
      // For images: always use the media URL
      // For videos: use source image if available, otherwise null (API handles text-only)
      const imageUrl = isVideo
        ? (editingPost.sourceImageUrl || null)
        : editingPost.mediaUrl;

      // Build a prompt context for video posts — use stored prompt, or construct from available info
      let promptContext = editingPost.prompt;
      if (isVideo && !promptContext) {
        const parts: string[] = ["A fashion/product video"];
        if (editingPost.presetLabel) parts.push(`for ${editingPost.presetLabel}`);
        if (editingPost.platform) parts.push(`on ${editingPost.platform}`);
        promptContext = parts.join(" ");
      }

      const data = await trackApiCall("openai", "caption_generation", "/api/analyze/caption", async () => {
        const res = await fetch("/api/analyze/caption", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image_url: imageUrl,
            platform: editingPost.platform,
            locale,
            prompt_context: promptContext,
            media_type: editingPost.mediaType,
          }),
        });
        return res.json();
      });
      if (data.caption) {
        setEditCaption(data.caption);
      }
    } catch {
      // Silently fail
    }
    setGeneratingCaption(false);
  };

  // ── Edit post ──
  const openEdit = (post: CalendarPost) => {
    setEditingPost(post);
    setEditCaption(post.caption);
    setEditTime(post.time || "12:00");
    setEditTimezone(post.timezone || defaultTimezone);
    setPublishError(null);
  };
  const saveEdit = () => {
    if (!editingPost) return;
    updatePost(editingPost.id, {
      caption: editCaption,
      time: editTime,
      timezone: editTimezone,
    });
    setEditingPost(null);
  };

  // ── Publish a calendar post via Blotato ──
  const handlePublishPost = async (post: CalendarPost) => {
    const effectiveAccountId = post.accountId || defaultAccountId;
    if (!effectiveAccountId) return;
    setPublishingId(post.id);
    setPublishError(null);
    // Mark as "scheduled" BEFORE the async work starts so the auto-scheduler
    // won't also pick up this post and double-publish it.
    updatePost(post.id, { status: "scheduled" });
    try {
      const uploadData = await trackApiCall("blotato", "blotato_media", "/api/blotato/media", async () => {
        const uploadRes = await fetch("/api/blotato/media", {
          method: "POST",
          headers: blotatoHeaders(),
          body: JSON.stringify({ url: post.mediaUrl }),
        });
        return uploadRes.json();
      });
      const mediaUrl = uploadData.url ? uploadData.url : post.mediaUrl;

      // Let the server build the proper Blotato target (mediaType, required
      // booleans, etc.) from platform + presetId — per Blotato's publish-post spec.
      const body: Record<string, unknown> = {
        accountId: effectiveAccountId,
        text: post.caption || ".",
        mediaUrls: [mediaUrl],
        platform: post.platform || "twitter",
        presetId: post.presetId || null,
      };

      // "Publish via Blotato" uses Blotato's IMMEDIATE-publish flow: no
      // `scheduledTime` field is sent at all. Blotato's docs show this as
      // the "Post to a Platform Immediately" example. Only posts that are
      // saved as drafts and later fire via the local auto-scheduler use
      // the separate "Post at a Scheduled Time" flow (handled server-side
      // in /api/social/auto-publish).

      const data = await trackApiCall("blotato", "blotato_publish", "/api/blotato/publish", async () => {
        const res = await fetch("/api/blotato/publish", {
          method: "POST",
          headers: blotatoHeaders(),
          body: JSON.stringify(body),
        });
        const d = await res.json();
        if (!res.ok) throw new Error(d.error || "Publish failed");
        return d;
      });
      {
        // Blotato returns 201 when the post is queued in their worker pipeline,
        // NOT when it's actually published to the target platform. We keep the
        // local status as "scheduled" and let the background poller in
        // useAutoScheduler flip it to "published" once Blotato confirms.
        updatePost(post.id, {
          status: "scheduled",
          blotatoPostId: data.postSubmissionId || null,
          time: editTime || post.time,
          timezone: editTimezone || post.timezone,
        });
        setEditingPost((prev) =>
          prev?.id === post.id
            ? { ...prev, status: "scheduled", blotatoPostId: data.postSubmissionId || null }
            : prev
        );
      }
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "Error");
    }
    setPublishingId(null);
  };

  // ── Diagnostic: fetch Blotato's raw status for a submission ID ──
  const handleDiagnose = async () => {
    const id = diagnoseId.trim();
    if (!id) return;
    setDiagnoseLoading(true);
    setDiagnoseResult(null);
    try {
      const res = await fetch(`/api/blotato/publish?id=${encodeURIComponent(id)}`, {
        headers: blotatoHeaders(),
      });
      const body = await res.json();
      setDiagnoseResult({ ok: res.ok, httpStatus: res.status, body });
    } catch (err) {
      setDiagnoseResult({
        ok: false,
        httpStatus: 0,
        body: { error: err instanceof Error ? err.message : "Unknown error" },
      });
    } finally {
      setDiagnoseLoading(false);
    }
  };

  // Check if timezone is in the common list
  const timezoneInList = COMMON_TIMEZONES.some((tz) => tz.value === editTimezone);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Share2 className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-bold">{t("social.title")}</h1>
          {/* Live clock + scheduler status */}
          {now && (
            <div className="flex items-center gap-2 ml-3 px-3 py-1.5 rounded-xl bg-card border border-border">
              <Timer className="w-3.5 h-3.5 text-accent" />
              <span className="text-xs font-mono font-medium tabular-nums">
                {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </span>
              <span className="text-[10px] text-muted">{now.toLocaleDateString([], { month: "short", day: "numeric" })}</span>
              {pendingScheduled > 0 && (
                <span className="flex items-center gap-1 ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  {pendingScheduled} {t("social.pending")}
                </span>
              )}
            </div>
          )}

        </div>

        {connected ? (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t("social.blotatoConnected")}
            </span>
            <button onClick={() => disconnect()}
              className="flex items-center gap-1 px-2 py-1 text-[11px] text-muted hover:text-danger rounded hover:bg-danger/10 transition-colors">
              <Unlink className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="password" value={keyInput} onChange={(e) => setKeyInput(e.target.value)}
              placeholder={t("social.apiKeyPlaceholder")}
              className="w-48 px-3 py-1.5 rounded-lg border border-border bg-background text-xs focus:outline-none focus:border-accent/30"
              onKeyDown={(e) => e.key === "Enter" && handleConnect()} />
            <button onClick={handleConnect} disabled={connecting || !keyInput.trim()}
              className="px-3 py-1.5 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-40">
              {connecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
            </button>
            {connectError && <span className="text-[11px] text-danger">{connectError}</span>}
            <a href="https://my.blotato.com/settings/api" target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-accent hover:underline flex items-center gap-1">
              <ExternalLink className="w-3 h-3" /> {t("social.getKey")}
            </a>
          </div>
        )}
      </div>

      {/* ── Blotato Diagnostic Panel ── */}
      {connected && (
        <div className="mb-4 rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Search className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Diagnose Blotato Post
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={diagnoseId}
              onChange={(e) => setDiagnoseId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleDiagnose()}
              placeholder="Paste postSubmissionId (e.g. 7fe22b3c-dfd0-4235-930f-c563e1460b90)"
              className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-xs font-mono focus:outline-none focus:border-accent/30"
            />
            <button
              onClick={handleDiagnose}
              disabled={diagnoseLoading || !diagnoseId.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-accent text-white rounded-lg text-xs font-medium hover:bg-accent-light transition-colors disabled:opacity-40"
            >
              {diagnoseLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Search className="w-3.5 h-3.5" />
              )}
              Check Status
            </button>
          </div>

          {diagnoseResult && (
            <div className="mt-3 space-y-2">
              {/* Headline */}
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`px-2 py-0.5 rounded-full font-bold ${
                    diagnoseResult.ok
                      ? "bg-green-100 text-green-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  HTTP {diagnoseResult.httpStatus || "ERR"}
                </span>
                {(() => {
                  const body = diagnoseResult.body as Record<string, unknown> | null;
                  if (!body) return null;
                  const status =
                    (body.status as string) ||
                    ((body.post as Record<string, unknown>)?.status as string) ||
                    ((body.data as Record<string, unknown>)?.status as string) ||
                    "unknown";
                  const errMsg =
                    (body.error as string) ||
                    (body.message as string) ||
                    ((body.post as Record<string, unknown>)?.error as string) ||
                    null;
                  return (
                    <>
                      <span className="px-2 py-0.5 rounded-full bg-muted/20 text-muted font-medium uppercase">
                        status: {status}
                      </span>
                      {errMsg && (
                        <span className="text-red-600 font-medium">
                          ⚠ {errMsg}
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Full raw JSON */}
              <pre className="max-h-80 overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] font-mono leading-relaxed">
                {JSON.stringify(diagnoseResult.body, null, 2)}
              </pre>

              {/* Helpful guidance based on common states */}
              {(() => {
                const body = diagnoseResult.body as Record<string, unknown> | null;
                if (!body) return null;
                const status = (
                  (body.status as string) ||
                  ((body.post as Record<string, unknown>)?.status as string) ||
                  ""
                ).toLowerCase();
                const scheduledTimeRaw =
                  (body.scheduledTime as string) ||
                  ((body.post as Record<string, unknown>)?.scheduledTime as string) ||
                  null;

                // Critical red flag: scheduledTime has already passed but
                // Blotato still reports the post as scheduled/queued. This
                // means their worker isn't processing it — almost always a
                // Blotato-side Instagram account auth issue.
                if (scheduledTimeRaw && (status === "scheduled" || status === "queued")) {
                  const scheduledMs = new Date(scheduledTimeRaw).getTime();
                  const deltaMs = Date.now() - scheduledMs;
                  if (deltaMs > 60_000) {
                    const mins = Math.round(deltaMs / 60_000);
                    return (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 space-y-1">
                        <p className="text-[12px] font-bold text-red-700">
                          ⚠ Stuck: {mins} min past scheduledTime but still &quot;{status}&quot;
                        </p>
                        <p className="text-[11px] text-red-600">
                          Blotato&apos;s worker didn&apos;t process this post at its
                          scheduled time. This is a Blotato-side issue — most
                          commonly caused by:
                        </p>
                        <ul className="list-disc pl-4 text-[11px] text-red-600 space-y-0.5">
                          <li>
                            Instagram account isn&apos;t a Business/Creator account
                            (personal accounts can&apos;t publish via the Graph API)
                          </li>
                          <li>
                            Facebook Page token expired — go to Blotato dashboard →
                            Accounts → Instagram → <b>Reconnect</b>
                          </li>
                          <li>
                            Instagram Business account isn&apos;t linked to a Facebook
                            Page with <code>instagram_content_publish</code> scope
                          </li>
                          <li>
                            Blotato&apos;s worker pool is down/backlogged for your tenant
                          </li>
                        </ul>
                        <p className="text-[11px] text-red-600 pt-1">
                          Action: reconnect the Instagram account in Blotato, then
                          contact Blotato support with this submission ID if the
                          problem persists.
                        </p>
                      </div>
                    );
                  }
                  return (
                    <p className="text-[11px] text-muted italic">
                      Waiting: post is scheduled for{" "}
                      {new Date(scheduledTimeRaw).toLocaleString()}. Check back
                      after that time has passed.
                    </p>
                  );
                }

                if (status === "queued") {
                  return (
                    <p className="text-[11px] text-muted italic">
                      Still queued. Blotato&apos;s worker hasn&apos;t picked it up yet.
                    </p>
                  );
                }
                if (status.includes("fail") || status.includes("error")) {
                  return (
                    <p className="text-[11px] text-red-600 italic">
                      Blotato&apos;s worker tried to publish but failed. See the error
                      message above — common causes: invalid caption, media aspect ratio
                      not allowed by Instagram, expired Page token, or account not
                      linked to a Facebook Page with publish permission.
                    </p>
                  );
                }
                return null;
              })()}
            </div>
          )}
        </div>
      )}

      {/* Main layout: sidebar + calendar */}
      <div className="flex gap-4" style={{ minHeight: "calc(100vh - 180px)" }}>
        {/* ── Left sidebar ── */}
        <div className="w-72 shrink-0 space-y-4">
          {/* Content History */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5" /> {t("social.contentHistory")}
            </h2>
            {history.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">{t("social.emptyContent")}</p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 max-h-[320px] overflow-y-auto pr-1">
                {history.filter((item) => item.mode !== "audio").map((item) => (
                  <div key={item.id} draggable onDragStart={(e) => handleContentDragStart(e, item)}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border hover:border-accent/50 cursor-grab active:cursor-grabbing transition-all group"
                    title="Click to preview · Drag onto calendar to schedule">
                    {item.mode === "video" ? (
                      <div className="w-full h-full bg-card/80 flex items-center justify-center">
                        <Video className="w-4 h-4 text-muted" />
                      </div>
                    ) : (
                      <img src={item.resultUrl} alt="" className="w-full h-full object-cover" />
                    )}
                    {/* Hover overlay with preview + drag icons */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setPreviewItem(item); }}
                        className="p-1 rounded-full bg-white/90 hover:bg-white shadow transition-transform hover:scale-110"
                        title="Preview"
                      >
                        {item.mode === "video" ? <Play className="w-3 h-3 text-black" /> : <ZoomIn className="w-3 h-3 text-black" />}
                      </button>
                      <span className="p-1 rounded-full bg-white/60">
                        <GripVertical className="w-3 h-3 text-black/60" />
                      </span>
                    </div>
                    {item.mode === "video" && (
                      <span className="absolute bottom-0.5 right-0.5 text-[8px] bg-black/50 text-white px-1 rounded">VID</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted mt-2 text-center">{t("social.dragHint")}</p>
          </div>

          {/* Export Presets */}
          {profile && (
            <div className="rounded-2xl border border-border bg-card p-4">
              {/* ── Account bundle switcher (top-left) ──
                  • Admin: dropdown to pick any bundled accountId
                  • Non-admin with a bound account: read-only badge
                  • Non-admin without a bound account: nothing shown */}
              {isAdmin ? (
                <div className="relative mb-3 w-full">
                  <select
                    value={defaultAccountId}
                    onChange={(e) => setDefaultAccountId(e.target.value)}
                    title={`Account ID: ${defaultAccountId}`}
                    className="appearance-none w-full pl-3 pr-8 py-2 text-xs font-medium rounded-xl border border-border bg-background text-foreground focus:outline-none focus:border-accent/30 cursor-pointer"
                  >
                    {ACCOUNT_BUNDLES.map((bundle) => (
                      <option key={bundle.id} value={bundle.id}>
                        {bundle.label}
                      </option>
                    ))}
                  </select>
                  <ChevronRight className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none rotate-90" />
                </div>
              ) : boundAccountLabel ? (
                <div
                  title={`Account ID: ${boundAccountId}`}
                  className="flex items-center gap-1.5 mb-3 w-full px-3 py-2 text-xs font-medium rounded-xl border border-border bg-background text-foreground"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {boundAccountLabel}
                </div>
              ) : null}

              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <Globe className="w-3.5 h-3.5" /> {t("social.exportPreset")}
              </h2>
              <p className="text-[10px] text-muted mb-2">{t("social.presetHint")}</p>
              <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
                {profile.socialPresets.map((preset) => (
                  <button key={preset.id}
                    onClick={() => setSelectedPreset(selectedPreset?.id === preset.id ? null : preset)}
                    className={`w-full flex items-center gap-2 p-2 rounded-lg border text-left text-xs transition-all ${
                      selectedPreset?.id === preset.id ? "border-accent bg-accent/5" : "border-border hover:border-border-hover"
                    }`}>
                    <span className="text-sm">{PLATFORM_ICONS[preset.platform.toLowerCase()] || "\ud83c\udf10"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{preset.platform} {preset.label}</p>
                      <p className="text-[10px] text-muted">{preset.width}x{preset.height} &middot; {preset.aspectRatio}</p>
                    </div>
                    {selectedPreset?.id === preset.id && <CheckCircle2 className="w-3.5 h-3.5 text-accent shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Connected accounts */}
          {connected && accounts.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                <Link2 className="w-3.5 h-3.5" /> {t("social.accounts")}
              </h2>
              <div className="space-y-1">
                {accounts.map((acc) => (
                  <div key={acc.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs">
                    <span>{PLATFORM_ICONS[acc.platform] || "\ud83c\udf10"}</span>
                    <span className="truncate font-medium">{acc.fullname || acc.username}</span>
                    <span className="text-[10px] text-muted ml-auto">@{acc.username}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Calendar ── */}
        <div className="flex-1 rounded-2xl border border-border bg-card overflow-hidden flex flex-col">
          {/* Calendar header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2">
              <button onClick={prevMonth} disabled={!canPrev} className="p-1 rounded hover:bg-muted/10 disabled:opacity-30 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <select value={calMonth} onChange={(e) => setCalMonth(Number(e.target.value))}
                className="text-lg font-bold bg-transparent focus:outline-none cursor-pointer appearance-none">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={calYear} onChange={(e) => setCalYear(Number(e.target.value))}
                className="text-lg font-bold bg-transparent focus:outline-none cursor-pointer appearance-none">
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
              <button onClick={nextMonth} disabled={!canNext} className="p-1 rounded hover:bg-muted/10 disabled:opacity-30 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <button onClick={() => { setCalYear(new Date().getFullYear()); setCalMonth(new Date().getMonth()); }}
              className="text-xs text-accent hover:underline">{t("social.today")}</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_LABELS.map((d) => (
              <div key={d} className="text-center text-[11px] font-semibold text-muted py-2 uppercase tracking-wider">{d}</div>
            ))}
          </div>

          {/* Weeks grid */}
          <div className="flex-1 grid grid-rows-[repeat(auto-fill,1fr)]">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0" style={{ minHeight: 100 }}>
                {week.map((day, di) => {
                  if (day === null) return <div key={di} className="border-r border-border last:border-r-0 bg-card/30" />;
                  const dateStr = formatDate(calYear, calMonth, day);
                  const dayPosts = postsByDate[dateStr] || [];
                  const isToday = dateStr === today;
                  const isOver = dragOverDate === dateStr;

                  return (
                    <div key={di}
                      onDragOver={(e) => handleDragOver(e, dateStr)}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={(e) => handleDrop(e, dateStr)}
                      className={`border-r border-border last:border-r-0 p-1 flex flex-col transition-colors ${isOver ? "bg-accent/10" : ""}`}>
                      <span className={`text-[11px] font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "bg-accent text-white" : "text-muted"
                      }`}>{day}</span>

                      <div className="flex-1 space-y-0.5 overflow-y-auto">
                        {dayPosts.map((post) => (
                          <div key={post.id} draggable onDragStart={(e) => handlePostDragStart(e, post.id)}
                            className="group relative flex items-center gap-1 p-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-muted/10 transition-colors">
                            <div className="w-7 h-7 rounded overflow-hidden shrink-0 border border-border">
                              {post.mediaType === "video" ? (
                                <div className="w-full h-full bg-card flex items-center justify-center"><Video className="w-3 h-3 text-muted" /></div>
                              ) : (
                                <img src={post.mediaUrl} alt="" className="w-full h-full object-cover" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                {post.presetLabel && (
                                  <p className="text-[8px] text-accent font-medium truncate leading-tight">{post.presetLabel}</p>
                                )}
                              </div>
                              <p className="text-[9px] text-muted truncate leading-tight">
                                {post.caption ? post.caption.slice(0, 40) : t("social.noCaption")}
                              </p>
                              <p className="text-[8px] text-muted/60 leading-tight">{formatTime12(post.time)}</p>
                            </div>
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                post.status === "published" ? "bg-green-500" : post.status === "scheduled" ? "bg-blue-500" : "bg-yellow-500"
                              }`}
                              title={post.status === "published" ? t("social.statusPublished") : post.status === "scheduled" ? t("social.statusScheduled") : t("social.statusDraft")}
                            />
                            <div className="absolute right-0 top-0 hidden group-hover:flex items-center gap-0.5 bg-card border border-border rounded shadow-sm p-0.5">
                              <button onClick={() => openEdit(post)} className="p-0.5 hover:text-accent transition-colors">
                                <Edit3 className="w-2.5 h-2.5" />
                              </button>
                              <button onClick={() => removePost(post.id)} className="p-0.5 hover:text-danger transition-colors">
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Edit post modal ── */}
      {editingPost && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setEditingPost(null)}>
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{t("social.editPost")} &mdash; {editingPost.date}</h3>
              <button onClick={() => setEditingPost(null)} className="p-1 hover:bg-muted/10 rounded"><X className="w-4 h-4" /></button>
            </div>

            {/* Preview + status */}
            <div className="flex gap-4">
              <div className="w-24 h-24 rounded-xl overflow-hidden border border-border shrink-0">
                {editingPost.mediaType === "video" ? (
                  <video src={editingPost.mediaUrl} className="w-full h-full object-cover" muted />
                ) : (
                  <img src={editingPost.mediaUrl} alt="" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                {editingPost.presetLabel && (
                  <span className="text-[11px] text-accent font-medium">{editingPost.presetLabel}</span>
                )}
                <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  editingPost.status === "published" ? "bg-green-500/10 text-green-500"
                    : editingPost.status === "scheduled" ? "bg-blue-500/10 text-blue-500"
                    : "bg-yellow-500/10 text-yellow-600"
                }`}>{t(`social.${editingPost.status}` as "social.draft" | "social.scheduled" | "social.published")}</span>
              </div>
            </div>

            {/* Time + Timezone */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium mb-1 block">{t("social.postTime")}</label>
                <input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">{t("social.timezone")}</label>
                <select value={editTimezone} onChange={(e) => setEditTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30">
                  {!timezoneInList && (
                    <option value={editTimezone}>{editTimezone}</option>
                  )}
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>{tz.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Caption with AI generate */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium">{t("social.caption")}</label>
                <button onClick={handleGenerateCaptionInModal} disabled={generatingCaption}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] text-accent font-medium rounded-lg hover:bg-accent/10 transition-colors disabled:opacity-40">
                  {generatingCaption ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {generatingCaption ? t("social.generating") : t("social.aiCaption")}
                </button>
              </div>
              <textarea value={editCaption} onChange={(e) => setEditCaption(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30 resize-none"
                placeholder={t("social.captionPlaceholder")} />
            </div>

            {/* Account selector */}
            {connected && accounts.length > 0 && (
              <div>
                <label className="text-xs font-medium mb-1 block">{t("social.publishTo")}</label>
                <select value={editingPost.accountId || ""}
                  onChange={(e) => {
                    const acc = accounts.find((a) => a.id === e.target.value);
                    updatePost(editingPost.id, {
                      accountId: e.target.value || null,
                      platform: acc?.platform || editingPost.platform,
                    });
                    setEditingPost({ ...editingPost, accountId: e.target.value || null, platform: acc?.platform || editingPost.platform });
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30">
                  <option value="">{t("social.selectAccount")}</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {PLATFORM_LABELS[acc.platform] || acc.platform} &mdash; @{acc.username}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {publishError && (
              <p className="text-xs text-danger flex items-center gap-1"><AlertCircle className="w-3 h-3" />{publishError}</p>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button onClick={saveEdit}
                className="px-5 py-2 bg-primary text-white rounded-full text-sm font-medium hover:bg-primary-hover transition-colors">
                {t("social.save")}
              </button>
              {(editingPost.accountId || defaultAccountId) && editingPost.status === "draft" && (
                <button onClick={() => handlePublishPost(editingPost)} disabled={publishingId === editingPost.id}
                  className="flex items-center gap-2 px-5 py-2 bg-accent text-white rounded-full text-sm font-medium hover:bg-accent-light transition-colors disabled:opacity-40">
                  {publishingId === editingPost.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {t("social.publishBlotato")}
                </button>
              )}
              <button onClick={() => setEditingPost(null)} className="px-4 py-2 text-sm text-muted hover:text-foreground transition-colors">
                {t("social.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {!profile && (
        <div className="flex flex-col items-center justify-center py-20 text-muted">
          <Share2 className="w-12 h-12 text-muted/30 mb-3" />
          <p className="text-sm">{t("social.selectCategory")}</p>
        </div>
      )}

      {/* ── Preview Lightbox ── */}
      {previewItem && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreviewItem(null)}
        >
          <div
            className="relative max-w-3xl w-full max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setPreviewItem(null)}
              className="absolute -top-10 right-0 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {previewItem.mode === "video" ? (
              <video
                src={previewItem.resultUrl}
                controls
                autoPlay
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
                             />
            ) : (
              <img
                src={previewItem.resultUrl}
                alt=""
                className="max-w-full max-h-[80vh] rounded-xl shadow-2xl object-contain"
                             />
            )}

            {/* Info bar */}
            <div className="mt-3 flex items-center gap-3 text-white/70 text-xs">
              <span className="px-2 py-0.5 rounded bg-white/10 uppercase text-[10px] font-medium">
                {previewItem.mode}
              </span>
              <span>{new Date(previewItem.timestamp).toLocaleDateString()}</span>
              {previewItem.prompt && (
                <span className="truncate max-w-xs" title={previewItem.prompt}>
                  {previewItem.prompt.substring(0, 60)}…
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
