"use client";

import { Task, Priority } from "@/lib/stores/task-store";
import { Clock, GripVertical, Flame, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

const priorityConfig: Record<Priority, { icon: typeof Flame; color: string; bg: string; labelKey: TranslationKey }> = {
  urgent: { icon: Flame, color: "#ef4444", bg: "rgba(239,68,68,0.1)", labelKey: "tasks.priority.urgent" },
  high: { icon: AlertTriangle, color: "#f59e0b", bg: "rgba(245,158,11,0.1)", labelKey: "tasks.priority.high" },
  medium: { icon: ArrowUp, color: "#6366f1", bg: "rgba(99,102,241,0.1)", labelKey: "tasks.priority.medium" },
  low: { icon: ArrowDown, color: "#9a958e", bg: "rgba(154,149,142,0.1)", labelKey: "tasks.priority.low" },
};

interface TaskCardProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
}

export default function TaskCard({ task, onEdit, onDragStart }: TaskCardProps) {
  const t = useT();
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onClick={() => onEdit(task)}
      className="group relative bg-white rounded-xl border border-border p-4 cursor-grab active:cursor-grabbing
        hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 transition-all duration-200
        active:scale-[0.97] select-none"
      style={{ touchAction: "none" }}
    >
      {/* Drag handle */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-40 transition-opacity">
        <GripVertical size={14} />
      </div>

      {/* Labels */}
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {task.labels.map((label) => (
            <span
              key={label}
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-full"
              style={{
                background: `hsl(${hashCode(label) % 360}, 70%, 95%)`,
                color: `hsl(${hashCode(label) % 360}, 60%, 40%)`,
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {/* Title */}
      <h4 className="text-sm font-semibold text-foreground leading-snug mb-2 pr-6">
        {task.title}
      </h4>

      {/* Description preview */}
      {task.description && (
        <p className="text-xs text-muted leading-relaxed mb-3 line-clamp-2">
          {task.description}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-2">
          {/* Priority badge */}
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ background: priority.bg, color: priority.color }}
          >
            <PriorityIcon size={10} />
            {t(priority.labelKey)}
          </span>

          {/* Story points */}
          {task.storyPoints > 0 && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-accent/10 text-accent text-[10px] font-bold">
              {task.storyPoints}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Due date */}
          {task.dueDate && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-medium ${
                isOverdue ? "text-danger" : "text-muted"
              }`}
            >
              <Clock size={10} />
              {formatDate(task.dueDate, t)}
            </span>
          )}

          {/* Assignee avatar */}
          {task.assignee && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
              style={{ background: `hsl(${hashCode(task.assignee) % 360}, 55%, 55%)` }}
              title={task.assignee}
            >
              {task.assignee.charAt(0).toUpperCase()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function formatDate(dateStr: string, t: (key: TranslationKey) => string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return t("tasks.date.today");
  if (days === 1) return t("tasks.date.tomorrow");
  if (days === -1) return t("tasks.date.yesterday");
  if (days < -1) return `${Math.abs(days)}d ago`;
  if (days <= 7) return `${days}d`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
