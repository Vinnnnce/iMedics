"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";
import { StatusChip } from "@/components/shared/status-chip";

interface SubscriptionState { plan: string; status: "ACTIVE" | "PAUSED" | "CANCELLED"; renewsAt: Date | null }

export function SubscriptionActions({ subscription, ready }: { subscription: SubscriptionState; ready: boolean }) {
  const [current, setCurrent] = useState(subscription.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const tone = current === "ACTIVE" ? "success" : current === "PAUSED" ? "warning" : "danger";
  const label = current === "ACTIVE" ? "Active" : current === "PAUSED" ? "Paused" : "Cancelled";

  async function updateStatus(status: "PAUSED" | "CANCELLED") {
    const verb = status === "PAUSED" ? "Pause" : "Cancel";
    const confirmed = window.confirm(
      `${verb} your subscription entitlement record? This does not cancel external recurring billing. Contact the administrator for billing and reactivation.`
    );
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.patch("/workspace/subscription", { status, confirm: true });
      setCurrent(status);
      setSuccess(`Subscription record ${status === "PAUSED" ? "paused" : "cancelled"}. External billing is unchanged.`);
    } catch {
      setError("The subscription record could not be updated. Please try again or contact support.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip tone={tone}>{label}</StatusChip>
        <span className="text-sm font-medium">{subscription.plan}</span>
      </div>
      {subscription.renewsAt && (
        <p className="text-sm text-muted-foreground">
          Renewal date: {new Date(subscription.renewsAt).toLocaleDateString("en-GB", { dateStyle: "long" })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Subscription records are administrator-managed; no automatic billing is initiated here. Plan changes and
        external billing are handled by the platform administrator.
      </p>
      {current === "ACTIVE" && (
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" size="sm" disabled={!ready || busy} onClick={() => void updateStatus("PAUSED")}>
            {busy ? "Working…" : "Pause subscription record"}
          </Button>
          <Button variant="outline" size="sm" disabled={!ready || busy} onClick={() => void updateStatus("CANCELLED")}>
            {busy ? "Working…" : "Cancel subscription record"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-foreground">
          {success}
        </p>
      )}
    </div>
  );
}