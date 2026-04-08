"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface BlotatoAccount {
  id: string;
  platform: string;
  fullname: string;
  username: string;
}

interface BlotatoStore {
  apiKey: string;
  connected: boolean;
  accounts: BlotatoAccount[];

  setApiKey: (key: string) => void;
  setConnected: (connected: boolean) => void;
  setAccounts: (accounts: BlotatoAccount[]) => void;
  disconnect: () => void;
}

export const useBlotatoStore = create<BlotatoStore>()(
  persist(
    (set) => ({
      apiKey: "",
      connected: false,
      accounts: [],

      setApiKey: (apiKey) => set({ apiKey }),
      setConnected: (connected) => set({ connected }),
      setAccounts: (accounts) => set({ accounts }),
      disconnect: () => set({ apiKey: "", connected: false, accounts: [] }),
    }),
    {
      name: "studio-blotato",
    }
  )
);
