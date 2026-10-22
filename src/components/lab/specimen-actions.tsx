"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

async function request(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/** Register a specimen against a lab order (accession number is assigned server-side). */
export function RegisterSpecimenForm() {
  const router = useRouter();
  const [labOrderId, setLabOrderId] = useState("");
  const [specimenType, setSpecimenType] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!labOrderId.trim()) return setError("Paste the laboratory order ID");
    setBusy(true);
    try {
      await request("/api/facility/specimens", "POST", {
        labOrderId: labOrderId.trim(),
        specimenType: specimenType || undefined,
      });
      setLabOrderId(""); setSpecimenType("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="labOrderId">Laboratory order ID *</Label>
          <Input id="labOrderId" value={labOrderId} onChange={(e) => setLabOrderId(e.target.value)} placeholder="Paste the order identifier" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="specimenType">Specimen type</Label>
          <Input id="specimenType" value={specimenType} onChange={(e) => setSpecimenType(e.target.value)} placeholder="e.g. Venous blood" />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register specimen
      </Button>
    </form>
  );
}

/** Specimen processing actions with reason capture for rejections (Module 02, Category 02). */
export function SpecimenActions({ specimenId, status }: { specimenId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const act = async (action: string, withReason?: string) => {
    setError(null);
    setBusy(true);
    try {
      await request(`/api/facility/specimens/${specimenId}`, "PATCH", { action, ...(withReason ? { reason: withReason } : {}) });
      setRejecting(false);
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
        {status === "PENDING_COLLECTION" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("COLLECT")}>Mark collected</Button>
        )}
        {status === "COLLECTED" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("RECEIVE")}>Mark received</Button>
        )}
        {status === "RECEIVED" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("PROCESS")}>Mark processed</Button>
        )}
        {(status === "PENDING_COLLECTION" || status === "COLLECTED" || status === "RECEIVED") && (
          <Button size="sm" variant="destructive" disabled={busy} onClick={() => setRejecting((v) => !v)}>Reject</Button>
        )}
        {status === "REJECTED" && (
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("REQUEST_RECOLLECTION")}>Request recollection</Button>
        )}
      </div>
      {rejecting && (
        <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
          <Label htmlFor={`reason-${specimenId}`}>Rejection reason (required)</Label>
          <Textarea id={`reason-${specimenId}`} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
          <Button size="sm" variant="destructive" disabled={busy || !reason.trim()} onClick={() => act("REJECT", reason)}>
            Confirm rejection
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
