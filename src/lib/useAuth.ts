"use client";

import { useState, useEffect, useCallback, useMemo, createContext, useContext } from "react";

export type UserRole = "admin" | "member";

export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  provider: "google";
  role: UserRole;
  plan: "free" | "starter" | "pro" | "business";
  credits: number;
  blotatoAccountId?: string | null;
  blotatoAccountLabel?: string | null;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  ready: boolean;
}

interface AuthContextValue extends AuthState {
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  openLogin: () => void;
  closeLogin: () => void;
  loginOpen: boolean;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  ready: false,
  refresh: async () => {},
  logout: async () => {},
  openLogin: () => {},
  closeLogin: () => {},
  loginOpen: false,
});

export const useAuth = () => useContext(AuthContext);

export function useAuthState(): AuthContextValue {
  const [state, setState] = useState<AuthState>({ user: null, loading: true, ready: false });
  const [loginOpen, setLoginOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true }));
      const res = await fetch("/api/auth/me");
      const data = await res.json();
      setState({ user: data.user ?? null, loading: false, ready: true });
    } catch {
      setState({ user: null, loading: false, ready: true });
    }
  }, []);

  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
    setState({ user: null, loading: false, ready: true });
    setLoginOpen(false);
  }, []);

  const openLogin = useCallback(() => setLoginOpen(true), []);
  const closeLogin = useCallback(() => setLoginOpen(false), []);

  useEffect(() => { refresh(); }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({ user: state.user, loading: state.loading, ready: state.ready, refresh, logout, openLogin, closeLogin, loginOpen }),
    [state.user, state.loading, state.ready, refresh, logout, openLogin, closeLogin, loginOpen]
  );

  return value;
}
