"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/shared/form-field";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, Skeleton } from "@/components/shared/async-state";
import type { WorkspaceDocument, WorkspaceShare } from "@/lib/workspace/types";
import { Panel, apiClient, useDashboardMutation } from "./common";

export function DocumentsPanel({ ready, recipient = false }: { ready: boolean; recipient?: boolean }) {
  const [documents, setDocuments] = useState<WorkspaceDocument[]>([]), [shares, setShares] = useState<WorkspaceShare[]>([]);
  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(ready), [error, setError] = useState(""), [uploading, setUploading] = useState(false);
  const mutation = useDashboardMutation();
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/workspace/documents", { cache: "no-store", signal });
    if (!response.ok) throw new Error("Records could not be loaded.");
    const data = await response.json() as { documents: WorkspaceDocument[]; shares: WorkspaceShare[] };
    setDocuments(data.documents); setShares(data.shares);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal)).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [load, ready]);
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, file = new FormData(form).get("file") as File;
    if (!file?.size || file.size > 15 * 1024 * 1024 || !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("Choose a PDF, PNG, JPEG, or WebP file up to 15 MB."); return;
    }
    setUploading(true);
    await mutation.run(async () => {
      const init = await apiClient.post<{ id: string; uploadUrl: string }>("/workspace/documents", { action: "initiate", fileName: file.name, mimeType: file.type, sizeBytes: file.size });
      const response = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": file.type }, body: file });
      if (!response.ok) throw new Error("Upload failed. No record was confirmed.");
      await apiClient.post("/workspace/documents", { action: "confirm", id: init.id });
      await load(); form.reset();
    }, "Document uploaded and verified"); setUploading(false);
  }
  async function share(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    await mutation.run(async () => {
      await apiClient.post("/workspace/documents", { action: "share", id: fields.get("document"), doctorId: fields.get("doctor"), days: Number(fields.get("days")), consent: fields.get("consent") === "on" });
      await load(); form.reset();
    }, "Time-limited record access granted");
  }
  return <Panel title={recipient ? "Documents explicitly shared with you" : "Medical records and sharing"}>
    {!ready ? <p role="status" className="text-sm text-muted-foreground">The existing workspace migration is required for private documents and consent controls.</p> : <>
      {loading && <Skeleton className="h-20 w-full" />}{error && <ErrorState detail={error} action={<Button variant="outline" onClick={() => void load().then(() => setError("")).catch(() => setError("Records could not be loaded."))}>Retry</Button>} />}{mutation.errorUI}
      {!loading && !documents.length && <EmptyState title={recipient ? "No documents shared yet" : "Your private record collection"} detail="Access is specific, time-limited, and revocable." />}
      <ul className="divide-y divide-border">{documents.map(document => <li key={document.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
        <div className="min-w-0"><p className="break-words text-sm font-medium">{document.file_name}</p><p className="text-xs text-muted-foreground">{Math.ceil(document.size_bytes / 1024)} KB</p></div>
        <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => {
          const tab = window.open("about:blank", "_blank");
          if (tab) tab.opener = null;
          void mutation.run(async () => {
            try {
              const data = await apiClient.get<{ url: string }>(`/workspace/documents?id=${document.id}`);
              if (!tab) throw new Error("Allow this document window and try again.");
              tab.location.replace(data.url);
            } catch (e) { tab?.close(); throw e; }
          }, "Private download opened");
        }}>Download</Button>
      </li>)}</ul>
      {!recipient && <>
        <form onSubmit={upload} className="space-y-3 border-t border-border pt-4"><FormField label="Upload a record" required hint="PDF or image, up to 15 MB. Nothing is shared automatically.">
          <Input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" required disabled={uploading} />
        </FormField><Button type="submit" variant="outline" disabled={mutation.busy || uploading}>{uploading ? "Uploading and verifying…" : "Upload securely"}</Button></form>
        <details className="rounded-lg border border-border p-3" onToggle={event => {
          if (event.currentTarget.open && !doctors.length) void apiClient.get<{ doctors: typeof doctors }>("/doctors?limit=50").then(data => setDoctors(data.doctors)).catch(() => setError("Could not load verified doctors."));
        }}><summary className="cursor-pointer text-sm font-medium">Share a document with a verified doctor</summary>
          <form className="mt-4 space-y-3" onSubmit={share}>
            <label className="block space-y-2 text-sm">Document<select name="document" required className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Select document</option>{documents.map(document => <option key={document.id} value={document.id}>{document.file_name}</option>)}</select></label>
            <label className="block space-y-2 text-sm">Verified doctor<select name="doctor" required className="block h-10 w-full rounded-lg border border-input bg-background px-2"><option value="">Select doctor</option>{doctors.map(doctor => <option key={doctor.id} value={doctor.id}>{doctor.name}</option>)}</select></label>
            <label className="block space-y-2 text-sm">Access duration<select name="days" className="block h-10 w-full rounded-lg border border-input bg-background px-2">{[1, 7, 30].map(days => <option key={days} value={days}>{days} days</option>)}</select></label>
            <label className="flex gap-2 text-sm"><input name="consent" type="checkbox" required />I explicitly consent to sharing only this document with this doctor.</label>
            <Button variant="outline" type="submit" disabled={mutation.busy || !documents.length || !doctors.length}>Grant access</Button>
          </form>
        </details>
        <h3 className="text-sm font-semibold">Active and previous consent grants</h3>
        {!shares.length && <p className="text-sm text-muted-foreground">No records are shared.</p>}
        {shares.map(share => <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3" key={share.id}>
          <div><p className="text-sm font-medium">{share.recipient_name}</p><p className="text-xs text-muted-foreground">{share.revoked_at ? "Revoked" : `Expires ${new Date(share.expires_at).toLocaleString()}`}</p></div>
          {!share.revoked_at && <Button size="sm" variant="outline" disabled={mutation.busy} onClick={() => void mutation.run(async () => {
            await apiClient.post("/workspace/documents", { action: "revoke", shareId: share.id }); await load();
          }, "Access revoked. Previously issued links expire within 60 seconds.")}>Revoke access</Button>}
        </div>)}
      </>}
    </>}
  </Panel>;
}
