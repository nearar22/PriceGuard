import { DollarSign, Copy, Wifi, Wallet, LogOut, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { truncateAddr, MOCK_MODE } from "@/lib/genlayer";
import { useWalletStore } from "@/lib/wallet";
import { useAppStore } from "@/stores/app-store";

export function Header() {
  const liveMode = useAppStore((s) => s.liveMode);
  const setLiveMode = useAppStore((s) => s.setLiveMode);
  const { address, connecting, error, connect, disconnect } = useWalletStore();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close dropdown when clicking outside.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = () => setMenuOpen(false);
    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, [menuOpen]);

  const onConnect = async () => {
    try {
      await connect();
      toast.success("Wallet connected", {
        description: "Your wallet will sign GenLayer Studionet transactions.",
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      toast.error("Wallet connection failed", { description: msg });
    }
  };


  const onCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    toast.success("Address copied", { description: address });
  };

  const onDisconnect = () => {
    disconnect();
    setMenuOpen(false);
    toast("Wallet disconnected");
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="sticky top-0 z-40 glass border-b border-border/50"
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-deal/15 ring-1 ring-deal/40 glow-deal">
            <DollarSign className="h-5 w-5 text-deal" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-extrabold tracking-tight">PRICEGUARD</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Powered by GenLayer</div>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs sm:flex">
          <span className="relative inline-flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-deal opacity-60 animate-ping" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-deal" />
          </span>
          <Wifi className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="font-medium">Studionet Testnet</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-1 rounded-full border border-border/60 bg-card/40 p-0.5 text-xs sm:flex">
            <button
              onClick={() => setLiveMode(true)}
              className={`rounded-full px-3 py-1 transition ${liveMode ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >Live</button>
            <button
              onClick={() => setLiveMode(false)}
              className={`rounded-full px-3 py-1 transition ${!liveMode ? "bg-deal/20 text-deal" : "text-muted-foreground"}`}
            >Demo</button>
          </div>

          {/* Wallet area */}
          {address ? (
            <div className="relative" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="group inline-flex items-center gap-2 rounded-full border border-deal/40 bg-deal/10 px-3 py-1.5 font-mono text-xs text-foreground transition hover:bg-deal/15"
              >
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping bg-deal" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-deal" />
                </span>
                {truncateAddr(address)}
              </button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="glass absolute right-0 mt-2 w-56 rounded-xl border border-border/60 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl"
                  >
                    <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Connected wallet
                    </div>
                    <div className="px-3 text-[11px] font-semibold text-foreground">
                      {(typeof window !== "undefined" && (window as unknown as { __priceguard_wallet_name?: string }).__priceguard_wallet_name) || "EVM Wallet"}
                    </div>
                    <div className="px-3 font-mono text-xs text-muted-foreground">{truncateAddr(address)}</div>
                    <div className="px-3 pb-2 pt-1 text-[10px] leading-snug text-deal">
                      ✓ Signing on GenLayer Studionet
                    </div>
                    <div className="my-1 h-px bg-border/40" />
                    <button
                      onClick={onCopy}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-card/60"
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy address
                    </button>
                    <button
                      onClick={onDisconnect}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-scam hover:bg-scam/10"
                    >
                      <LogOut className="h-3.5 w-3.5" /> Disconnect
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button
              onClick={onConnect}
              disabled={connecting}
              size="sm"
              className="gap-2 bg-gradient-to-r from-deal to-primary text-primary-foreground hover:opacity-90"
            >
              {connecting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  Connect Wallet
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Status banners */}
      {error && !address && (
        <div className="border-t border-scam/30 bg-scam/10 px-4 py-2 text-center text-[11px] text-scam">
          <AlertCircle className="mr-1 inline h-3 w-3" /> {error}
        </div>
      )}
      {MOCK_MODE && (
        <div className="border-t border-border/40 bg-deal/5 py-1 text-center text-[10px] uppercase tracking-widest text-deal/80">
          Demo Mode · Simulated on-chain interactions
        </div>
      )}
    </motion.header>
  );
}
