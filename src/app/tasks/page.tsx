"use client";

import { useState } from "react";
import KanbanBoard from "@/components/tasks/KanbanBoard";
import AgentInsights from "@/components/tasks/AgentInsights";
import { useTaskStore } from "@/lib/stores/task-store";
import { LayoutDashboard, BarChart3, Clock, CheckCircle2, Zap } from "lucide-react";
import { useT } from "@/lib/i18n";

export default function TasksPage() {
  const { tasks } = useTaskStore();
  const [view] = useState<"board">("board");
  const t = useT();

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const inProgress = tasks.filter((t) => t.status === "in_progress").length;
  const urgentTasks = tasks.filter((t) => t.priority === "urgent" && t.status !== "done").length;

  const stats = [
    { icon: LayoutDashboard, label: t("tasks.total"), value: totalTasks, color: "#6366f1" },
    { icon: Zap, label: t("tasks.inProgress"), value: inProgress, color: "#f59e0b" },
    { icon: CheckCircle2, label: t("tasks.done"), value: doneTasks, color: "#2d8a56" },
    { icon: Clock, label: t("tasks.urgent"), value: urgentTasks, color: "#ef4444" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Stats bar */}
      <div className="flex items-center gap-4 px-6 pt-5 pb-2">
        <div className="flex-1">
          <h1 className="text-xl font-bold text-foreground tracking-tight">{t("tasks.title")}</h1>
          <p className="text-xs text-muted mt-0.5">{t("tasks.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-border"
            >
              <stat.icon size={14} style={{ color: stat.color }} />
              <div>
                <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {totalTasks > 0 && (
        <div className="px-6 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-success transition-all duration-500"
                style={{ width: `${(doneTasks / totalTasks) * 100}%` }}
              />
            </div>
            <span className="text-[11px] font-semibold text-muted">
              {totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0}% {t("tasks.complete")}
            </span>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex-1 overflow-hidden">
        {view === "board" && <KanbanBoard />}
      </div>

      {/* Agent Insights */}
      <AgentInsights />
    </div>
  );
}
