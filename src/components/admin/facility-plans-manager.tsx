"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

export interface PlanRow { code: string; name: string; monthlyPrice: number; currency: string; sortOrder: number; active: boolean; pricingConfirmed: boolean }

const EMPTY: PlanRow = { code: "", name: "", monthlyPrice: 0, currency: "NGN", sortOrder: 0, active: true, pricingConfirmed: false };
const money = (n: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);

export const CONFIRM_FIRST_PLAN =
  "Confirm this price?\n\nThis is the first facility plan with a confirmed price. Confirming it:\n• lets facilities buy it, and\n• switches on end-of-trial restrictions: facilities whose trial and grace period have ended become read-only for new records.\n\nExisting records, exports and safety-critical work always keep working. Continue?";
export const CONFIRM_PLAN = "Confirm this price? Facilities will be able to buy this plan at this price.";

/** Create and edit facility plans. Confirming a price is the deliberate, audited switch for billing. */
export function FacilityPlansManager({ plans, restrictionsOn }: { plans: PlanRow[]; restrictionsOn: boolean }) {
  const router = useRouter();
  const [form, setForm] = useState<PlanRow>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof PlanRow>(key: K, value: PlanRow[K]) => setForm((f) => ({ ...f, [key]: value }));

  async function save(event: FormEvent) {
    event.preventDefault();
    const original = plans.find((p) => p.code === form.code);
    const newlyConfirming = form.pricingConfirmed && !original?.pricingConfirmed;
    if (newlyConfirming && !window.confirm(restrictionsOn ? CONFIRM_PLAN : CONFIRM_FIRST_PLAN)) return;
    setBusy(true);
    try {
      await apiClient.post("/admin/facility-plans", { ...form, monthlyPrice: Number(form.monthlyPrice), sortOrder: Number(form.sortOrder) });
      toast.success("Plan saved");
      setForm(EMPTY);
      setEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the plan");
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div role="status" className={`rounded-xl border p-4 text-sm ${restrictionsOn ? "border-warning/50 bg-warning/5" : "bg-muted/50"}`}>
        {restrictionsOn
          ? <><strong>End-of-trial restrictions are ON.</strong> At least one plan has a confirmed price, so facilities whose trial and grace period have ended cannot create new records until they choose a plan.</>
          : <><strong>End-of-trial restrictions are OFF.</strong> No plan has a confirmed price yet, so no facility is restricted and trials simply keep running. Confirming the first price turns restrictions on.</>}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Facility plans</CardTitle></CardHeader>
        <CardContent>
          {plans.length === 0 ? <p className="text-sm text-muted-foreground">No facility plans yet.</p> : (
            <ul className="divide-y">
              {plans.map((p) => (
                <li key={p.code} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name} <span className="font-mono text-xs text-muted-foreground">{p.code}</span></p>
                    <p className="text-muted-foreground">{money(p.monthlyPrice, p.currency)} per month</p>
                  </div>
                  <Badge variant={p.pricingConfirmed ? "secondary" : "outline"}>{p.pricingConfirmed ? "price confirmed" : "draft price"}</Badge>
                  <Badge variant="outline">{p.active ? "on sale" : "hidden"}</Badge>
                  <Button size="sm" variant="outline" onClick={() => { setForm(p); setEditing(true); window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); }}>Edit</Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{editing ? `Edit ${form.code}` : "New plan"}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label htmlFor="plan-code">Code</Label><Input id="plan-code" value={form.code} disabled={editing} onChange={(e) => set("code", e.target.value.toLowerCase())} required pattern="[a-z0-9][a-z0-9\-]{1,40}" placeholder="facility-standard" /></div>
            <div className="space-y-2"><Label htmlFor="plan-name">Name</Label><Input id="plan-name" value={form.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={80} /></div>
            <div className="space-y-2"><Label htmlFor="plan-price">Monthly price</Label><Input id="plan-price" type="number" min={0} step="0.01" value={form.monthlyPrice} onChange={(e) => set("monthlyPrice", Number(e.target.value))} required /></div>
            <div className="space-y-2"><Label htmlFor="plan-currency">Currency</Label><Input id="plan-currency" value={form.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} required minLength={3} maxLength={3} /></div>
            <div className="space-y-2"><Label htmlFor="plan-order">Display order</Label><Input id="plan-order" type="number" min={0} max={100} value={form.sortOrder} onChange={(e) => set("sortOrder", Number(e.target.value))} /></div>
            <div className="flex flex-col justify-end gap-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={(e) => set("active", e.target.checked)} /> Show on the facility Subscription page</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={form.pricingConfirmed} onChange={(e) => set("pricingConfirmed", e.target.checked)} /> Price is final: allow purchases</label>
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={busy} className="rounded-lg">{busy ? "Saving…" : "Save plan"}</Button>
              {editing && <Button type="button" variant="outline" onClick={() => { setForm(EMPTY); setEditing(false); }}>Cancel</Button>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
