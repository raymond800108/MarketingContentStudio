"use client";

import { useState, useMemo, useCallback } from "react";
import {
  Activity,
  Cloud,
  HardDrive,
  RefreshCw,
  Trash2,
  Zap,
  DollarSign,
  Timer,
  AlertTriangle,
  ChevronDown,
  Users,
  Coins,
} from "lucide-react";
import { useT, useTMaybe } from "@/lib/i18n";
import type { ApiAction, UsageEntry, UsageSummary } from "@/lib/usage";
import { computePerUserSummaries } from "@/lib/usage";

// ── Types ──

export interface UserListItem {
  email: string;
  count: number;
  totalCostUsd?: number;
  totalTokens?: number;
  successCalls?: number;
  errorCalls?: number;
}

export interface UsagePanelProps {
  entries: UsageEntry[];
  summary: UsageSummary;
  kvAvailable: boolean;
  onClear: () => void;
  onRefresh: () => void;
  userEmail: string | null;
  isAdmin: boolean;
  viewMode: string;
  onViewModeChange: (mode: string) => void;
  userList?: UserListItem[];
  loading?: boolean;
}

// ── Constants ──

const ACTION_LABELS: Record<string, string> = {
  "image-generate": "Image Generation",
  "video-generate": "Video Generation",
  "product-analysis": "Product Analysis",
  "caption-generate": "Caption Generation",
  "video-prompt-refine": "Prompt Refinement",
  "file-upload": "File Upload",
  "blotato-publish": "Publish Post",
  "blotato-media": "Media Upload",
  "blotato-accounts": "Fetch Accounts",
  "blotato-schedules": "Schedules",
};

const SERVICE_COLORS: Record<string, string> = {
  kie: "bg-blue-500",
  openai: "bg-emerald-500",
  fal: "bg-purple-500",
  meshy: "bg-cyan-500",
  blotato: "bg-orange-500",
};

// ── Helpers ──

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function getDayLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function getDateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Component ──

export default function UsagePanel({
  entries,
  summary,
  kvAvailable,
  onClear,
  onRefresh,
  userEmail,
  isAdmin,
  viewMode,
  onViewModeChange,
  userList,
  loading,
}: UsagePanelProps) {
  const t = useT();
  const tm = useTMaybe();
  const [confirmClear, setConfirmClear] = useState(false);
  const [visibleCount, setVisibleCount] = useState(20);
  const [selectedUser, setSelectedUser] = useState<string>("all");

  // ── Derived data ──

  const successRate = summary.totalCalls > 0
    ? Math.round((summary.successCalls / summary.totalCalls) * 100)
    : 0;

  // 7-day chart data
  const chartData = useMemo(() => {
    const now = new Date();
    const days: { key: string; label: string; cost: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      days.push({ key: getDateKey(d), label: getDayLabel(d), cost: 0 });
    }
    for (const entry of entries) {
      const key = getDateKey(new Date(entry.timestamp));
      const day = days.find((d) => d.key === key);
      if (day) day.cost += entry.costUsd;
    }
    return days;
  }, [entries]);

  const maxDayCost = useMemo(() => Math.max(...chartData.map((d) => d.cost), 0.01), [chartData]);

  type ServiceData = { calls: number; costUsd: number; errors: number };
  type ActionData = { calls: number; costUsd: number; errors: number };

  // Service breakdown
  const serviceEntries = useMemo(
    () =>
      (Object.entries(summary.byService) as [string, ServiceData][])
        .sort(([, a], [, b]) => b.calls - a.calls),
    [summary.byService]
  );

  // Action breakdown sorted by calls
  const actionEntries = useMemo(
    () =>
      (Object.entries(summary.byAction) as [string, ActionData][])
        .sort(([, a], [, b]) => b.calls - a.calls),
    [summary.byAction]
  );

  const maxActionCalls = useMemo(
    () => (actionEntries.length > 0 ? actionEntries[0][1].calls : 1),
    [actionEntries]
  );

  // Per-user summaries for admin "all" view
  const perUserSummaries = useMemo(() => {
    if (!isAdmin || viewMode === "self") return [];
    return computePerUserSummaries(entries);
  }, [entries, isAdmin, viewMode]);

  // Filtered + paginated log entries
  const filteredEntries = useMemo(() => {
    let list = [...entries];
    if (isAdmin && viewMode !== "self" && selectedUser !== "all") {
      list = list.filter((e) => e.userEmail === selectedUser);
    }
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [entries, isAdmin, viewMode, selectedUser]);

  const visibleEntries = filteredEntries.slice(0, visibleCount);
  const hasMore = visibleCount < filteredEntries.length;

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    onClear();
    setConfirmClear(false);
  }, [confirmClear, onClear]);

  // ── Empty state ──

  if (entries.length === 0 && !loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold">{t("dashboard.apiUsage")}</h2>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/10 text-muted">
              {kvAvailable ? (
                <><Cloud className="w-3 h-3" /> {tm("usage.cloudSynced", "Cloud synced")}</>
              ) : (
                <><HardDrive className="w-3 h-3" /> {tm("usage.localOnly", "Local only")}</>
              )}
            </span>
          </div>
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg hover:bg-muted/10 transition-colors text-muted"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <div className="text-center py-16 text-muted">
          <Activity className="w-12 h-12 text-muted/30 mx-auto mb-3" />
          <p className="text-sm">{t("dashboard.noApiCalls")}</p>
          <p className="text-xs mt-1">{t("dashboard.noApiHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 space-y-6">
      {/* ─── 1. Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold">{t("dashboard.apiUsage")}</h2>
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-muted/10 text-muted">
            {kvAvailable ? (
              <><Cloud className="w-3 h-3" /> {tm("usage.cloudSynced", "Cloud synced")}</>
            ) : (
              <><HardDrive className="w-3 h-3" /> {tm("usage.localOnly", "Local only")}</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-muted/10 transition-colors text-muted disabled:opacity-40"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleClear}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors ${
              confirmClear
                ? "bg-red-500/10 text-red-500 font-medium"
                : "text-muted hover:text-red-500 hover:bg-red-500/10"
            }`}
          >
            <Trash2 className="w-3 h-3" />
            {confirmClear ? tm("usage.confirmClear", "Confirm clear?") : t("dashboard.clearUsage")}
          </button>
        </div>
      </div>

      {/* ─── 2. Admin Controls ─── */}
      {isAdmin && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => onViewModeChange("self")}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                viewMode === "self" ? "bg-accent text-white" : "bg-background text-muted hover:bg-muted/10"
              }`}
            >
              {tm("usage.myUsage", "My Usage")}
            </button>
            <button
              onClick={() => onViewModeChange("all")}
              className={`px-4 py-2 text-xs font-medium transition-colors ${
                viewMode !== "self" ? "bg-accent text-white" : "bg-background text-muted hover:bg-muted/10"
              }`}
            >
              {tm("usage.allUsers", "All Users")}
            </button>
          </div>
          {viewMode !== "self" && userList && userList.length > 0 && (
            <div className="relative">
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-xs rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-accent/30 cursor-pointer"
              >
                <option value="all">{tm("usage.allUsersOption", "All users")}</option>
                {userList.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.email} ({u.count})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl border border-border bg-background text-muted hover:bg-muted/10 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {tm("usage.refresh", "Refresh")}
          </button>
        </div>
      )}

      {/* ─── 3. Stat Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.totalCalls")}</span>
          </div>
          <p className="text-2xl font-bold">{summary.totalCalls}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.estCost")}</span>
          </div>
          <p className="text-2xl font-bold">${summary.totalCostUsd.toFixed(2)}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Coins className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">Tokens</span>
          </div>
          <p className="text-2xl font-bold">{formatTokens(summary.totalTokens)}</p>
          {(summary.totalTokensIn > 0 || summary.totalTokensOut > 0) && (
            <p className="text-[10px] text-muted mt-0.5">
              In: {formatTokens(summary.totalTokensIn)} / Out: {formatTokens(summary.totalTokensOut)}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: success, avg response, errors */}
      <div className="grid grid-cols-3 gap-3">
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
          <p className="text-2xl font-bold">
            {Math.round(summary.avgDurationMs)}
            <span className="text-sm font-normal text-muted">ms</span>
          </p>
        </div>
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{t("dashboard.errors")}</span>
          </div>
          <p className="text-2xl font-bold">{summary.errorCalls}</p>
        </div>
      </div>

      {/* ─── 3.5 Admin: Per-User Breakdown Table ─── */}
      {isAdmin && viewMode !== "self" && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Users className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Per-User Consumption
            </h3>
          </div>
          <div className="rounded-xl border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/5 border-b border-border">
                    <th className="text-left px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">User</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">Calls</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">Tokens</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">API Cost</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">Success</th>
                    <th className="text-right px-4 py-3 text-[10px] uppercase font-semibold tracking-wider text-muted">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {(userList && userList.length > 0 ? userList : perUserSummaries.map((u) => ({
                    email: u.email,
                    count: u.summary.totalCalls,
                    totalCostUsd: u.summary.totalCostUsd,
                    totalTokens: u.summary.totalTokens,
                    successCalls: u.summary.successCalls,
                    errorCalls: u.summary.errorCalls,
                  }))).map((u) => {
                    const cost = u.totalCostUsd ?? 0;
                    const tokens = u.totalTokens ?? 0;
                    return (
                      <tr
                        key={u.email}
                        onClick={() => {
                          setSelectedUser(u.email);
                          onViewModeChange(u.email);
                        }}
                        className="border-b border-border/50 hover:bg-muted/5 cursor-pointer transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold uppercase">
                              {u.email[0]}
                            </span>
                            <span className="text-xs truncate max-w-[200px]" title={u.email}>{u.email}</span>
                          </div>
                        </td>
                        <td className="text-right px-4 py-3 font-medium">{u.count}</td>
                        <td className="text-right px-4 py-3 text-muted">{formatTokens(tokens)}</td>
                        <td className="text-right px-4 py-3 text-muted">${cost.toFixed(2)}</td>
                        <td className="text-right px-4 py-3 text-emerald-600">{u.successCalls ?? 0}</td>
                        <td className="text-right px-4 py-3 text-red-500">{u.errorCalls ?? 0}</td>
                      </tr>
                    );
                  })}
                  {/* Totals row */}
                  {((userList && userList.length > 0) || perUserSummaries.length > 0) && (
                    <tr className="bg-muted/10 font-semibold">
                      <td className="px-4 py-3 text-xs uppercase tracking-wider text-muted">Total</td>
                      <td className="text-right px-4 py-3">{summary.totalCalls}</td>
                      <td className="text-right px-4 py-3 text-muted">{formatTokens(summary.totalTokens)}</td>
                      <td className="text-right px-4 py-3">${summary.totalCostUsd.toFixed(2)}</td>
                      <td className="text-right px-4 py-3 text-emerald-600">{summary.successCalls}</td>
                      <td className="text-right px-4 py-3 text-red-500">{summary.errorCalls}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. 7-Day Price Chart ─── */}
      <div className="rounded-xl border border-border bg-background p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-4">
          {tm("usage.costChart", "7-Day Cost")}
        </h3>
        <div className="flex items-end justify-between gap-2 h-40">
          {chartData.map((day) => {
            const pct = maxDayCost > 0 ? (day.cost / maxDayCost) * 100 : 0;
            return (
              <div key={day.key} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted font-medium">
                  ${day.cost.toFixed(2)}
                </span>
                <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                  <div
                    className="w-full max-w-[40px] rounded-t-md bg-accent transition-all duration-300"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                </div>
                <span className="text-[10px] text-muted">{day.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 5. Service Breakdown ─── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          {t("dashboard.byService")}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(["kie", "openai", "fal", "meshy", "blotato"] as const).map((svc) => {
            const data = summary.byService[svc];
            const svcCost = data?.costUsd ?? 0;
            return (
              <div key={svc} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${SERVICE_COLORS[svc]}`} />
                  <span className="text-[10px] uppercase font-semibold tracking-wider text-muted">{svc}</span>
                </div>
                <p className="text-lg font-bold">{data?.calls ?? 0} <span className="text-xs font-normal text-muted">{t("dashboard.calls")}</span></p>
                <p className="text-xs text-muted">${svcCost.toFixed(2)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 6. By-Action Breakdown ─── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          {t("dashboard.byAction")}
        </h3>
        <div className="space-y-2">
          {actionEntries.map(([action, data]) => {
            const pct = maxActionCalls > 0 ? (data.calls / maxActionCalls) * 100 : 0;
            return (
              <div key={action} className="flex items-center gap-3 text-sm">
                <span className="text-xs w-32 shrink-0 truncate">
                  {ACTION_LABELS[action] || action}
                </span>
                <div className="flex-1 h-5 bg-muted/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent/70 rounded-full transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs text-muted shrink-0 w-16 text-right">
                  {data.calls} {t("dashboard.calls")}
                </span>
                <span className="text-xs text-muted shrink-0 w-14 text-right">
                  ${data.costUsd.toFixed(2)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── 7. Activity Log ─── */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
          {t("dashboard.recentCalls")}
        </h3>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {visibleEntries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg hover:bg-muted/5"
            >
              {/* Status dot */}
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  entry.status === "success" ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              {/* Service dot */}
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${SERVICE_COLORS[entry.service] || "bg-gray-400"}`}
              />
              {/* Service name */}
              <span className="uppercase font-medium text-[10px] w-12 shrink-0">
                {entry.service}
              </span>
              {/* Action label */}
              <span className="flex-1 text-muted truncate">
                {ACTION_LABELS[entry.action] || entry.action}
              </span>
              {/* Tokens */}
              {(entry.tokensIn || entry.tokensOut) && (
                <span className="text-purple-500 shrink-0 text-[10px]">
                  {formatTokens((entry.tokensIn ?? 0) + (entry.tokensOut ?? 0))} tk
                </span>
              )}
              {/* Cost */}
              <span className="text-muted shrink-0">${entry.costUsd.toFixed(2)}</span>
              {/* Duration */}
              <span className="text-muted shrink-0">{entry.durationMs}ms</span>
              {/* Relative time */}
              <span className="text-muted shrink-0 w-14 text-right">{timeAgo(entry.timestamp)}</span>
              {/* User email (admin all view only) */}
              {isAdmin && viewMode !== "self" && entry.userEmail && (
                <span className="text-muted shrink-0 w-28 truncate text-right" title={entry.userEmail}>
                  {entry.userEmail}
                </span>
              )}
            </div>
          ))}
        </div>
        {hasMore && (
          <button
            onClick={() => setVisibleCount((c) => c + 30)}
            className="mt-3 w-full py-2 text-xs font-medium text-muted hover:text-foreground rounded-xl border border-border hover:bg-muted/10 transition-colors"
          >
            {tm("usage.loadMore", "Load more")} ({filteredEntries.length - visibleCount} {tm("usage.remaining", "remaining")})
          </button>
        )}
      </div>
    </div>
  );
}
