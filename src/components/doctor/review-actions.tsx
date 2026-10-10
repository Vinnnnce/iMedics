"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiClient } from "@/lib/api-client";

/** Approve or reject an AI analysis. Approval is what makes the patient-facing text visible. */
export function ReviewActions({ analysisId, canApprove }: { analysisId: string; canApprove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const decide = (decision: "APPROVED" | "REJECTED") => {
    setError("");
    startTransition(async () => {
      try {
        await apiClient.post(`/ai-analyses/${analysisId}/review`, { decision });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {canApprove && (
          <Button size="sm" disabled={pending} className="bg-foreground text-background rounded-lg" onClick={() => decide("APPROVED")}>
            <Check className="h-4 w-4 mr-1" /> Approve for patient
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={pending} className="rounded-lg" onClick={() => decide("REJECTED")}>
          <X className="h-4 w-4 mr-1" /> Reject
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
