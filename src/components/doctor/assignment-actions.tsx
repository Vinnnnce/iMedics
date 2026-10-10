"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserMinus, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/** Discharge a patient from, or re-admit them to, the signed-in doctor's care. */
export function AssignmentActions({ patientId, status }: { patientId: string; status: "ACTIVE" | "DISCHARGED" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const next = status === "ACTIVE" ? "DISCHARGED" : "ACTIVE";

  const run = () => {
    setError("");
    startTransition(async () => {
      try {
        await apiClient.patch(`/patients/${patientId}/assignment`, { status: next });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" variant="outline" className="rounded-lg" disabled={pending} onClick={run}>
        {status === "ACTIVE" ? <UserMinus className="h-4 w-4 mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
        {status === "ACTIVE" ? "Discharge" : "Re-admit"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
