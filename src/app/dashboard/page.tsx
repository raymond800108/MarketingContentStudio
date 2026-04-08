"use client";

import { useProfileStore } from "@/lib/stores/profile-store";
import { useGenerationStore } from "@/lib/stores/generation-store";
import { useApiUsageStore, type ApiService, type ApiAction } from "@/lib/stores/api-usage-store";
import { getProfile } from "@/lib/profiles";
import { LayoutDashboard, Settings, Clock, Trash2, Activity, Zap, AlertTriangle, Timer } from "lucide-react";
import { useState, useMemo } from "react";
import { useT } from "@/lib/i18n";

const SERVICE_COLORS: Record<ApiService, string> = {
  kie: "bg-blue-500",
  openai: "bg-emerald-500",
  fal: "bg-purple-500",
  blotato: "bg-orange-500",
};

const ACTION_LABELS: Record<ApiAction, string> = {
  image_generation: "dashboard.imageGen",
  video_generation: "dashboard.videoGen",
  product_analysis: "dashboard.productAnalysis",
  caption_generation: "dashboard.captionGen",
  file_upload: "dashboard.fileUpload",
  blotato_publish: "dashboard.publish",
  blotato_media: "dashboard.mediaUpload",
  blotato_accounts: "dashboard.fetchAccounts",
  blotato_schedules: "dashboard.schedules",
};

export default function DashboardPage() {
  const { activeProfileId, brandAssets, setBrandAssets } = useProfileStore();
  const history = useGenerationStore((s) => s.history);
  const clearHistory = useGenerationStore((s) => s.clearHistory);
  const profile = activeProfileId ? getProfile(activeProfileId) : null;
  const [brandName, setBrandName] = useState(brandAssets.name || "");
  const t = useT();

  // API Usage data
  const records = useApiUsageStore((s) => s.records);
  const clearRecords = useApiUsageStore((s) => s.clearRecords);
  const getStatsByService = useApiUsageStore((s) => s.getStatsByService);
  const getStatsByAction = useApiUsageStore((s) => s.getStatsByAction);
  const getRecentRecords = useApiUsageStore((s) => s.getRecentRecords);

  const totalCalls = records.length;
  const successCalls = useMemo(() => records.filter((r) => r.status === "success").length, [records]);
  const errorCalls = totalCalls - successCalls;
  const successRate = totalCalls > 0 ? Math.round((successCalls / totalCalls) * 100) : 0;
  const avgResponse = useMemo(() => {
    if (records.length === 0) return 0;
    return Math.round(records.reduce((sum, r) => sum + r.durationMs, 0) / records.length);
  }, [records]);
  const serviceStats = getStatsByService();
  const actionStats = getStatsByAction();
  const recentCalls = getRecentRecords(20);

  const handleSaveBrand = () => {
    setBrandAssets({ name: brandName.trim() });
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
      </div>

      {/* Brand settings */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-4 h-4 text-muted" />
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t("dashboard.brandSettings")}</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1 block">{t("dashboard.brandName")}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30"
              />
              <button
                onClick={handleSaveBrand}
                className="px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                {t("dashboard.save")}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">{t("dashboard.activeProfile")}</label>
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-background">
              {profile ? (
                <>
                  <span className="text-lg">{profile.icon}</span>
                  <span className="text-sm">{profile.name}</span>
                </>
              ) : (
                <span className="text-sm text-muted">{t("dashboard.noProfile")}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* API Usage */}
      <div className="rounded-2xl border border-border bg-card p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-muted" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t("dashboard.apiUsage")}</h2>
          </div>
          {totalCalls > 0 && (
            <button
              onClick={clearRecords}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {t("dashboard.clearUsage")}
            </button>
          )}
        </div>

        {totalCalls === 0 ? (
          <div className="text-center py-12 text-muted">
            <Activity className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm">{t("dashboard.noApiCalls")}</p>
            <p className="text-xs mt-1">{t("dashboard.noApiHint")}</p>
          </div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.totalCalls")}</span>
                </div>
                <p className="text-2xl font-bold">{totalCalls}</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Activity className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.successRate")}</span>
                </div>
                <p className="text-2xl font-bold">{successRate}%</p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Timer className="w-3.5 h-3.5 text-blue-500" />
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.avgResponse")}</span>
                </div>
                <p className="text-2xl font-bold">{avgResponse}<span className="text-sm font-normal text-muted">ms</span></p>
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.errors")}</span>
                </div>
                <p className="text-2xl font-bold">{errorCalls}</p>
              </div>
            </div>

            {/* By Service + By Action */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{t("dashboard.byService")}</h3>
                <div className="space-y-2">
                  {(Object.entries(serviceStats) as [ApiService, { totalCalls: number; successCalls: number; errorCalls: number; avgDurationMs: number }][]).map(([service, stats]) => (
                    <div key={service} className="flex items-center gap-2 text-sm">
                      <span className={`w-2.5 h-2.5 rounded-full ${SERVICE_COLORS[service]}`} />
                      <span className="font-medium uppercase text-xs flex-1">{service}</span>
                      <span className="text-muted text-xs">{stats.totalCalls} {t("dashboard.calls")}</span>
                      <span className="text-emerald-500 text-xs">{stats.successCalls} {t("dashboard.success")}</span>
                      {stats.errorCalls > 0 && (
                        <span className="text-red-500 text-xs">{stats.errorCalls} {t("dashboard.error")}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{t("dashboard.byAction")}</h3>
                <div className="space-y-2">
                  {(Object.entries(actionStats) as [ApiAction, { totalCalls: number; successCalls: number; errorCalls: number; avgDurationMs: number }][]).map(([action, stats]) => (
                    <div key={action} className="flex items-center justify-between text-sm">
                      <span className="text-xs">{t(ACTION_LABELS[action] as Parameters<typeof t>[0])}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-xs">{stats.totalCalls} {t("dashboard.calls")}</span>
                        <span className="text-muted text-xs">{stats.avgDurationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent calls */}
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{t("dashboard.recentCalls")}</h3>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {recentCalls.map((rec) => (
                  <div key={rec.id} className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-muted/5">
                    <span className={`w-1.5 h-1.5 rounded-full ${rec.status === "success" ? "bg-emerald-500" : "bg-red-500"}`} />
                    <span className={`w-2 h-2 rounded-full ${SERVICE_COLORS[rec.service]}`} />
                    <span className="uppercase font-medium text-[10px] w-12">{rec.service}</span>
                    <span className="flex-1 text-muted truncate">{t(ACTION_LABELS[rec.action] as Parameters<typeof t>[0])}</span>
                    <span className="text-muted">{rec.durationMs}ms</span>
                    <span className="text-muted">{new Date(rec.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Generation History */}
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">{t("dashboard.history")}</h2>
          </div>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {t("dashboard.clear")}
            </button>
          )}
        </div>
        {history.length === 0 ? (
          <div className="text-center py-12 text-muted">
            <Clock className="w-10 h-10 text-muted/30 mx-auto mb-3" />
            <p className="text-sm">{t("dashboard.emptyHistory")}</p>
            <p className="text-xs mt-1">{t("dashboard.emptyHistoryHint")}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {history.map((item) => (
              <a
                key={item.id}
                href={item.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-xl overflow-hidden border border-border hover:border-accent/40 transition-colors"
              >
                {item.mode === "video" ? (
                  <video src={item.resultUrl} className="w-full aspect-square object-cover" muted crossOrigin="anonymous" />
                ) : (
                  <img src={item.resultUrl} alt="" className="w-full aspect-square object-cover" crossOrigin="anonymous" />
                )}
                <div className="p-2">
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">
                    {item.mode}
                  </span>
                  <p className="text-[11px] text-muted truncate mt-0.5">
                    {new Date(item.timestamp).toLocaleDateString()} {new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
