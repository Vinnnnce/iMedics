"use client";

import { useState } from "react";
import { Flag, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";
import { REPORT_REASONS, type ReportReason } from "@/lib/profile-reports";

/** "Report this profile": a small inline form that sends the report to the admin team. */
export function ReportProfileButton({ targetType, targetId }: { targetType: "DOCTOR" | "FACILITY"; targetId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("INACCURATE");
  const [details, setDetails] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await apiClient.post("/profile-reports", { targetType, targetId, reason, details: details || undefined });
      setSent(true);
      setOpen(false);
      toast.success("Thank you. Our team will review this profile.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the report");
    } finally {
      setSending(false);
    }
  };

  if (sent) return <span className="text-xs text-muted-foreground">Reported. Thank you.</span>;

  return (
    <div className="space-y-2">
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="text-muted-foreground">
        <Flag className="mr-1 h-4 w-4" aria-hidden="true" /> Report this profile
      </Button>
      {open && (
        <div className="max-w-sm space-y-2 rounded-lg border border-border bg-card p-3">
          <label className="text-xs text-muted-foreground" htmlFor={`report-reason-${targetId}`}>What is wrong?</label>
          <select
            id={`report-reason-${targetId}`}
            value={reason}
            onChange={(e) => setReason(e.target.value as ReportReason)}
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
          >
            {Object.entries(REPORT_REASONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <Textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Add details (optional)" maxLength={1000} className="min-h-20" aria-label="Report details" />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={submit} disabled={sending}>
              {sending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Send report
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
