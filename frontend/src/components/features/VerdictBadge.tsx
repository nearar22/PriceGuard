import type { Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const META: Record<Verdict, { label: string; cls: string; emoji: string }> = {
  GREAT_DEAL: { label: "Great Deal", cls: "bg-deal/15 text-deal ring-deal/40", emoji: "🎉" },
  FAIR_PRICE: { label: "Fair Price", cls: "bg-fair/15 text-fair ring-fair/40", emoji: "✅" },
  OVERPRICED: { label: "Overpriced", cls: "bg-over/15 text-over ring-over/40", emoji: "⚠️" },
  SCAM_ALERT: { label: "Scam Alert", cls: "bg-scam/15 text-scam ring-scam/40", emoji: "🚨" },
  INSUFFICIENT_DATA: {
    label: "Inconclusive",
    cls: "bg-slate-500/15 text-slate-300 ring-slate-500/40",
    emoji: "🔍",
  },
};

export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "lg" }) {
  const m = META[verdict] ?? META.INSUFFICIENT_DATA;
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full font-display font-bold uppercase tracking-wider ring-1",
      size === "lg" ? "px-4 py-1.5 text-sm" : "px-2.5 py-1 text-[10px]",
      m.cls,
    )}>
      <span>{m.emoji}</span>{m.label}
    </span>
  );
}

export function verdictMeta(v: Verdict) { return META[v]; }