"use client";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  // Auth disabled — pass through all children
  return <>{children}</>;
}
