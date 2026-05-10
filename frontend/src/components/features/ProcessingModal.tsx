import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ExternalLink, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { explorerTxUrl } from "@/lib/genlayer";
import type { TxStage } from "@/lib/genlayer";

const STAGES: TxStage[] = ["Pending", "Proposing", "Committing", "Revealing", "Accepted"];

export function ProcessingModal({
  open, stage, elapsed, txHash, onDismiss,
}: {
  open: boolean; stage: TxStage; elapsed: number; txHash?: string; onDismiss: () => void;
}) {
  const idx = STAGES.indexOf(stage);
  return (
    <Dialog open={open}>
      <DialogContent className="max-w-lg border-border/50 bg-background/95 backdrop-blur-xl" >
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-transparent"
              style={{ background: "conic-gradient(from 0deg, transparent, oklch(0.78 0.18 160), oklch(0.65 0.2 265), transparent)", padding: 2, WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude" }}
            />
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <div className="font-display text-lg font-bold uppercase tracking-wider">
            {stage} · <span className="font-mono text-muted-foreground">{elapsed}s elapsed</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">AI validators are reaching consensus…</p>

          <div className="mt-6 w-full">
            <div className="flex justify-between text-[10px] uppercase tracking-widest text-muted-foreground">
              {STAGES.map((s, i) => (
                <span key={s} className={i <= idx ? "text-foreground" : ""}>{s}</span>
              ))}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-card/60">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, oklch(0.78 0.18 160), oklch(0.65 0.2 265))" }}
                animate={{ width: `${((idx + 1) / STAGES.length) * 100}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>

          {txHash && (
            <a href={explorerTxUrl(txHash)} target="_blank" rel="noreferrer"
              className="mt-5 inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline">
              {txHash.slice(0, 10)}…{txHash.slice(-8)} <ExternalLink className="h-3 w-3" />
            </a>
          )}

          <Button variant="ghost" className="mt-4" onClick={onDismiss}>Dismiss & Continue</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}