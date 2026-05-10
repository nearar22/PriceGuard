import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link2, Search, Tag, Store, DollarSign, Loader2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CATEGORIES = ["electronics", "clothing", "home", "beauty", "sports", "food", "other"];

const urlSchema = z.object({
  url: z.string().trim().url("Enter a valid URL")
    .refine((u) => /^https?:\/\//i.test(u), "Must start with http(s)://")
    .refine((u) => !/localhost|127\.0\.0\.1|0\.0\.0\.0|::1|10\.|192\.168\./i.test(u), "Internal/local URLs are not allowed"),
  category: z.string().min(1, "Pick a category"),
});
const manualSchema = z.object({
  product_name: z.string().trim().min(2, "Required").max(120),
  listed_price: z.coerce.number().positive("Must be > 0").max(1_000_000),
  store_name: z.string().trim().max(80).optional(),
  category: z.string().min(1, "Pick a category"),
});

export type SubmitPayload =
  | { type: "url"; url: string; category: string }
  | { type: "manual"; product_name: string; listed_price: number; store_name?: string; category: string };

export function PriceCheckInput({
  onSubmit, submitting,
}: { onSubmit: (p: SubmitPayload) => void; submitting: boolean }) {
  const [tab, setTab] = useState("url");
  const urlForm = useForm({ resolver: zodResolver(urlSchema), defaultValues: { url: "", category: "electronics" } });
  const manualForm = useForm({ resolver: zodResolver(manualSchema), defaultValues: { product_name: "", listed_price: 0, store_name: "", category: "electronics" } });

  return (
    <div className="glass rounded-3xl p-1.5 shadow-2xl">
      <div className="rounded-[22px] bg-background/40 p-5 sm:p-7">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 bg-card/50">
            <TabsTrigger value="url"><Link2 className="mr-2 h-3.5 w-3.5" />Check by URL</TabsTrigger>
            <TabsTrigger value="manual"><Tag className="mr-2 h-3.5 w-3.5" />Manual Check</TabsTrigger>
          </TabsList>

          <TabsContent value="url" className="mt-5 space-y-4">
            <form onSubmit={urlForm.handleSubmit((v) => onSubmit({ type: "url", ...v }))} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Product URL</Label>
                <div className="relative mt-1.5">
                  <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input className="h-12 pl-10 font-mono text-sm" placeholder="https://amazon.com/dp/..." {...urlForm.register("url")} />
                </div>
                {urlForm.formState.errors.url && <p className="mt-1 text-xs text-destructive">{urlForm.formState.errors.url.message}</p>}
              </div>
              <CategorySelect value={urlForm.watch("category")} onChange={(v) => urlForm.setValue("category", v)} />
              <SubmitBtn submitting={submitting} />
            </form>
          </TabsContent>

          <TabsContent value="manual" className="mt-5 space-y-4">
            <form onSubmit={manualForm.handleSubmit((v) => onSubmit({ type: "manual", ...v }))} className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Product Name</Label>
                <Input className="mt-1.5 h-11" placeholder="e.g. Sony WH-1000XM5" {...manualForm.register("product_name")} />
                {manualForm.formState.errors.product_name && <p className="mt-1 text-xs text-destructive">{manualForm.formState.errors.product_name.message}</p>}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Listed Price (USD)</Label>
                  <div className="relative mt-1.5">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" step="0.01" className="h-11 pl-9 font-mono" placeholder="299.99" {...manualForm.register("listed_price")} />
                  </div>
                  {manualForm.formState.errors.listed_price && <p className="mt-1 text-xs text-destructive">{manualForm.formState.errors.listed_price.message}</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Store (optional)</Label>
                  <div className="relative mt-1.5">
                    <Store className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="h-11 pl-9" placeholder="Amazon" {...manualForm.register("store_name")} />
                  </div>
                </div>
              </div>
              <CategorySelect value={manualForm.watch("category")} onChange={(v) => manualForm.setValue("category", v)} />
              <SubmitBtn submitting={submitting} />
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function CategorySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">Category</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1.5 h-11"><SelectValue /></SelectTrigger>
        <SelectContent>
          {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SubmitBtn({ submitting }: { submitting: boolean }) {
  return (
    <Button
      type="submit" disabled={submitting}
      className="group relative h-13 w-full overflow-hidden rounded-xl py-6 font-display text-base font-bold uppercase tracking-wider"
      style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 160), oklch(0.65 0.2 265))" }}
    >
      {submitting ? (
        <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Submitting…</>
      ) : (
        <><Search className="mr-2 h-5 w-5" /> Verify Price</>
      )}
    </Button>
  );
}