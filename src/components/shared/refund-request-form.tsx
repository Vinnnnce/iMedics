"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

/** A patient asks for a refund of a successful payment; an admin reviews the request. */
export function RefundRequestForm({ paymentId }: { paymentId: string }) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await apiClient.post(`/payments/${paymentId}/refund-request`, { reason });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit your request");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <Card className="beeline-card">
        <CardContent className="text-sm text-muted-foreground">
          Your refund request has been received and is awaiting review. We will notify you once it has been decided.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="beeline-card">
      <CardHeader>
        <CardTitle className="text-lg">Request a refund</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="refund-reason">Tell us why you want a refund</Label>
            <Textarea
              id="refund-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. The appointment was cancelled by the doctor"
              required
              minLength={10}
              maxLength={500}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" variant="outline" disabled={submitting || reason.trim().length < 10}>
            {submitting ? "Submitting…" : "Request refund"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
