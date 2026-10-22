"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Publish or edit the facility's official response to a patient review. */
export function ReviewResponseForm({
  reviewId,
  initialResponse,
}: {
  reviewId: string;
  initialResponse: string;
}) {
  const router = useRouter();
  const [response, setResponse] = useState(initialResponse);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!response.trim()) return setError("Write a response first");
    setBusy(true);
    try {
      const res = await fetch(`/api/facility-reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityResponse: response }),
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
    <form onSubmit={submit} className="space-y-2">
      <Label className="text-xs text-muted-foreground">
        {initialResponse ? "Edit your public response" : "Respond publicly to this review"}
      </Label>
      <Textarea
        rows={3}
        value={response}
        onChange={(e) => setResponse(e.target.value)}
        placeholder="Thank the patient and address their feedback…"
        maxLength={4000}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" size="sm" disabled={busy || response.trim() === initialResponse.trim()}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {initialResponse ? "Update response" : "Publish response"}
      </Button>
    </form>
  );
}
