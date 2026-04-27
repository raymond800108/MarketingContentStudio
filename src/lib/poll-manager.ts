/**
 * Global poll manager — lives outside React component lifecycle.
 *
 * setInterval callbacks inside React components die when the component
 * unmounts (i.e. when the user navigates to another page). This singleton
 * keeps polling alive across page transitions so in-flight generation tasks
 * always complete and write their results back to Zustand stores.
 *
 * Usage:
 *   import { pollManager } from "@/lib/poll-manager";
 *   pollManager.start({ taskId, type, ... });
 *
 * On mount, each page calls `pollManager.resumeUgc()` or similar to
 * re-attach UI-level effects (e.g. step transitions) without restarting
 * the underlying poll.
 */

export interface PollCallbacks {
  onSuccess: (data: Record<string, unknown>) => void;
  onError: (error: string) => void;
}

interface ActivePoll {
  taskId: string;
  type: "image" | "video";
  intervalHandle: ReturnType<typeof setInterval>;
  startTime: number;
  budgetMs: number;
  callbacks: PollCallbacks;
}

class PollManager {
  private polls = new Map<string, ActivePoll>();

  /** Start polling a Kie task. If already polling this taskId, no-op. */
  start(config: {
    taskId: string;
    type: "image" | "video";
    intervalMs?: number;
    budgetMs?: number;
    callbacks: PollCallbacks;
  }) {
    const { taskId, type, intervalMs = 3000, budgetMs = 5 * 60 * 1000, callbacks } = config;

    // Already tracking this task — just update callbacks (for re-mount)
    if (this.polls.has(taskId)) {
      const existing = this.polls.get(taskId)!;
      existing.callbacks = callbacks;
      return;
    }

    const startTime = Date.now();

    const intervalHandle = setInterval(async () => {
      const poll = this.polls.get(taskId);
      if (!poll) return;

      // Timeout
      if (Date.now() - poll.startTime > poll.budgetMs) {
        this.stop(taskId);
        poll.callbacks.onError("timeout");
        return;
      }

      try {
        const r = await fetch(`/api/kie?taskId=${taskId}&type=${type}`);
        const d = await r.json();

        if (d.status === "success") {
          this.stop(taskId);
          poll.callbacks.onSuccess(d);
        } else if (d.status === "fail") {
          this.stop(taskId);
          poll.callbacks.onError(d.error || "Generation failed");
        }
        // else: still pending/processing — keep polling
      } catch {
        // Network blip — let it retry until budget expires
      }
    }, intervalMs);

    this.polls.set(taskId, { taskId, type, intervalHandle, startTime, budgetMs, callbacks });
  }

  /** Stop polling a task. */
  stop(taskId: string) {
    const poll = this.polls.get(taskId);
    if (poll) {
      clearInterval(poll.intervalHandle);
      this.polls.delete(taskId);
    }
  }

  /** Update callbacks for a task (e.g. when component re-mounts). */
  updateCallbacks(taskId: string, callbacks: PollCallbacks) {
    const poll = this.polls.get(taskId);
    if (poll) poll.callbacks = callbacks;
  }

  /** Check if a task is currently being polled. */
  isPolling(taskId: string): boolean {
    return this.polls.has(taskId);
  }

  /** Stop all active polls. */
  stopAll() {
    for (const [id] of this.polls) this.stop(id);
  }
}

/** Singleton — import this everywhere. */
export const pollManager = new PollManager();
