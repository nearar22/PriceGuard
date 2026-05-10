import { motion } from "framer-motion";
import { Link2, Cpu, ShieldCheck, ArrowRight } from "lucide-react";

export function Hero() {
  const steps = [
    { icon: Link2, label: "Submit URL", desc: "Paste any product link" },
    { icon: Cpu, label: "AI Validators Analyze", desc: "Multi-agent consensus" },
    { icon: ShieldCheck, label: "Verdict On-Chain", desc: "Permanent proof" },
  ];
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />
      <div className="relative mx-auto max-w-5xl px-4 pt-16 pb-12 text-center sm:pt-24 sm:pb-20">
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="mx-auto inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-1.5 text-xs"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-deal" />
          AI Price Intelligence on GenLayer
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="mt-6 font-display text-5xl font-extrabold leading-[1.05] tracking-tight sm:text-7xl"
        >
          Is That Price{" "}
          <span className="text-gradient">Fair?</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg"
        >
          Paste any product URL — autonomous AI validators on GenLayer scrape, debate, and reach
          consensus on whether you've found a great deal, a fair price, or a scam. Every verdict
          is permanently recorded on-chain.
        </motion.p>

        <div className="mx-auto mt-12 flex max-w-3xl flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          {steps.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.08 }}
              className="group flex flex-1 items-center gap-3 rounded-xl glass px-4 py-3 text-left"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary ring-1 ring-primary/30">
                <s.icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-sm font-bold">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.desc}</div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="ml-auto hidden h-4 w-4 text-muted-foreground/60 sm:block" />
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}