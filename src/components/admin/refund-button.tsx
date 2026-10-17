"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

/** Refund a successful payment in full. A reason is required and recorded; the booking it paid for is cancelled. */
export function RefundButton({ paymentId, amountLabel }: { paymentId: string; amountLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/admin/payments/${paymentId}/refund`, { reason });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button variant="outline" className="rounded-lg" onClick={() => setOpen(true)}>
        <Undo2 className="mr-2 h-4 w-4" /> Refund
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund {amountLabel}</DialogTitle>
            <DialogDescription>The full amount goes back to the payer through the payment gateway, and any upcoming appointment or booking paid for is cancelled. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (required, recorded in the audit log)" className="min-h-24 rounded-lg" maxLength={300} aria-label="Reason" />
          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" className="rounded-lg" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="destructive" className="rounded-lg" disabled={busy || reason.trim().length < 5} onClick={submit}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Refund {amountLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
