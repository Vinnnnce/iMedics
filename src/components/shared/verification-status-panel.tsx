"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiClient } from "@/lib/api-client";
import { uploadVerificationDocument } from "@/lib/verification-upload";

interface Application {
  type: "DOCTOR" | "FACILITY";
  status: "PENDING" | "VERIFIED" | "REJECTED";
  feedback: { reason: string | null; at: string } | null;
  documents: { id: string; kind: string; kindLabel: string; fileName: string; sizeBytes: number; createdAt: string }[];
  missingRequired: { kind: string; label: string }[];
  kinds: { kind: string; label: string }[];
}

const MAX_BYTES = 15 * 1024 * 1024;
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

/** What an applicant sees while waiting: status, the reviewer's feedback, documents, and a way to fix and resubmit. */
export function VerificationStatusPanel() {
  const [application, setApplication] = useState<Application | null | undefined>(undefined);
  const [kind, setKind] = useState("OTHER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const data = await apiClient.get<{ application: Application | null }>("/me/verification");
    setApplication(data.application);
  }, []);

  useEffect(() => {
    let active = true;
    apiClient
      .get<{ application: Application | null }>("/me/verification")
      .then((d) => active && setApplication(d.application))
      .catch(() => active && setApplication(null));
    return () => {
      active = false;
    };
  }, []);

  if (application === undefined) return <p className="text-sm text-muted-foreground">Loading your application…</p>;
  if (!application) return null;

  const editable = application.status !== "VERIFIED";

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_BYTES) return setError("That file is larger than 15 MB.");
    if (!["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) return setError("Only PDF, JPG, PNG or WebP files are allowed.");
    setBusy(true);
    try {
      await uploadVerificationDocument(file, kind);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await apiClient.delete(`/me/documents/${id}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not remove the document");
    } finally {
      setBusy(false);
    }
  };

  const resubmit = async () => {
    setBusy(true);
    setError("");
    try {
      await apiClient.post("/me/verification/resubmit");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resubmit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="beeline-card text-left">
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <span className="text-sm text-muted-foreground">Application status</span>
          {application.status === "PENDING" && (
            <Badge className="rounded-lg bg-foreground/10 text-foreground">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" /> Under review
            </Badge>
          )}
          {application.status === "REJECTED" && <Badge variant="destructive" className="rounded-lg">Changes requested</Badge>}
          {application.status === "VERIFIED" && <Badge variant="success" className="rounded-lg">Verified</Badge>}
        </div>

        {application.status === "REJECTED" && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm" role="alert">
            <p className="font-medium">What to fix</p>
            <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{application.feedback?.reason || "The reviewer did not leave a note. Please check your documents and resubmit."}</p>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Documents</p>
          {application.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>}
          {application.documents.map((d) => (
            <div key={d.id} className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.kindLabel}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {d.fileName} · {kb(d.sizeBytes)}
                </p>
              </div>
              {editable && (
                <button type="button" disabled={busy} onClick={() => remove(d.id)} aria-label={`Remove ${d.fileName}`} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
          {application.missingRequired.length > 0 && editable && (
            <p className="text-xs text-muted-foreground">Still needed: {application.missingRequired.map((m) => m.label).join(", ")}</p>
          )}
        </div>

        {editable && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-9 flex-1 rounded-lg border border-input bg-background px-2 text-sm" aria-label="Document type">
              {application.kinds.map((k) => (
                <option key={k.kind} value={k.kind}>
                  {k.label}
                </option>
              ))}
            </select>
            <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }} />
            <Button type="button" variant="outline" className="rounded-lg" disabled={busy} onClick={() => input.current?.click()}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Add document
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {application.status === "REJECTED" && (
          <Button className="w-full rounded-lg bg-foreground text-background" disabled={busy || application.documents.length === 0} onClick={resubmit}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Resubmit for review
          </Button>
        )}
        {application.status === "PENDING" && (
          <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
            Our team will check your credentials and documents. You will be notified by email when there is a decision. This usually takes 1 to 3 business days.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
