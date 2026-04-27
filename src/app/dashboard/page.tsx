"use client";

import { useGenerationStore } from "@/lib/stores/generation-store";
import { LayoutDashboard, Trash2 } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useT } from "@/lib/i18n";
import { useAuth } from "@/lib/useAuth";
import { useUsageTracking } from "@/lib/usage";
import UsagePanel from "@/components/UsagePanel";
import ContentHistoryPanel from "@/components/ContentHistoryPanel";

export default function DashboardPage() {
  const history = useGenerationStore((s) => s.history);
  const clearHistory = useGenerationStore((s) => s.clearHistory);
  const t = useT();
  const { user } = useAuth();

  const isAdmin = user?.role === "admin";
  const userEmail = user?.email ?? null;
  const [viewMode, setViewMode] = useState<string>("self");

  // Non-admin users are always locked to "self" view
  const effectiveViewMode = isAdmin ? viewMode : "self";

  const { entries, summary, kvAvailable, logUsage, clearUsage, refreshFromServer, loading } =
    useUsageTracking(userEmail ?? undefined, effectiveViewMode);

  // Fetch user list for admin view
  const [userList, setUserList] = useState<{
    email: string;
    count: number;
    totalCostUsd?: number;
    totalTokens?: number;
    successCalls?: number;
    errorCalls?: number;
  }[]>([]);
  const fetchUserList = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await fetch("/api/usage?scope=list-users");
      if (res.ok) {
        const data = await res.json();
        setUserList(data);
      }
    } catch {}
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) fetchUserList();
  }, [isAdmin, fetchUserList]);

  const handleViewModeChange = (mode: string) => {
    setViewMode(mode);
    if (mode === "all" || mode === "self") {
      // refresh user list when switching to admin view
      if (mode === "all") fetchUserList();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <LayoutDashboard className="w-6 h-6 text-accent" />
        <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
      </div>

      {/* API Usage Panel */}
      <UsagePanel
        entries={entries}
        summary={summary}
        kvAvailable={kvAvailable}
        onClear={clearUsage}
        onRefresh={refreshFromServer}
        userEmail={userEmail}
        isAdmin={isAdmin}
        viewMode={effectiveViewMode}
        onViewModeChange={handleViewModeChange}
        userList={userList}
        loading={loading}
      />

      {/* Content History (with per-item delete + overlay editor) */}
      <div className="mt-6">
        {history.length > 0 && (
          <div className="flex justify-end mb-2">
            <button
              onClick={clearHistory}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-danger rounded-lg hover:bg-danger/10 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              {t("dashboard.clear")}
            </button>
          </div>
        )}
        <ContentHistoryPanel />
      </div>
    </div>
  );
}
