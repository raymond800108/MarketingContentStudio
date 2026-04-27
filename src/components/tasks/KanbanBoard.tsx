"use client";

import { useState, useRef, useCallback } from "react";
import { useTaskStore, Task, TaskStatus, COLUMNS } from "@/lib/stores/task-store";
import TaskCard from "./TaskCard";
import TaskModal from "./TaskModal";
import { Plus, Search, Filter } from "lucide-react";
import { useT, type TranslationKey } from "@/lib/i18n";

const COL_LABEL_KEYS: Record<string, TranslationKey> = {
  backlog: "tasks.col.backlog",
  todo: "tasks.col.todo",
  in_progress: "tasks.col.inProgress",
  review: "tasks.col.review",
  done: "tasks.col.done",
};

export default function KanbanBoard() {
  const { tasks, searchQuery, filterPriority, setSearchQuery, setFilterPriority, moveTask } =
    useTaskStore();
  const t = useT();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<TaskStatus>("todo");
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number>(-1);
  const dragTaskRef = useRef<Task | null>(null);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (
        !t.title.toLowerCase().includes(q) &&
        !t.description.toLowerCase().includes(q) &&
        !t.labels.some((l) => l.includes(q)) &&
        !t.assignee.toLowerCase().includes(q)
      )
        return false;
    }
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    return true;
  });

  const getColumnTasks = useCallback(
    (status: TaskStatus) => filteredTasks.filter((t) => t.status === status),
    [filteredTasks]
  );

  const handleDragStart = (e: React.DragEvent, task: Task) => {
    dragTaskRef.current = task;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    // Add dragging class after a tick
    requestAnimationFrame(() => {
      (e.target as HTMLElement).classList.add("dragging-card");
    });
  };

  const handleDragOver = (e: React.DragEvent, status: TaskStatus, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverColumn(status);
    setDragOverIndex(index);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const { clientX, clientY } = e;
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      setDragOverColumn(null);
      setDragOverIndex(-1);
    }
  };

  const handleDrop = (e: React.DragEvent, status: TaskStatus) => {
    e.preventDefault();
    const task = dragTaskRef.current;
    if (task) {
      moveTask(task.id, status);
    }
    dragTaskRef.current = null;
    setDragOverColumn(null);
    setDragOverIndex(-1);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("dragging-card");
    dragTaskRef.current = null;
    setDragOverColumn(null);
    setDragOverIndex(-1);
  };

  const openCreateModal = (status: TaskStatus) => {
    setEditingTask(null);
    setDefaultStatus(status);
    setModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border bg-white/60 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("tasks.search")}
            className="w-full pl-9 pr-3 py-2 text-sm bg-card rounded-xl border border-border outline-none focus:border-accent/40 transition-colors"
          />
        </div>

        {/* Priority filter */}
        <div className="relative flex items-center gap-1.5">
          <Filter size={14} className="text-muted" />
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as typeof filterPriority)}
            className="text-sm bg-card rounded-xl border border-border px-3 py-2 outline-none focus:border-accent/40 appearance-none pr-8"
          >
            <option value="all">{t("tasks.allPriorities")}</option>
            <option value="urgent">🔥 {t("tasks.priority.urgent")}</option>
            <option value="high">⚠️ {t("tasks.priority.high")}</option>
            <option value="medium">🔵 {t("tasks.priority.medium")}</option>
            <option value="low">⬇️ {t("tasks.priority.low")}</option>
          </select>
        </div>

        {/* Quick create */}
        <button
          onClick={() => openCreateModal("todo")}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white text-sm font-semibold
            hover:bg-accent-light transition-colors shadow-lg shadow-accent/20"
        >
          <Plus size={16} />
          {t("tasks.newTask")}
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-6 h-full min-w-max">
          {COLUMNS.map((col) => {
            const columnTasks = getColumnTasks(col.key);
            const isOver = dragOverColumn === col.key;

            return (
              <div
                key={col.key}
                className={`flex flex-col w-72 rounded-2xl transition-all duration-200 ${
                  isOver
                    ? "bg-accent/5 ring-2 ring-accent/20"
                    : "bg-card-hover/50"
                }`}
                onDragOver={(e) => handleDragOver(e, col.key, columnTasks.length)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.key)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{col.icon}</span>
                    <h3 className="text-sm font-bold text-foreground">{COL_LABEL_KEYS[col.key] ? t(COL_LABEL_KEYS[col.key]) : col.label}</h3>
                    <span
                      className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[10px] font-bold text-white"
                      style={{ background: col.color }}
                    >
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => openCreateModal(col.key)}
                    className="p-1 rounded-lg text-muted hover:text-accent hover:bg-accent/10 transition-colors"
                  >
                    <Plus size={16} />
                  </button>
                </div>

                {/* Task list */}
                <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2.5 kanban-scroll">
                  {columnTasks.map((task, index) => (
                    <div
                      key={task.id}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDragOver(e, col.key, index);
                      }}
                    >
                      {isOver && dragOverIndex === index && (
                        <div className="h-1 rounded-full bg-accent/40 mb-2 mx-2 transition-all" />
                      )}
                      <TaskCard
                        task={task}
                        onEdit={openEditModal}
                        onDragStart={handleDragStart}
                      />
                    </div>
                  ))}

                  {/* Drop indicator at end */}
                  {isOver && dragOverIndex >= columnTasks.length && (
                    <div className="h-1 rounded-full bg-accent/40 mx-2 transition-all" />
                  )}

                  {/* Empty state */}
                  {columnTasks.length === 0 && !isOver && (
                    <div className="flex flex-col items-center justify-center py-8 text-muted/40">
                      <p className="text-xs font-medium">{t("tasks.noTasks")}</p>
                      <button
                        onClick={() => openCreateModal(col.key)}
                        className="mt-2 text-[11px] text-accent/60 hover:text-accent transition-colors"
                      >
                        {t("tasks.addTask")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Modal */}
      <TaskModal
        task={editingTask}
        isOpen={modalOpen}
        defaultStatus={defaultStatus}
        onClose={() => {
          setModalOpen(false);
          setEditingTask(null);
        }}
      />
    </div>
  );
}
