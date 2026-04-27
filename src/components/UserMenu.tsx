"use client";

import { useState } from "react";
import { LogOut, Zap, ChevronDown, User } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { PLAN_CREDITS } from "@/lib/credits";

export default function UserMenu() {
  const { user, loading, openLogin, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return <div className="w-8 h-8 rounded-full bg-muted/20 animate-pulse" />;
  }

  if (!user) {
    return (
      <button
        onClick={openLogin}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary-hover transition-colors whitespace-nowrap"
      >
        <User className="w-3.5 h-3.5" />
        Sign In
      </button>
    );
  }

  const planMax = PLAN_CREDITS[user.plan] || 15;

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-card-hover transition-colors"
      >
        {user.avatar ? (
          <img src={user.avatar} alt="" className="w-7 h-7 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
            {user.name?.[0]?.toUpperCase() || "?"}
          </div>
        )}
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-accent/10 text-accent text-xs font-medium">
          <Zap className="w-3 h-3" />
          {user.credits}
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-muted" />
      </button>

      {menuOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-border bg-card shadow-lg z-50 py-2">
            <div className="px-4 py-2 border-b border-border">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-[11px] text-muted truncate">{user.email}</p>
            </div>
            <div className="px-4 py-2 border-b border-border">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted uppercase font-semibold">{user.plan} plan</span>
                <span className="text-accent font-medium">{user.credits} / {planMax} credits</span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-muted/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.min(100, (user.credits / planMax) * 100)}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => { setMenuOpen(false); logout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-muted hover:text-danger hover:bg-danger/5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
