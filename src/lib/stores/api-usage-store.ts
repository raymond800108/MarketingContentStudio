"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ApiService = "kie" | "openai" | "fal" | "blotato";
export type ApiAction =
  | "image_generation"
  | "video_generation"
  | "product_analysis"
  | "caption_generation"
  | "file_upload"
  | "blotato_publish"
  | "blotato_media"
  | "blotato_accounts"
  | "blotato_schedules";

export interface ApiCallRecord {
  id: string;
  service: ApiService;
  action: ApiAction;
  timestamp: number;
  status: "success" | "error";
  durationMs: number;
  endpoint: string;
}

export interface ServiceStats {
  totalCalls: number;
  successCalls: number;
  errorCalls: number;
  avgDurationMs: number;
}

interface ApiUsageStore {
  records: ApiCallRecord[];
  addRecord: (record: Omit<ApiCallRecord, "id">) => void;
  clearRecords: () => void;

  getStatsByService: () => Record<ApiService, ServiceStats>;
  getStatsByAction: () => Record<ApiAction, ServiceStats>;
  getTotalCalls: () => number;
  getRecentRecords: (limit: number) => ApiCallRecord[];
}

function computeStats(records: ApiCallRecord[]): ServiceStats {
  if (records.length === 0) return { totalCalls: 0, successCalls: 0, errorCalls: 0, avgDurationMs: 0 };
  const success = records.filter((r) => r.status === "success").length;
  const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0);
  return {
    totalCalls: records.length,
    successCalls: success,
    errorCalls: records.length - success,
    avgDurationMs: Math.round(totalDuration / records.length),
  };
}

export const useApiUsageStore = create<ApiUsageStore>()(
  persist(
    (set, get) => ({
      records: [],

      addRecord: (record) =>
        set((s) => ({
          records: [{ ...record, id: crypto.randomUUID() }, ...s.records].slice(0, 500),
        })),

      clearRecords: () => set({ records: [] }),

      getStatsByService: () => {
        const records = get().records;
        const grouped: Record<string, ApiCallRecord[]> = {};
        for (const r of records) {
          (grouped[r.service] ??= []).push(r);
        }
        const result: Record<string, ServiceStats> = {};
        for (const [service, recs] of Object.entries(grouped)) {
          result[service] = computeStats(recs);
        }
        return result as Record<ApiService, ServiceStats>;
      },

      getStatsByAction: () => {
        const records = get().records;
        const grouped: Record<string, ApiCallRecord[]> = {};
        for (const r of records) {
          (grouped[r.action] ??= []).push(r);
        }
        const result: Record<string, ServiceStats> = {};
        for (const [action, recs] of Object.entries(grouped)) {
          result[action] = computeStats(recs);
        }
        return result as Record<ApiAction, ServiceStats>;
      },

      getTotalCalls: () => get().records.length,

      getRecentRecords: (limit) => get().records.slice(0, limit),
    }),
    {
      name: "studio-api-usage",
      partialize: (state) => ({ records: state.records }),
    }
  )
);

// Map old action names to new usage system action names
const ACTION_MAP: Record<ApiAction, string> = {
  image_generation: "image-generate",
  video_generation: "video-generate",
  product_analysis: "product-analysis",
  caption_generation: "caption-generate",
  file_upload: "file-upload",
  blotato_publish: "blotato-publish",
  blotato_media: "blotato-media",
  blotato_accounts: "blotato-accounts",
  blotato_schedules: "blotato-schedules",
};

const PRICE_TABLE: Record<string, number> = {
  "image-generate": 0.20,
  "video-generate": 0.40,  // default fallback; callers pass costOverride for per-model pricing
  "product-analysis": 0.03,
  "caption-generate": 0.02,
  "file-upload": 0,
  "blotato-publish": 0,
  "blotato-media": 0,
  "blotato-accounts": 0,
  "blotato-schedules": 0,
};

/** Fire usage entry to server (fire-and-forget) */
function persistToServer(entry: {
  id: string; timestamp: number; service: string; action: string;
  costUsd: number; status: string; durationMs: number; model?: string;
}) {
  fetch("/api/usage", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entry),
  }).catch(() => {});
}

/**
 * Per-second cost rates for video models (from Kie.ai / PiAPI pricing).
 * The final cost = rate × duration in seconds.
 */
export const VIDEO_COST_PER_SEC: Record<string, { withInput: number; noInput: number }> = {
  // bytedance/seedance-2, 720p
  "seedance-2":      { withInput: 0.125, noInput: 0.205 },
  // bytedance/seedance-2-fast, 720p (estimated from seedance-2 480p tier)
  "seedance-2-fast": { withInput: 0.057, noInput: 0.095 },
  // kling-3.0 (image-to-video = withInput, text-to-video = noInput)
  "kling-3.0":       { withInput: 0.08,  noInput: 0.10 },
  // kling-2.6 fallback
  "kling-2.6":       { withInput: 0.08,  noInput: 0.10 },
};

/** Calculate video cost from model, duration, and whether reference images are used. */
export function calcVideoCost(
  videoModel: string,
  durationSec: number,
  hasImageInput: boolean
): number {
  const rates = VIDEO_COST_PER_SEC[videoModel] ?? VIDEO_COST_PER_SEC["kling-3.0"];
  const rate = hasImageInput ? rates.withInput : rates.noInput;
  return Math.round(rate * durationSec * 1000) / 1000; // round to 3 decimals
}

/** Helper to track an API call. Wrap your fetch with this.
 *  Pass `costOverride` to use a specific cost instead of the default PRICE_TABLE lookup.
 *  Pass `model` to record which model was used.
 */
export async function trackApiCall<T>(
  service: ApiService,
  action: ApiAction,
  endpoint: string,
  fn: () => Promise<T>,
  opts?: { costOverride?: number; model?: string }
): Promise<T> {
  const start = Date.now();
  const newAction = ACTION_MAP[action] || action;
  const cost = opts?.costOverride ?? PRICE_TABLE[newAction] ?? 0;
  try {
    const result = await fn();
    const dur = Date.now() - start;
    useApiUsageStore.getState().addRecord({
      service,
      action,
      timestamp: Date.now(),
      status: "success",
      durationMs: dur,
      endpoint,
    });
    persistToServer({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      service,
      action: newAction,
      costUsd: cost,
      status: "success",
      durationMs: dur,
      ...(opts?.model ? { model: opts.model } : {}),
    });
    return result;
  } catch (err) {
    const dur = Date.now() - start;
    useApiUsageStore.getState().addRecord({
      service,
      action,
      timestamp: Date.now(),
      status: "error",
      durationMs: dur,
      endpoint,
    });
    persistToServer({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      service,
      action: newAction,
      costUsd: cost,
      status: "error",
      durationMs: dur,
      ...(opts?.model ? { model: opts.model } : {}),
    });
    throw err;
  }
}
