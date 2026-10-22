"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Acknowledge a critical-result alert (Module 01/02, Category 04). */
export function AcknowledgeAlertButton({ alertId }: { alertId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ack = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/facility/critical-alerts/${alertId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-1">
      <Button size="sm" disabled={busy} onClick={ack}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Acknowledge
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
