import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";

export interface AgentInsight {
  id: string;
  taskId: string;
  agentName: string;
  insight: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assignee: string;
  labels: string[];
  createdAt: string;
  updatedAt: string;
  dueDate: string;
  storyPoints: number;
}

export const COLUMNS: { key: TaskStatus; label: string; color: string; icon: string }[] = [
  { key: "backlog", label: "Backlog", color: "#9a958e", icon: "📋" },
  { key: "todo", label: "To Do", color: "#6366f1", icon: "📌" },
  { key: "in_progress", label: "In Progress", color: "#f59e0b", icon: "⚡" },
  { key: "review", label: "Review", color: "#8b5cf6", icon: "🔍" },
  { key: "done", label: "Done", color: "#2d8a56", icon: "✅" },
];

interface TaskStore {
  tasks: Task[];
  insights: AgentInsight[];
  searchQuery: string;
  filterPriority: Priority | "all";
  filterLabel: string;

  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  reorderTask: (taskId: string, newStatus: TaskStatus, newIndex: number) => void;

  addInsight: (insight: Omit<AgentInsight, "id" | "createdAt">) => void;
  clearInsights: () => void;

  setSearchQuery: (q: string) => void;
  setFilterPriority: (p: Priority | "all") => void;
  setFilterLabel: (l: string) => void;
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const useTaskStore = create<TaskStore>()(
  persist(
    (set) => ({
      tasks: [],
      insights: [],
      searchQuery: "",
      filterPriority: "all",
      filterLabel: "",

      addTask: (task) =>
        set((s) => ({
          tasks: [
            ...s.tasks,
            {
              ...task,
              id: uid(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        })),

      updateTask: (id, updates) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t
          ),
        })),

      deleteTask: (id) =>
        set((s) => ({
          tasks: s.tasks.filter((t) => t.id !== id),
          insights: s.insights.filter((i) => i.taskId !== id),
        })),

      moveTask: (taskId, newStatus) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId
              ? { ...t, status: newStatus, updatedAt: new Date().toISOString() }
              : t
          ),
        })),

      reorderTask: (taskId, newStatus, newIndex) =>
        set((s) => {
          const tasks = [...s.tasks];
          const taskIndex = tasks.findIndex((t) => t.id === taskId);
          if (taskIndex === -1) return s;
          const [task] = tasks.splice(taskIndex, 1);
          task.status = newStatus;
          task.updatedAt = new Date().toISOString();

          // Find the position among tasks in the target column
          const columnTasks = tasks.filter((t) => t.status === newStatus);
          if (newIndex >= columnTasks.length) {
            // Insert after the last task of this column
            const lastColTask = columnTasks[columnTasks.length - 1];
            const insertAt = lastColTask ? tasks.indexOf(lastColTask) + 1 : tasks.length;
            tasks.splice(insertAt, 0, task);
          } else {
            const targetTask = columnTasks[newIndex];
            const insertAt = tasks.indexOf(targetTask);
            tasks.splice(insertAt, 0, task);
          }
          return { tasks };
        }),

      addInsight: (insight) =>
        set((s) => ({
          insights: [
            { ...insight, id: uid(), createdAt: new Date().toISOString() },
            ...s.insights,
          ].slice(0, 50),
        })),

      clearInsights: () => set({ insights: [] }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),
      setFilterPriority: (filterPriority) => set({ filterPriority }),
      setFilterLabel: (filterLabel) => set({ filterLabel }),
    }),
    { name: "task-board-storage" }
  )
);
