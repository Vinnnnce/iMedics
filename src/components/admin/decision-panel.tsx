"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

interface Props {
  userId: string;
  name: string;
  status: "PENDING" | "REJECTED" | "VERIFIED";
  checklist: { key: string; label: string }[];
  /** Problems that stop approval (missing documents) so the reviewer sees why the button is disabled. */
  blockers: string[];
  reasons: readonly string[];
}

/** The reviewer's decision: confirm every check to approve, or say what needs fixing to reject. */
export function DecisionPanel({ userId, name, status, checklist, blockers, reasons }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [mode, setMode] = useState<"approve" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (status === "VERIFIED") {
    return (
      <Card className="beeline-card">
        <CardContent className="flex items-center gap-2 p-4 text-sm"><CheckCircle2 className="h-4 w-4 text-success" /> This account is verified.</CardContent>
      </Card>
    );
  }

  const allChecked = checklist.every((c) => checked[c.key]);

  const submit = async (decision: "APPROVED" | "REJECTED") => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post(`/admin/verifications/${userId}/decision`, decision === "APPROVED" ? { decision, checklist: checked, note: note || undefined } : { decision, reason, checklist: checked });
      router.refresh();
      setMode(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the decision");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card">
      <CardHeader><CardTitle className="text-base">Decision</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {status === "REJECTED" && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Changes were requested. {name} has been told what to fix and can resubmit. You can still decide now.</p>}

        <fieldset className="space-y-2">
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Verification checks</legend>
          {checklist.map((c) => (
            <label key={c.key} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-foreground" checked={Boolean(checked[c.key])} onChange={(e) => setChecked((s) => ({ ...s, [c.key]: e.target.checked }))} />
              <span>{c.label}</span>
            </label>
          ))}
        </fieldset>

        {blockers.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warning/50 bg-warning/10 p-3 text-xs">
            {blockers.map((b) => <li key={b}>• {b}</li>)}
          </ul>
        )}

        {mode === null && (
          <div className="grid gap-2">
            <Button className="rounded-lg bg-foreground text-background" disabled={!allChecked || blockers.length > 0} onClick={() => setMode("approve")}>
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
            </Button>
            <Button variant="outline" className="rounded-lg" onClick={() => setMode("reject")}>
              <XCircle className="mr-2 h-4 w-4" /> Request changes
            </Button>
            {!allChecked && <p className="text-xs text-muted-foreground">Tick every check to enable approval.</p>}
          </div>
        )}

        {mode === "approve" && (
          <div className="space-y-3">
            <p className="text-sm">Approving gives {name} full access to their professional account.</p>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note (optional, not shown to the applicant)" className="min-h-20 rounded-lg" maxLength={1000} />
            <div className="flex gap-2">
              <Button className="flex-1 rounded-lg bg-foreground text-background" disabled={busy} onClick={() => submit("APPROVED")}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Confirm approval
              </Button>
              <Button variant="ghost" className="rounded-lg" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {mode === "reject" && (
          <div className="space-y-3">
            <p className="text-sm">Tell {name} what to fix. They will see this and can resubmit.</p>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map((r) => (
                <button key={r} type="button" onClick={() => setReason((cur) => (cur ? `${cur}\n${r}` : r))} className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted">
                  + {r}
                </button>
              ))}
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What needs to change?" className="min-h-28 rounded-lg" maxLength={1000} aria-label="Reason" />
            <div className="flex gap-2">
              <Button variant="destructive" className="flex-1 rounded-lg" disabled={busy || reason.trim().length < 10} onClick={() => submit("REJECTED")}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send to applicant
              </Button>
              <Button variant="ghost" className="rounded-lg" disabled={busy} onClick={() => setMode(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
      </CardContent>
    </Card>
  );
}
