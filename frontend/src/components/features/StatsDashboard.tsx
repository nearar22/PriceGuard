import { CheckCircle2, TrendingDown, AlertTriangle, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Skeleton } from "@/components/ui/skeleton";

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now(); const from = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return v;
}

function Sparkline({ color }: { color: string }) {
  const pts = Array.from({ length: 16 }, () => 10 + Math.random() * 30);
  const max = Math.max(...pts);
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 100} ${40 - (p / max) * 35}`).join(" ");
  return (
    <svg viewBox="0 0 100 40" className="h-10 w-full opacity-80" preserveAspectRatio="none">
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ icon: Icon, label, value, suffix, color, delay }: any) {
  const n = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
      transition={{ delay }}
      className="glass relative overflow-hidden rounded-2xl p-5"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: `${color}22`, color }}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 font-mono text-3xl font-bold tabular-nums">
        {n.toLocaleString()}{suffix ?? ""}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      <div className="mt-3"><Sparkline color={color} /></div>
    </motion.div>
  );
}

export function StatsDashboard() {
  const { stats, loading } = useAppStore();
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard icon={CheckCircle2} label="Total Checks" value={stats.total_checks} color="oklch(0.65 0.2 265)" delay={0} />
      <StatCard icon={TrendingDown} label="Great Deals Found" value={stats.total_great_deals} color="oklch(0.78 0.18 160)" delay={0.05} />
      <StatCard icon={AlertTriangle} label="Scams Caught" value={stats.total_scams} color="oklch(0.65 0.24 25)" delay={0.1} />
      <StatCard icon={BarChart3} label="Scam Rate" value={Math.round(stats.scam_rate)} suffix="%" color="oklch(0.82 0.16 85)" delay={0.15} />
    </div>
  );
}