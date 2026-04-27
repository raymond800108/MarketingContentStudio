"use client";

import { useState, useEffect } from "react";
import { Task, Priority, TaskStatus, COLUMNS, useTaskStore } from "@/lib/stores/task-store";
import { X, Trash2, Plus } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

interface TaskModalProps {
  task: Task | null;
  isOpen: boolean;
  defaultStatus?: TaskStatus;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: Priority; emoji: string; labelKey: TranslationKey }[] = [
  { value: "urgent", emoji: "🔥", labelKey: "tasks.priority.urgent" },
  { value: "high", emoji: "⚠️", labelKey: "tasks.priority.high" },
  { value: "medium", emoji: "🔵", labelKey: "tasks.priority.medium" },
  { value: "low", emoji: "⬇️", labelKey: "tasks.priority.low" },
];

const SUGGESTED_LABELS = ["frontend", "backend", "bug", "feature", "refactor", "docs", "design", "agent", "devops", "testing"];

export default function TaskModal({ task, isOpen, defaultStatus, onClose }: TaskModalProps) {
  const { addTask, updateTask, deleteTask } = useTaskStore();
  const t = useT();
  const isEditing = !!task;

  const COL_LABEL_KEYS: Record<string, TranslationKey> = {
    backlog: "tasks.col.backlog",
    todo: "tasks.col.todo",
    in_progress: "tasks.col.inProgress",
    review: "tasks.col.review",
    done: "tasks.col.done",
  };

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus || "todo");
  const [priority, setPriority] = useState<Priority>("medium");
  const [assignee, setAssignee] = useState("");
  const [labels, setLabels] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [storyPoints, setStoryPoints] = useState(0);
  const [labelInput, setLabelInput] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description);
      setStatus(task.status);
      setPriority(task.priority);
      setAssignee(task.assignee);
      setLabels([...task.labels]);
      setDueDate(task.dueDate);
      setStoryPoints(task.storyPoints);
    } else {
      setTitle("");
      setDescription("");
      setStatus(defaultStatus || "todo");
      setPriority("medium");
      setAssignee("");
      setLabels([]);
      setDueDate("");
      setStoryPoints(0);
    }
    setLabelInput("");
  }, [task, isOpen, defaultStatus]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    if (isEditing) {
      updateTask(task.id, { title, description, status, priority, assignee, labels, dueDate, storyPoints });
    } else {
      addTask({ title, description, status, priority, assignee, labels, dueDate, storyPoints });
    }
    onClose();
  };

  const handleDelete = () => {
    if (task && confirm(t("tasks.modal.deleteConfirm"))) {
      deleteTask(task.id);
      onClose();
    }
  };

  const addLabel = (label: string) => {
    const l = label.trim().toLowerCase();
    if (l && !labels.includes(l)) {
      setLabels([...labels, l]);
    }
    setLabelInput("");
  };

  const removeLabel = (label: string) => setLabels(labels.filter((l) => l !== label));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-border overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-accent/5 to-transparent">
          <h2 className="text-lg font-bold text-foreground">
            {isEditing ? t("tasks.modal.edit") : t("tasks.modal.create")}
          </h2>
          <div className="flex items-center gap-2">
            {isEditing && (
              <button
                onClick={handleDelete}
                className="p-2 rounded-lg text-danger/60 hover:text-danger hover:bg-danger/10 transition-colors"
              >
                <Trash2 size={16} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted hover:text-foreground hover:bg-card-hover transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("tasks.modal.titlePlaceholder")}
              className="w-full text-lg font-semibold bg-transparent border-none outline-none placeholder:text-muted/50"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("tasks.modal.descPlaceholder")}
              rows={3}
              className="w-full text-sm bg-card rounded-xl border border-border p-3 outline-none focus:border-accent/40 transition-colors resize-none placeholder:text-muted/50"
            />
          </div>

          {/* Status + Priority row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("tasks.modal.status")}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-sm bg-card rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
              >
                {COLUMNS.map((col) => (
                  <option key={col.key} value={col.key}>
                    {col.icon} {COL_LABEL_KEYS[col.key] ? t(COL_LABEL_KEYS[col.key]) : col.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("tasks.modal.priority")}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-sm bg-card rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.emoji} {t(p.labelKey)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee + Due Date + Points */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("tasks.modal.assignee")}
              </label>
              <input
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder={t("tasks.modal.assigneePlaceholder")}
                className="w-full text-sm bg-card rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("tasks.modal.dueDate")}
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-sm bg-card rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
                {t("tasks.modal.points")}
              </label>
              <input
                type="number"
                min={0}
                max={21}
                value={storyPoints}
                onChange={(e) => setStoryPoints(Number(e.target.value))}
                className="w-full text-sm bg-card rounded-lg border border-border px-3 py-2 outline-none focus:border-accent/40"
              />
            </div>
          </div>

          {/* Labels */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">
              {t("tasks.modal.labels")}
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {labels.map((label) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-accent/10 text-accent cursor-pointer hover:bg-danger/10 hover:text-danger transition-colors"
                  onClick={() => removeLabel(label)}
                >
                  {label} <X size={10} />
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLabel(labelInput);
                  }
                }}
                placeholder={t("tasks.modal.addLabel")}
                className="flex-1 text-sm bg-card rounded-lg border border-border px-3 py-1.5 outline-none focus:border-accent/40"
              />
              <button
                type="button"
                onClick={() => addLabel(labelInput)}
                className="p-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
            {/* Suggested labels */}
            <div className="flex flex-wrap gap-1 mt-2">
              {SUGGESTED_LABELS.filter((l) => !labels.includes(l)).map((label) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => addLabel(label)}
                  className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-card-hover text-muted hover:text-foreground hover:bg-border transition-colors"
                >
                  + {label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-accent text-white font-semibold text-sm
                hover:bg-accent-light transition-colors disabled:opacity-40 disabled:cursor-not-allowed
                shadow-lg shadow-accent/20"
            >
              {isEditing ? t("tasks.modal.save") : t("tasks.modal.createBtn")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
