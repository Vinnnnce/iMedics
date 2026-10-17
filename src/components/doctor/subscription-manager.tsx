"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/money";

interface PlanInfo {
  code: string;
  name: string;
  monthlyPrice: number;
  currency: string;
  consultationAllowance: number | null;
  features: Record<string, boolean>;
}

interface SubscriptionInfo {
  id: string;
  status: string;
  planCode: string;
  planName: string;
  monthlyPrice: number;
  currency: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  consultationsUsed: number;
  consultationAllowance: number | null;
  paymentStatus: string | null;
}

interface SubscriptionState {
  subscription: SubscriptionInfo | null;
  entitlements: Record<string, boolean>;
  plans: PlanInfo[];
}

const FEATURE_LABELS: Record<string, string> = {
  chat: "Patient chat",
  audio: "Audio consultations",
  video: "Video consultations",
  ai: "AI tools",
  analytics: "Analytics",
  listing: "Directory listing",
};

/** Doctors pick a plan, pay for it, and manage renewal and cancellation. */
export function SubscriptionManager() {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      setState(await apiClient.get<SubscriptionState>("/subscriptions/me"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load your subscription");
    }
  }, []);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => {});
  }, [load]);

  const purchase = async (planCode: string) => {
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const { checkoutUrl } = await apiClient.post<{ checkoutUrl: string }>("/subscriptions/me/purchase", { planCode, method: "CARD" });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await apiClient.post("/subscriptions/me/cancel", {});
      setMessage("Your plan will not renew. You keep access until the end of the period.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    setBusy(true);
    try {
      await apiClient.delete("/subscriptions/me/cancel");
      setMessage("Your plan will renew as normal.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not resume");
    } finally {
      setBusy(false);
    }
  };

  if (!state) {
    return <p className="text-sm text-muted-foreground">{error || "Loading…"}</p>;
  }

  const subscription = state.subscription;
  const active = subscription?.status === "ACTIVE";

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-muted-foreground">{message}</p>}

      {subscription && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">Your plan: {subscription.planName}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {formatMoney(subscription.monthlyPrice, subscription.currency)} per month ·{" "}
              {subscription.status === "ACTIVE"
                ? `renews ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
                : subscription.status === "PENDING_PAYMENT"
                  ? "waiting for your payment"
                  : subscription.status.toLowerCase()}
            </p>
            {subscription.consultationAllowance !== null && (
              <div className="space-y-1">
                <Progress
                  value={Math.min(100, (subscription.consultationsUsed / subscription.consultationAllowance) * 100)}
                />
                <p className="text-xs text-muted-foreground">
                  {subscription.consultationsUsed} of {subscription.consultationAllowance} included consultations used this month
                </p>
              </div>
            )}
            {subscription.cancelAtPeriodEnd && active && (
              <p className="text-sm text-muted-foreground">This plan will not renew. You keep access until the period ends.</p>
            )}
            {active && (
              <div className="flex gap-2">
                {subscription.cancelAtPeriodEnd ? (
                  <Button variant="outline" onClick={resume} disabled={busy}>
                    Resume renewal
                  </Button>
                ) : (
                  <Button variant="outline" onClick={cancel} disabled={busy}>
                    Cancel renewal
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {state.plans.map((plan) => (
          <Card key={plan.code} className="beeline-card flex flex-col">
            <CardHeader>
              <CardTitle className="text-base">{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-3 text-sm">
              <p className="font-medium">{formatMoney(plan.monthlyPrice, plan.currency)}/month</p>
              <ul className="space-y-1">
                {Object.entries(FEATURE_LABELS).map(([feature, label]) => (
                  <li key={feature} className={plan.features[feature] ? "" : "text-muted-foreground line-through"}>
                    {plan.features[feature] ? "✓" : "✗"} {label}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                {plan.consultationAllowance === null ? "Unlimited consultations" : `${plan.consultationAllowance} consultations/month`}
              </p>
              <Button onClick={() => purchase(plan.code)} disabled={busy || (active && subscription?.planCode === plan.code)}>
                {active && subscription?.planCode === plan.code ? "Current plan" : active ? "Switch to this plan" : "Choose this plan"}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Switching plans takes effect immediately and starts a new monthly period. Your plan activates as soon as the payment is
        confirmed.
      </p>
    </div>
  );
}
