"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";

export interface PlanView { code: string; name: string; monthlyPrice: number; currency: string; purchasable: boolean }
export interface SubscriptionView {
  phase: string; canWrite: boolean; daysLeft: number | null; endsAt: string | null;
  status: string | null; trialEndsAt: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; planName: string | null;
  plans: PlanView[]; billingConfigured: boolean; canManage: boolean; graceDays: number;
}

const PHASE_LABEL: Record<string, string> = {
  TRIAL: "Free trial", PAID: "Active plan", GRACE: "Plan ended (grace period)", READ_ONLY: "Plan ended: read-only",
  FREE_UNTIL_PLANS: "Free until plans are announced", UNMETERED: "No plan required",
};
const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "");
const money = (n: number, currency: string) => new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n);

export function SubscriptionManager({ view }: { view: SubscriptionView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function buy(planCode: string) {
    setBusy(planCode);
    try {
      const { checkoutUrl } = await apiClient.post<{ checkoutUrl: string }>("/facility/subscription/purchase", { planCode, method: "CARD" });
      window.location.assign(checkoutUrl);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the payment");
      setBusy(null);
    }
  }
  async function cancel(cancelIt: boolean) {
    setBusy("cancel");
    try {
      await apiClient.post("/facility/subscription/cancel", { cancel: cancelIt });
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your plan");
    } finally { setBusy(null); }
  }

  const ended = view.phase === "GRACE" || view.phase === "READ_ONLY";
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="flex flex-wrap items-center gap-2 text-lg">Your plan <Badge variant={ended ? "destructive" : "secondary"}>{PHASE_LABEL[view.phase] ?? view.phase}</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {view.phase === "TRIAL" && <p>Your free trial runs until <strong className="text-foreground">{date(view.endsAt)}</strong> ({view.daysLeft} day{view.daysLeft === 1 ? "" : "s"} left). Everything is available during the trial.</p>}
          {view.phase === "PAID" && <p>{view.planName ?? "Your plan"} is active until <strong className="text-foreground">{date(view.currentPeriodEnd)}</strong>.{view.cancelAtPeriodEnd ? " It will not renew." : ""}</p>}
          {view.phase === "GRACE" && <p>Your plan ended. Everything still works until <strong className="text-foreground">{date(view.endsAt)}</strong>. After that, new records cannot be created until you choose a plan.</p>}
          {view.phase === "READ_ONLY" && <p>Your plan has ended. You can still view and export every record, and emergency, nursing, medication and critical-result work continues. Choose a plan to create new records again.</p>}
          {view.phase === "FREE_UNTIL_PLANS" && <p>Your trial has ended, but no plans are on sale yet, so nothing is restricted. We will tell you before that changes.</p>}
          <p>Your records are never deleted or hidden when a plan ends.</p>
        </CardContent>
      </Card>

      {view.plans.length > 0 && (
        <section aria-labelledby="plans-title" className="space-y-3">
          <h2 id="plans-title" className="text-lg font-semibold">Plans</h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {view.plans.map((plan) => (
              <li key={plan.code}>
                <Card><CardContent className="space-y-3 p-4">
                  <div><p className="font-medium">{plan.name}</p><p className="text-sm text-muted-foreground">{money(plan.monthlyPrice, plan.currency)} per month</p></div>
                  {view.canManage ? (
                    <Button disabled={!plan.purchasable || busy !== null} onClick={() => buy(plan.code)} className="rounded-lg">{plan.purchasable ? (busy === plan.code ? "Starting…" : "Choose this plan") : "Not available yet"}</Button>
                  ) : <p className="text-xs text-muted-foreground">Only the facility owner can choose a plan.</p>}
                </CardContent></Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      {view.plans.length === 0 && <p className="text-sm text-muted-foreground">Plans and prices have not been announced yet.</p>}

      {view.canManage && view.status === "ACTIVE" && (
        <Button variant="outline" disabled={busy !== null} onClick={() => cancel(!view.cancelAtPeriodEnd)} className="rounded-lg">
          {view.cancelAtPeriodEnd ? "Keep renewing my plan" : "Do not renew my plan"}
        </Button>
      )}
    </div>
  );
}
