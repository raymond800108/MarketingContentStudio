"use client";

import { useEffect, useRef, useCallback } from "react";
import { useCalendarStore, type CalendarPost } from "@/lib/stores/calendar-store";
import { useBlotatoStore } from "@/lib/stores/blotato-store";
import { trackApiCall } from "@/lib/stores/api-usage-store";

const CHECK_INTERVAL_MS = 30_000; // Check every 30 seconds

/**
 * Convert a post's date + time + timezone into a UTC timestamp (ms).
 * The post stores time in the selected timezone, so we need to figure out
 * what UTC instant that corresponds to.
 */
function postToUtcMs(post: CalendarPost): number {
  const dateTimeStr = `${post.date}T${post.time || "12:00"}:00`;
  try {
    // Parse as local first
    const localDate = new Date(dateTimeStr);
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: post.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    const parts = formatter.formatToParts(localDate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "0";
    const tzDate = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`
    );
    const offset = tzDate.getTime() - localDate.getTime();
    return localDate.getTime() - offset;
  } catch {
    return new Date(dateTimeStr + "Z").getTime();
  }
}

/**
 * useAutoScheduler — runs a 30s interval that checks for posts
 * whose scheduled time has arrived. If found, publishes them via
 * the server-side auto-publish API route and updates the store.
 */
export function useAutoScheduler() {
  const publishingRef = useRef<Set<string>>(new Set());

  const publishPost = useCallback(async (post: CalendarPost) => {
    // Prevent double-publishing
    if (publishingRef.current.has(post.id)) return;
    publishingRef.current.add(post.id);

    const { apiKey } = useBlotatoStore.getState();
    const { defaultAccountId } = useBlotatoStore.getState();
    const effectiveAccountId = post.accountId || defaultAccountId;

    if (!effectiveAccountId) {
      publishingRef.current.delete(post.id);
      return;
    }

    try {
      // Mark as publishing immediately to prevent re-trigger
      useCalendarStore.getState().updatePost(post.id, { status: "scheduled" });

      const data = await trackApiCall(
        "blotato",
        "blotato_publish",
        "/api/social/auto-publish",
        async () => {
          const res = await fetch("/api/social/auto-publish", {
            method: "POST",
            headers: {
              "x-blotato-key": apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              accountId: effectiveAccountId,
              text: post.caption || ".",
              mediaUrl: post.mediaUrl,
              platform: post.platform || "twitter",
              presetId: post.presetId || null,
            }),
          });
          const d = await res.json();
          if (!res.ok) throw new Error(d.error || "Auto-publish failed");
          return d;
        }
      );

      // Blotato's 201 means "queued", not "published". Keep status as
      // "scheduled" with the submissionId attached — the status poller
      // below will flip it to "published" once Blotato confirms.
      useCalendarStore.getState().updatePost(post.id, {
        status: "scheduled",
        blotatoPostId: data.postSubmissionId || null,
      });

      console.log(`[AutoScheduler] Queued post ${post.id} with Blotato (id=${data.postSubmissionId}) at ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      // Mark as failed — do NOT revert to "draft" or the auto-scheduler
      // will retry every 30s in an infinite loop.
      useCalendarStore.getState().updatePost(post.id, { status: "failed" });
      console.error(`[AutoScheduler] Failed to publish post ${post.id}:`, err);
    } finally {
      publishingRef.current.delete(post.id);
    }
  }, []);

  // ── Poll Blotato for the actual status of queued posts ──
  // Blotato publishes asynchronously: POST /v2/posts returns 201 ("queued"),
  // then their workers push to the target platform. We poll GET /v2/posts/{id}
  // to find out when a queued post actually reaches "published" or "failed".
  const pollingRef = useRef<Set<string>>(new Set());

  const pollBlotatoStatus = useCallback(async () => {
    const { apiKey } = useBlotatoStore.getState();
    if (!apiKey) return;

    const posts = useCalendarStore.getState().posts;
    // Any post that has been handed to Blotato but isn't yet confirmed
    // published. We look for scheduled posts that (a) have a blotatoPostId
    // and (b) whose scheduled time is in the past (i.e. they should already
    // have been published, so we're waiting on Blotato to catch up).
    const now = Date.now();
    const pending = posts.filter(
      (p) =>
        p.blotatoPostId &&
        p.status !== "published" &&
        postToUtcMs(p) <= now + 60_000 &&
        !pollingRef.current.has(p.blotatoPostId)
    );

    for (const post of pending) {
      const submissionId = post.blotatoPostId!;
      pollingRef.current.add(submissionId);
      try {
        const res = await fetch(`/api/blotato/publish?id=${encodeURIComponent(submissionId)}`, {
          headers: { "x-blotato-key": apiKey },
        });
        const data = await res.json();
        if (!res.ok) {
          console.warn(`[AutoScheduler] Poll failed for ${submissionId}:`, data.error);
          continue;
        }
        // Dump Blotato's full response so we can see exactly what their
        // worker thinks of this submission — status, errors, platform
        // responses, the lot. This is the only way to diagnose posts that
        // sit in "QUEUED" forever on the Blotato dashboard.
        console.log(`[AutoScheduler] Blotato GET /posts/${submissionId} →`, data);

        // Blotato returns { status: "queued" | "in-progress" | "success" | "failed" | ... }
        // Be defensive: some responses nest status under `post` or use different labels.
        const rawStatus: string = (
          data.status ||
          data.post?.status ||
          data.data?.status ||
          ""
        ).toString().toLowerCase();

        const isPublished =
          rawStatus === "success" ||
          rawStatus === "published" ||
          rawStatus === "completed" ||
          rawStatus === "complete" ||
          rawStatus === "posted";
        const isFailed =
          rawStatus === "failed" ||
          rawStatus === "error" ||
          rawStatus === "rejected";

        if (isPublished) {
          useCalendarStore.getState().updatePost(post.id, { status: "published" });
          console.log(`[AutoScheduler] Blotato confirmed published: ${post.id} (${submissionId})`);
        } else if (isFailed) {
          // Mark as failed so user can see the error and manually retry.
          useCalendarStore.getState().updatePost(post.id, {
            status: "failed",
            blotatoPostId: null,
          });
          console.warn(`[AutoScheduler] Blotato reported failure for ${post.id} (${submissionId}): ${rawStatus}`);
        } else {
          console.log(`[AutoScheduler] Blotato still processing ${submissionId}: ${rawStatus || "unknown"}`);
        }
      } catch (err) {
        console.error(`[AutoScheduler] Poll error for ${submissionId}:`, err);
      } finally {
        pollingRef.current.delete(submissionId);
      }
    }
  }, []);

  useEffect(() => {
    function checkDuePosts() {
      const now = Date.now();
      const posts = useCalendarStore.getState().posts;

      for (const post of posts) {
        // Only auto-publish DRAFT posts — scheduled/published posts are
        // already being handled (either by manual publish or Blotato).
        if (post.status !== "draft") continue;
        if (publishingRef.current.has(post.id)) continue;
        // Already handed off to Blotato — the status poller will finish it.
        if (post.blotatoPostId) continue;

        const postUtc = postToUtcMs(post);

        // Post is due if its time has passed (with 60s grace period into the future)
        if (postUtc <= now + 60_000) {
          publishPost(post);
        }
      }
    }

    // Run immediately on mount
    checkDuePosts();
    pollBlotatoStatus();

    // Then check every 30 seconds
    const interval = setInterval(() => {
      checkDuePosts();
      pollBlotatoStatus();
    }, CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [publishPost, pollBlotatoStatus]);
}
