"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ApiService = "kie" | "openai" | "fal" | "meshy" | "blotato";

export type ApiAction =
  | "image-generate"
  | "video-generate"
  | "product-analysis"
  | "caption-generate"
  | "video-prompt-refine"
  | "file-upload"
  | "blotato-publish"
  | "blotato-media"
  | "blotato-accounts"
  | "blotato-schedules";

export interface UsageEntry {
  id: string;
  timestamp: number;
  service: ApiService;
  action: ApiAction;
  model?: string;
  costUsd: number;
  tokensIn?: number;
  tokensOut?: number;
  status: "success" | "error";
  durationMs: number;
  detail?: string;
  userEmail?: string;
}

export interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalPriceUsd: number; // costUsd × PRICE_MULTIPLIER
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokens: number;
  successCalls: number;
  errorCalls: number;
  avgDurationMs: number;
  byService: Record<string, { calls: number; costUsd: number; errors: number }>;
  byAction: Record<string, { calls: number; costUsd: number; errors: number }>;
}

export const PRICE_MULTIPLIER = 5;

/* ------------------------------------------------------------------ */
/*  Price table                                                        */
/* ------------------------------------------------------------------ */

export const PRICE_TABLE: Record<
  ApiAction,
  { service: ApiService; model: string; costUsd: number }
> = {
  "image-generate":      { service: "kie",     model: "nano-banana-2", costUsd: 0.04 },
  "video-generate":      { service: "kie",     model: "kling-3.0",    costUsd: 0.40 },  // default fallback; UGC page overrides with per-model cost
  "product-analysis":    { service: "openai",  model: "gpt-4o",       costUsd: 0.03 },
  "caption-generate":    { service: "openai",  model: "gpt-4o",       costUsd: 0.02 },
  "video-prompt-refine": { service: "openai",  model: "gpt-4o",       costUsd: 0.01 },
  "file-upload":         { service: "kie",     model: "upload",       costUsd: 0 },
  "blotato-publish":     { service: "blotato", model: "v2",           costUsd: 0 },
  "blotato-media":       { service: "blotato", model: "v2",           costUsd: 0 },
  "blotato-accounts":    { service: "blotato", model: "v2",           costUsd: 0 },
  "blotato-schedules":   { service: "blotato", model: "v2",           costUsd: 0 },
};

/* ------------------------------------------------------------------ */
/*  Summary helper                                                     */
/* ------------------------------------------------------------------ */

export function computeSummary(entries: UsageEntry[]): UsageSummary {
  const byService: UsageSummary["byService"] = {};
  const byAction: UsageSummary["byAction"] = {};
  let totalCostUsd = 0;
  let totalTokensIn = 0;
  let totalTokensOut = 0;
  let successCalls = 0;
  let errorCalls = 0;
  let totalDuration = 0;

  for (const e of entries) {
    totalCostUsd += e.costUsd;
    totalTokensIn += e.tokensIn ?? 0;
    totalTokensOut += e.tokensOut ?? 0;
    totalDuration += e.durationMs;
    if (e.status === "success") successCalls++;
    else errorCalls++;

    // by service
    if (!byService[e.service]) byService[e.service] = { calls: 0, costUsd: 0, errors: 0 };
    byService[e.service].calls++;
    byService[e.service].costUsd += e.costUsd;
    if (e.status === "error") byService[e.service].errors++;

    // by action
    if (!byAction[e.action]) byAction[e.action] = { calls: 0, costUsd: 0, errors: 0 };
    byAction[e.action].calls++;
    byAction[e.action].costUsd += e.costUsd;
    if (e.status === "error") byAction[e.action].errors++;
  }

  const totalTokens = totalTokensIn + totalTokensOut;

  return {
    totalCalls: entries.length,
    totalCostUsd,
    totalPriceUsd: totalCostUsd * PRICE_MULTIPLIER,
    totalTokensIn,
    totalTokensOut,
    totalTokens,
    successCalls,
    errorCalls,
    avgDurationMs: entries.length > 0 ? totalDuration / entries.length : 0,
    byService,
    byAction,
  };
}

/** Compute per-user summaries from a list of entries */
export function computePerUserSummaries(
  entries: UsageEntry[]
): { email: string; summary: UsageSummary }[] {
  const grouped: Record<string, UsageEntry[]> = {};
  for (const e of entries) {
    const key = e.userEmail ?? "unknown";
    (grouped[key] ??= []).push(e);
  }
  return Object.entries(grouped)
    .map(([email, userEntries]) => ({
      email,
      summary: computeSummary(userEntries),
    }))
    .sort((a, b) => b.summary.totalCostUsd - a.summary.totalCostUsd);
}

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const MAX_LOCAL_ENTRIES = 500;

function lsKey(email: string | undefined): string {
  return `ce-usage:${email ?? "anon"}`;
}

function loadLocal(email: string | undefined): UsageEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(lsKey(email));
    if (!raw) return [];
    return JSON.parse(raw) as UsageEntry[];
  } catch {
    return [];
  }
}

function saveLocal(email: string | undefined, entries: UsageEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    const trimmed = entries.slice(0, MAX_LOCAL_ENTRIES);
    localStorage.setItem(lsKey(email), JSON.stringify(trimmed));
  } catch {
    /* quota exceeded – silently ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export type ViewMode = "self" | "all" | string; // string = specific email

export function useUsageTracking(
  userEmail: string | undefined,
  viewMode: ViewMode = "self"
) {
  const [entries, setEntries] = useState<UsageEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [kvAvailable, setKvAvailable] = useState(false);
  const mountedRef = useRef(true);

  /* --- load from localStorage on mount, then refresh from server --- */
  useEffect(() => {
    mountedRef.current = true;
    const local = loadLocal(userEmail);
    setEntries(local);
    refreshFromServer();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userEmail, viewMode]);

  /* --- refreshFromServer --- */
  const refreshFromServer = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (viewMode === "all") {
        params.set("scope", "all");
      } else if (viewMode !== "self" && viewMode) {
        params.set("scope", "user");
        params.set("email", viewMode);
      }
      const qs = params.toString();
      const res = await fetch(`/api/usage${qs ? `?${qs}` : ""}`);
      if (res.ok) {
        const data: UsageEntry[] = await res.json();
        if (mountedRef.current) {
          setEntries(data);
          setKvAvailable(true);
          // persist own entries locally
          if (viewMode === "self") saveLocal(userEmail, data);
        }
      }
    } catch {
      /* server unavailable – keep localStorage data */
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userEmail, viewMode]);

  /* --- logUsage --- */
  const logUsage = useCallback(
    (
      action: ApiAction,
      opts?: Partial<
        Pick<UsageEntry, "status" | "durationMs" | "detail" | "tokensIn" | "tokensOut" | "costUsd" | "model" | "service">
      >
    ) => {
      const price = PRICE_TABLE[action];
      const entry: UsageEntry = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        service: opts?.service ?? price.service,
        action,
        model: opts?.model ?? price.model,
        costUsd: opts?.costUsd ?? price.costUsd,
        tokensIn: opts?.tokensIn,
        tokensOut: opts?.tokensOut,
        status: opts?.status ?? "success",
        durationMs: opts?.durationMs ?? 0,
        detail: opts?.detail,
        userEmail,
      };

      // optimistic update
      setEntries((prev) => {
        const next = [entry, ...prev].slice(0, MAX_LOCAL_ENTRIES);
        saveLocal(userEmail, next);
        return next;
      });

      // fire-and-forget POST
      fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry),
      }).catch(() => {});
    },
    [userEmail]
  );

  /* --- clearUsage --- */
  const clearUsage = useCallback(() => {
    setEntries([]);
    saveLocal(userEmail, []);
    fetch("/api/usage", { method: "DELETE" }).catch(() => {});
  }, [userEmail]);

  /* --- summary --- */
  const summary = useMemo(() => computeSummary(entries), [entries]);

  return {
    entries,
    logUsage,
    clearUsage,
    summary,
    kvAvailable,
    refreshFromServer,
    loading,
  };
}
