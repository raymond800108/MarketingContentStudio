"use client";

import { useAutoScheduler } from "@/lib/useAutoScheduler";

/**
 * Mounts the auto-scheduler interval globally.
 * Place this in the root layout so it runs on every page.
 */
export default function SchedulerProvider({ children }: { children: React.ReactNode }) {
  useAutoScheduler();
  return <>{children}</>;
}
