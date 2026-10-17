"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

export interface WorkflowOption {
  stage: string;
  label: string;
}

/** Advance a booking through the operational workflow (check-in → sample/result → release). */
export function BookingWorkflowControls({
  bookingId,
  currentLabel,
  options,
}: {
  bookingId: string;
  currentLabel: string;
  options: WorkflowOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const advance = async (stage: string) => {
    setBusy(true); setError("");
    try {
      await apiClient.patch(`/facility-bookings/${bookingId}?scope=facility`, { workflowStage: stage });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the workflow");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="rounded-lg text-xs">Workflow: {currentLabel}</Badge>
        {options.map((o) => (
          <Button key={o.stage} size="sm" variant="outline" disabled={busy} onClick={() => advance(o.stage)}>
            {o.label}
          </Button>
        ))}
      </div>
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {options.length === 0 && (
        <p className="text-xs text-muted-foreground">No further workflow steps for this booking.</p>
      )}
    </div>
  );
}
