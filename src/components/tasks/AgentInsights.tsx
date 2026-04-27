"use client";

import { useState } from "react";
import { useTaskStore } from "@/lib/stores/task-store";
import {
  Lightbulb,
  ChevronDown,
  ChevronUp,
  Trash2,
  Bot,
  Sparkles,
  PlusCircle,
} from "lucide-react";
import { useT } from "@/lib/i18n";

export default function AgentInsights() {
  const { insights, tasks, addInsight, clearInsights } = useTaskStore();
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [agentName, setAgentName] = useState("");
  const [insightText, setInsightText] = useState("");
  const [taskId, setTaskId] = useState("");

  const handleAdd = () => {
    if (!agentName.trim() || !insightText.trim()) return;
    addInsight({ agentName: agentName.trim(), insight: insightText.trim(), taskId: taskId || "" });
    setAgentName("");
    setInsightText("");
    setTaskId("");
    setShowAddForm(false);
  };

  return (
    <div className="border-t border-border bg-gradient-to-b from-white to-card-hover/30">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-3 hover:bg-card-hover/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-50">
            <Lightbulb size={14} className="text-amber-500" />
          </div>
          <span className="text-sm font-bold text-foreground">{t("tasks.insights.title")}</span>
          {insights.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              {insights.length}
            </span>
          )}
        </div>
        {expanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />}
      </button>

      {expanded && (
        <div className="px-6 pb-4">
          {/* Actions */}
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <PlusCircle size={12} />
              {t("tasks.insights.add")}
            </button>
            {insights.length > 0 && (
              <button
                onClick={clearInsights}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  text-muted hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 size={12} />
                {t("tasks.insights.clearAll")}
              </button>
            )}
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="mb-4 p-4 rounded-xl bg-card border border-border space-y-3 animate-modal-in">
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder={t("tasks.insights.agentPlaceholder")}
                  className="text-sm bg-card-hover rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
                />
                <select
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                  className="text-sm bg-card-hover rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
                >
                  <option value="">{t("tasks.insights.noLinked")}</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title.slice(0, 40)}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                value={insightText}
                onChange={(e) => setInsightText(e.target.value)}
                placeholder={t("tasks.insights.writePlaceholder")}
                rows={2}
                className="w-full text-sm bg-card-hover rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40 resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted hover:text-foreground transition-colors"
                >
                  {t("tasks.modal.cancel")}
                </button>
                <button
                  onClick={handleAdd}
                  disabled={!agentName.trim() || !insightText.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white
                    hover:bg-accent-light transition-colors disabled:opacity-40"
                >
                  {t("tasks.insights.save")}
                </button>
              </div>
            </div>
          )}

          {/* Insights list */}
          {insights.length === 0 ? (
            <div className="flex flex-col items-center py-6 text-muted/40">
              <Sparkles size={24} className="mb-2" />
              <p className="text-xs">{t("tasks.insights.empty")}</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto kanban-scroll">
              {insights.map((insight) => {
                const linkedTask = tasks.find((t) => t.id === insight.taskId);
                return (
                  <div
                    key={insight.id}
                    className="flex gap-3 p-3 rounded-xl bg-card border border-border hover:border-amber-200 transition-colors"
                  >
                    <div className="p-1.5 rounded-lg bg-accent/10 h-fit">
                      <Bot size={14} className="text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-foreground">{insight.agentName}</span>
                        {linkedTask && (
                          <span className="text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded truncate max-w-[120px]">
                            {linkedTask.title}
                          </span>
                        )}
                        <span className="text-[10px] text-muted ml-auto flex-shrink-0">
                          {new Date(insight.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-muted leading-relaxed">{insight.insight}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
