import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { Toaster, toast } from "sonner";
import { Header } from "@/components/features/Header";
import { Hero } from "@/components/features/Hero";
import { StatsDashboard } from "@/components/features/StatsDashboard";
import { PriceCheckInput, type SubmitPayload } from "@/components/features/PriceCheckInput";
import { ProcessingModal } from "@/components/features/ProcessingModal";
import { VerdictModal } from "@/components/features/VerdictModal";
import { ErrorModal } from "@/components/features/ErrorModal";
import { Registry } from "@/components/features/Registry";
import { useAppStore } from "@/stores/app-store";
import { submitPriceCheck, setActiveWalletAddress, type TxStage } from "@/lib/genlayer";
import { useWalletStore, tryAutoReconnect } from "@/lib/wallet";
import type { PriceCheck } from "@/lib/types";

export default function App() {
  const refresh = useAppStore((s) => s.refresh);
  const [processing, setProcessing] = useState(false);
  const [stage, setStage] = useState<TxStage>("Pending");
  const [elapsed, setElapsed] = useState(0);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [verdict, setVerdict] = useState<PriceCheck | null>(null);
  const [error, setError] = useState<string | undefined>();
  // Monotonically-increasing id that identifies the "current" submission.
  // Every callback captures the id it was born with and bails out if the
  // id no longer matches — this prevents a stale (dismissed) submission's
  // late-arriving result from clobbering a newer one.
  const activeRequestId = useRef(0);
  const activeTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    refresh();
    // Auto-refresh registry every 30s so on-chain updates show up.
    const id = setInterval(() => refresh(), 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  // Sync wallet ↔ genlayer client. When the connected address changes,
  // rebuild the GenLayer client so the next tx is signed by MetaMask.
  useEffect(() => {
    tryAutoReconnect();
    const unsub = useWalletStore.subscribe((s) => {
      setActiveWalletAddress(s.address);
    });
    return unsub;
  }, []);

  // Set <title> + meta tags (replaces TanStack Router's head() helper).
  useEffect(() => {
    document.title = "PriceGuard - AI Price Verification on GenLayer";
  }, []);

  const handleSubmit = async (p: SubmitPayload) => {
    // Invalidate any in-flight submission: when its callbacks eventually fire,
    // they'll see that activeRequestId moved on and bail out silently.
    const myId = ++activeRequestId.current;

    // Clear the previous tick so we don't have two timers racing on `elapsed`.
    if (activeTickRef.current) {
      clearInterval(activeTickRef.current);
      activeTickRef.current = null;
    }

    setProcessing(true);
    setStage("Pending");
    setElapsed(0);
    setTxHash(undefined);
    const t0 = Date.now();
    const tick = setInterval(() => {
      // If a newer submission has taken over, stop updating the elapsed state.
      if (activeRequestId.current !== myId) {
        clearInterval(tick);
        return;
      }
      setElapsed(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    activeTickRef.current = tick;
    toast("Transaction submitted", { description: "Awaiting validator consensus…" });

    // Guard helper: only apply a state update if this submission is still the
    // active one. Anything from a dismissed / superseded submission is dropped.
    const ifActive = (fn: () => void) => {
      if (activeRequestId.current === myId) fn();
    };

    // Submit and resolve in the background. If the user dismisses the modal
    // AND doesn't start a new one, we still wait for the verdict and show it.
    submitPriceCheck({
      type: p.type,
      url: p.type === "url" ? p.url : undefined,
      product_name: p.type === "manual" ? p.product_name : undefined,
      listed_price: p.type === "manual" ? p.listed_price : undefined,
      store_name: p.type === "manual" ? p.store_name : undefined,
      category: p.category,
      onTxHash: (h) => ifActive(() => setTxHash(h)),
      onStage: (s) => ifActive(() => setStage(s)),
    })
      .then(async ({ check }) => {
        clearInterval(tick);
        // If this submission has been superseded, log and drop — refresh() is
        // still called so the Registry picks up the new check in the background.
        if (activeRequestId.current !== myId) {
          console.log(`[submit ${myId}] superseded — dropping stale verdict for`, check.product_name);
          await refresh();
          return;
        }
        if (activeTickRef.current === tick) activeTickRef.current = null;
        setProcessing(false);
        setVerdict(check);
        await refresh();
        // Strategy A resolves as soon as the verdict appears in the leader
        // receipt (during Committing / Revealing). At that point the
        // contract's storage hasn't been committed yet — total_checks only
        // ticks up once the tx reaches ACCEPTED, which on Studionet can be
        // 30s–3min after the receipt is visible.
        // We poll refresh() every 5s for up to 2 minutes so the dashboard
        // catches the storage update the moment it lands.
        let pollCount = 0;
        const POLL_MAX = 24; // 24 × 5s = 2 min
        const pollId = setInterval(() => {
          pollCount++;
          refresh().catch(() => {});
          if (pollCount >= POLL_MAX) clearInterval(pollId);
        }, 5_000);
        if (check.verdict === "GREAT_DEAL") {
          confetti({ particleCount: 140, spread: 90, origin: { y: 0.5 }, colors: ["#00d68f", "#6366f1", "#ffffff"] });
          toast.success("Great deal verified!");
        } else if (check.verdict === "SCAM_ALERT") {
          document.body.animate(
            [
              { transform: "translateX(0)" },
              { transform: "translateX(-8px)" },
              { transform: "translateX(8px)" },
              { transform: "translateX(-4px)" },
              { transform: "translateX(0)" },
            ],
            { duration: 360 },
          );
          toast.error("Scam alert triggered");
        } else {
          toast.success("Verdict accepted on-chain");
        }
      })
      .catch((e: unknown) => {
        clearInterval(tick);
        if (activeRequestId.current !== myId) {
          console.log(`[submit ${myId}] superseded — dropping stale error`);
          return;
        }
        if (activeTickRef.current === tick) activeTickRef.current = null;
        setProcessing(false);
        const msg = e instanceof Error ? e.message : "Transaction failed";
        setError(msg);
      });
  };

  // Hint the user when validators are taking a while.
  useEffect(() => {
    if (!processing) return;
    const t60 = setTimeout(() => {
      if (processing) toast("Validators are still working", {
        description: "GenLayer LLM consensus can take 1–5 min. You can dismiss and we'll notify you when ready.",
      });
    }, 60_000);
    return () => clearTimeout(t60);
  }, [processing]);

  return (
    <div className="min-h-screen text-foreground">
      <Toaster theme="dark" position="top-right" richColors />
      <Header />
      <main>
        <Hero />
        <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="mb-12">
            <StatsDashboard />
          </div>
          <div className="mx-auto mb-16 max-w-3xl">
            <PriceCheckInput onSubmit={handleSubmit} submitting={processing} />
          </div>
          <Registry />
        </div>
        <footer className="border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
          PriceGuard · Built on <span className="text-foreground">GenLayer</span> · Equivalence Principle Consensus
        </footer>
      </main>

      <ProcessingModal
        open={processing}
        stage={stage}
        elapsed={elapsed}
        txHash={txHash}
        onDismiss={() => setProcessing(false)}
      />
      <VerdictModal open={!!verdict} check={verdict} txHash={txHash} onClose={() => setVerdict(null)} />
      <ErrorModal open={!!error} message={error} onClose={() => setError(undefined)} />
    </div>
  );
}
