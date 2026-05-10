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
    set({ loading: true });
    const [stats, checks] = await Promise.all([getStats(), getRecentChecks(20)]);
    set({ stats, checks, loading: false });
  },
}));