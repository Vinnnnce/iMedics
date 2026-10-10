"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/** Start (lab staff) or cancel (ordering doctor) a lab order that has not been started. */
export function LabOrderActions({ orderId, action }: { orderId: string; action: "start" | "cancel" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const run = () =>
    startTransition(async () => {
      setError("");
      try {
        await apiClient.patch(`/lab-orders/${orderId}`, { status: action === "start" ? "IN_PROGRESS" : "CANCELLED" });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant={action === "start" ? "default" : "outline"} className={action === "start" ? "bg-foreground text-background rounded-lg" : "rounded-lg"} disabled={pending} onClick={run}>
        {action === "start" ? "Start" : "Cancel order"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
