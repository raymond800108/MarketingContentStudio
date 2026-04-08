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

/** Helper to track an API call. Wrap your fetch with this. */
export async function trackApiCall<T>(
  service: ApiService,
  action: ApiAction,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    useApiUsageStore.getState().addRecord({
      service,
      action,
      timestamp: Date.now(),
      status: "success",
      durationMs: Date.now() - start,
      endpoint,
    });
    return result;
  } catch (err) {
    useApiUsageStore.getState().addRecord({
      service,
      action,
      timestamp: Date.now(),
      status: "error",
      durationMs: Date.now() - start,
      endpoint,
    });
    throw err;
  }
}
