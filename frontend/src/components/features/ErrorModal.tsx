import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ErrorModal({ open, message, onClose }: { open: boolean; message?: string; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md border-scam/30 bg-background/95 backdrop-blur-xl glow-scam">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-scam/15 ring-1 ring-scam/40">
            <AlertTriangle className="h-6 w-6 text-scam" />
          </div>
          <h2 className="mt-4 font-display text-lg font-bold">Something went wrong</h2>
          <p className="mt-1 text-sm text-muted-foreground">{message ?? "Unknown error"}</p>
          <Button onClick={onClose} variant="outline" className="mt-5">Dismiss</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}