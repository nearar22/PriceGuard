import { useMemo, useState } from "react";
import { ExternalLink, ChevronDown, Inbox } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "@/stores/app-store";
import type { Verdict } from "@/lib/types";
import { VerdictBadge } from "./VerdictBadge";
import { truncateAddr } from "@/lib/genlayer";
import { Skeleton } from "@/components/ui/skeleton";

const FILTERS: { id: "all" | Verdict; label: string }[] = [
  { id: "all", label: "All" },
  { id: "GREAT_DEAL", label: "Great Deals" },
  { id: "FAIR_PRICE", label: "Fair" },
  { id: "OVERPRICED", label: "Overpriced" },
  { id: "SCAM_ALERT", label: "Scams" },
  { id: "INSUFFICIENT_DATA", label: "Inconclusive" },
];

function isIncomplete(c: { verdict: Verdict; product_name?: string; listed_price?: number; estimated_fair_price?: number }): boolean {
  if (c.verdict === "INSUFFICIENT_DATA") return true;
  // Legacy heuristic for records written before INSUFFICIENT_DATA existed.
  return (
    (!c.product_name || /^unknown/i.test(c.product_name)) &&
    !c.listed_price &&
    !c.estimated_fair_price
  );
}

function timeAgo(ts?: number) {
  if (!ts) return "just now";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function Registry() {
  const { checks, loading } = useAppStore();
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const filtered = useMemo(
    () => checks.filter((c) => filter === "all" || c.verdict === filter),
    [checks, filter],
  );

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-bold">On-Chain Registry</h2>
          <p className="text-sm text-muted-foreground">Every verdict, permanently recorded.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                filter === f.id
                  ? "bg-primary text-primary-foreground"
                  : "border border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass flex flex-col items-center justify-center rounded-2xl py-16 text-center">
          <Inbox className="h-10 w-10 text-muted-foreground/60" />
          <div className="mt-3 font-display text-lg font-bold">No price checks yet</div>
          <p className="mt-1 text-sm text-muted-foreground">Be the first to verify a price on-chain.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((c) => {
              const isExp = expanded[c.id];
              const positive = c.savings_percent > 0;
              const incomplete = isIncomplete(c);
              const confidence = typeof c.confidence === "number" ? c.confidence : null;
              return (
                <motion.div
                  key={c.id}
                  layout
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="glass rounded-2xl p-4 sm:p-5"
                >
                  <div className="flex items-start gap-4">
                    <div className="shrink-0 flex flex-col items-start gap-1">
                      <VerdictBadge verdict={c.verdict} />
                      {confidence !== null && !incomplete && (
                        <span
                          className={
                            "font-mono text-[9px] uppercase tracking-wider " +
                            (confidence >= 75 ? "text-deal" : confidence >= 50 ? "text-amber-300" : "text-rose-300")
                          }
                          title="AI confidence (0-100)"
                        >
                          {confidence}% conf.
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                        <div className="min-w-0">
                          <div className="truncate font-display font-bold">{c.product_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {c.store_name ?? "Unknown store"} · <span className="capitalize">{c.category}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          {incomplete ? (
                            <div className="text-[11px] uppercase tracking-widest text-slate-400">Inconclusive</div>
                          ) : (
                            <>
                              <div className={`font-mono text-xl font-bold ${
                                c.verdict === "GREAT_DEAL" ? "text-deal" :
                                c.verdict === "SCAM_ALERT" ? "text-scam" :
                                c.verdict === "OVERPRICED" ? "text-over" : "text-fair"
                              }`}>${c.listed_price.toFixed(2)}</div>
                              <div className="text-[11px] text-muted-foreground">fair: ${c.estimated_fair_price.toFixed(2)}</div>
                            </>
                          )}
                        </div>
                      </div>

                      {!incomplete && c.savings_percent !== 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[11px] ${positive ? "bg-deal/10 text-deal" : "bg-scam/10 text-scam"}`}>
                            {positive ? "▼" : "▲"} {Math.abs(c.savings_percent).toFixed(1)}%
                          </span>
                        </div>
                      )}

                      <p className={`mt-2 text-sm ${incomplete ? "text-slate-400/90" : "text-muted-foreground"} ${isExp ? "" : "line-clamp-2"}`}>
                        {c.reasoning ||
                          (incomplete
                            ? "AI couldn't determine product or price (page blocked or no useful search results). Try the Manual Check tab."
                            : "")}
                      </p>
                      <button
                        onClick={() => setExpanded((s) => ({ ...s, [c.id]: !s[c.id] }))}
                        className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        {isExp ? "Show less" : "Show more"}
                        <ChevronDown className={`h-3 w-3 transition ${isExp ? "rotate-180" : ""}`} />
                      </button>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {c.price_factors.map((f) => (
                          <span key={f} className="rounded-full border border-border/60 bg-card/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{f}</span>
                        ))}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
                        <span className="font-mono">{truncateAddr(c.submitter)} · {timeAgo(c.timestamp)}</span>
                        {c.url && (
                          <a href={c.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary">
                            View listing <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}