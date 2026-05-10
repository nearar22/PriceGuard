import { create } from "zustand";
import type { PriceCheck, Stats } from "@/lib/types";
import { getRecentChecks, getStats } from "@/lib/genlayer";

interface AppState {
  stats: Stats | null;
  checks: PriceCheck[];
  loading: boolean;
  liveMode: boolean;
  setLiveMode: (v: boolean) => void;
  refresh: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  stats: null,
  checks: [],
  loading: true,
  liveMode: false,
  setLiveMode: (v) => set({ liveMode: v }),
  refresh: async () => {
    // Only flash the loading skeleton on the very first refresh. Once we have
    // data, subsequent polling refreshes update silently so the registry
    // doesn't flicker every 5s while a recent submission's tx is finalising.
    set((s) => (s.stats === null ? { loading: true } : {}));
    const [stats, checks] = await Promise.all([getStats(), getRecentChecks(20)]);
    set({ stats, checks, loading: false });
  },
}));