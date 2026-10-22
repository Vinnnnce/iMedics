"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/** Create a draft examination report for one of the centre's bookings. */
export function CreateReportDialog({ bookingId, serviceName }: { bookingId: string; serviceName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ preliminaryFindings: "", specialistInterpretation: "", recommendations: "" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson("/api/facility/diagnostic-reports", {
        bookingId,
        ...form,
        preliminaryFindings: form.preliminaryFindings || undefined,
        specialistInterpretation: form.specialistInterpretation || undefined,
        recommendations: form.recommendations || undefined,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">Draft report</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Draft examination report</DialogTitle>
          <DialogDescription>{serviceName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label>Preliminary findings</Label>
            <Textarea rows={3} value={form.preliminaryFindings} onChange={(e) => setForm({ ...form, preliminaryFindings: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Specialist interpretation</Label>
            <Textarea rows={3} value={form.specialistInterpretation} onChange={(e) => setForm({ ...form, specialistInterpretation: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label>Recommendations</Label>
            <Textarea rows={2} value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create draft
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const REPORT_FORM_FIELDS = [
  { key: "preliminaryFindings", label: "Preliminary findings" },
  { key: "specialistInterpretation", label: "Specialist interpretation" },
  { key: "recommendations", label: "Recommendations" },
] as const;

/** Edit a DRAFT report (finalized reports are amended instead). */
export function EditDraftReportForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ preliminaryFindings: "", specialistInterpretation: "", recommendations: "" });

  useEffect(() => {
    fetch(`/api/facility/diagnostic-reports/${reportId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.report) {
          setForm({
            preliminaryFindings: d.report.preliminaryFindings ?? "",
            specialistInterpretation: d.report.specialistInterpretation ?? "",
            recommendations: d.report.recommendations ?? "",
          });
        }
      })
      .catch(() => undefined);
  }, [reportId]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/facility/diagnostic-reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    <form onSubmit={save} className="space-y-3">
      {REPORT_FORM_FIELDS.map((f) => (
        <div key={f.key} className="space-y-1">
          <Label>{f.label}</Label>
          <Textarea rows={3} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
        </div>
      ))}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft
      </Button>
    </form>
  );
}

/** Workflow actions: submit, finalize/sign, send to hospital, amend. */
export function ReportActions({ reportId, status }: { reportId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [amending, setAmending] = useState(false);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({ preliminaryFindings: "", specialistInterpretation: "", recommendations: "" });
  const [amendLoaded, setAmendLoaded] = useState(false);

  // Pre-fill the amendment form with the current report content so unchanged
  // fields are submitted with their existing values instead of being blanked.
  // Submission stays disabled until the current content has loaded — a failed
  // or slow load must never let a blank amendment through.
  useEffect(() => {
    if (!amending) return;
    fetch(`/api/facility/diagnostic-reports/${reportId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.report) {
          setForm({
            preliminaryFindings: d.report.preliminaryFindings ?? "",
            specialistInterpretation: d.report.specialistInterpretation ?? "",
            recommendations: d.report.recommendations ?? "",
          });
          setAmendLoaded(true);
        }
      })
      .catch(() => undefined);
  }, [amending, reportId]);

  const act = async (action: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await postJson(`/api/facility/diagnostic-reports/${reportId}/action`, { action, ...extra });
      setAmending(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <Button size="sm" disabled={busy} onClick={() => act("SUBMIT")}>Submit for verification</Button>
        )}
        {status === "AWAITING_VERIFICATION" && (
          <Button size="sm" disabled={busy} onClick={() => act("FINALIZE")}>Verify and sign (finalize)</Button>
        )}
        {(status === "FINALIZED" || status === "AMENDED") && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("SEND")}>Send to hospital</Button>
        )}
        {(status === "FINALIZED" || status === "SENT") && (
          <Button size="sm" variant="destructive" disabled={busy}
            onClick={() => { setAmendLoaded(false); setAmending((v) => !v); }}>Amend</Button>
        )}
      </div>
      {amending && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <p className="text-xs text-muted-foreground">
            Amendments preserve the original version in the report history. A reason is required.
          </p>
          <div className="space-y-1">
            <Label>Amendment reason (required)</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          {REPORT_FORM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Textarea rows={2} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </div>
          ))}
          <Button size="sm" variant="destructive" disabled={busy || !reason.trim() || !amendLoaded}
            onClick={() => act("AMEND", { reason, ...form })}>
            Submit amendment
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
