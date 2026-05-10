import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ExternalLink, AlertTriangle } from "lucide-react";
import type { PriceCheck } from "@/lib/types";
import { VerdictBadge, verdictMeta } from "./VerdictBadge";
import { motion } from "framer-motion";
import { explorerTxUrl } from "@/lib/genlayer";

export function VerdictModal({
  check, open, onClose, txHash,
}: { check: PriceCheck | null; open: boolean; onClose: () => void; txHash?: string }) {
  if (!check) return null;
  const m = verdictMeta(check.verdict);
  const positive = check.savings_percent > 0;
  // INSUFFICIENT_DATA is the explicit "we couldn't analyze" verdict from the
  // contract (page blocked, search captcha'd, etc.). We also keep the legacy
  // heuristic for older records that pre-date the new verdict.
  const incomplete =
    check.verdict === "INSUFFICIENT_DATA" ||
    ((!check.product_name || /^unknown/i.test(check.product_name)) &&
      !check.listed_price &&
      !check.estimated_fair_price);
  const confidence = typeof check.confidence === "number" ? check.confidence : null;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl border-border/50 bg-background/95 backdrop-blur-xl">
        <div className="flex flex-col items-center text-center">
          <motion.div
            initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 220, damping: 14 }}
            className="text-6xl"
          >{m.emoji}</motion.div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <VerdictBadge verdict={check.verdict} size="lg" />
            {confidence !== null && check.verdict !== "INSUFFICIENT_DATA" && (
              <span
                className={
                  "inline-flex items-center rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider ring-1 " +
                  (confidence >= 75
                    ? "bg-deal/10 text-deal ring-deal/30"
                    : confidence >= 50
                    ? "bg-amber-500/10 text-amber-300 ring-amber-500/30"
                    : "bg-rose-500/10 text-rose-300 ring-rose-500/30")
                }
                title="AI confidence in this verdict (0-100)"
              >
                {confidence}% confidence
              </span>
            )}
          </div>
          <h2 className="mt-4 max-w-md font-display text-xl font-bold">{check.product_name}</h2>
          {check.store_name && <div className="text-xs text-muted-foreground">at {check.store_name}</div>}

          {incomplete ? (
            <div className="mt-6 w-full rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-left">
              <div className="flex items-center gap-2 font-semibold text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Analysis incomplete
              </div>
              <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
                {check.url ? (
                  <>
                    Our AI couldn't extract product details from this page (the site may
                    block scrapers, require login, or use heavy JavaScript). The verdict
                    is on-chain but no reliable price data was captured. Try the{" "}
                    <span className="font-semibold">Manual Check</span> tab with the
                    product name and price you see.
                  </>
                ) : (
                  <>
                    Our AI couldn't find a reliable market baseline for this product. It may be unreleased, too niche, or the name may be ambiguous.
                    The verdict is recorded on-chain. Try a more specific product
                    name (e.g. full model / SKU) and a known store.
                  </>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="mt-6 flex w-full items-end justify-center gap-6">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Listed</div>
                  <div className="font-mono text-4xl font-bold">${check.listed_price.toFixed(2)}</div>
                </div>
                <div className="self-stretch border-l border-border/50" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Fair Price</div>
                  <div className="font-mono text-2xl font-semibold text-muted-foreground">${check.estimated_fair_price.toFixed(2)}</div>
                </div>
              </div>

              {check.savings_percent !== 0 && (
                <div className={`mt-3 inline-flex items-center rounded-full px-3 py-1 font-mono text-sm ${positive ? "bg-deal/15 text-deal" : "bg-scam/15 text-scam"}`}>
                  {positive ? "▼" : "▲"} {Math.abs(check.savings_percent).toFixed(1)}% {positive ? "below" : "above"} market
                </div>
              )}
            </>
          )}

          {check.reasoning && (
            <p className="mt-5 text-sm leading-relaxed text-muted-foreground">{check.reasoning}</p>
          )}

          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            {check.price_factors.map((f) => (
              <span key={f} className="rounded-full border border-border/60 bg-card/50 px-2.5 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">{f}</span>
            ))}
          </div>

          <div className="mt-6 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-deal" />
            Verified on-chain via GenLayer Equivalence Principle
          </div>
          {txHash && (
            <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-primary hover:underline">
              {txHash.slice(0, 10)}…{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <Button onClick={onClose} className="mt-6 w-full">Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}