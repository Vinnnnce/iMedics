"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiClient } from "@/lib/api-client";

export interface CredentialRow {
  id: string;
  type: string;
  number: string;
  authority: string;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  verifiedAt: string | null;
  restrictions: string | null;
  renewalStatus: string;
  expiryState: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";
  staff: { id: string; fullName: string; facilityRole: string; status: string };
}

interface StaffOption { id: string; fullName: string }

const TYPE_LABEL: Record<string, string> = {
  MEDICAL_LICENCE: "Medical licence", NURSING_LICENCE: "Nursing licence",
  LAB_SCIENTIST_REGISTRATION: "Lab scientist registration", RADIOGRAPHER_LICENCE: "Radiographer licence",
  PROFESSIONAL_CERTIFICATION: "Professional certification", TRAINING_CERTIFICATE: "Training certificate",
};
const VERIFICATION_LABEL: Record<string, string> = {
  UNVERIFIED: "Unverified", PENDING_VERIFICATION: "Verification pending", VERIFIED: "Verified", REJECTED: "Rejected",
};
const select = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

/** Record and track staff credentials with expiry states. */
export function CredentialsManager({ credentials, staff }: { credentials: CredentialRow[]; staff: StaffOption[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ staffId: staff[0]?.id ?? "", type: "MEDICAL_LICENCE", number: "", authority: "", issueDate: "", expiryDate: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(""); setSuccess(""); setBusy(true);
    try {
      await apiClient.post("/facility/credentials", {
        staffId: form.staffId, type: form.type, number: form.number, authority: form.authority,
        issueDate: form.issueDate || null, expiryDate: form.expiryDate || null,
      });
      setSuccess("Credential recorded.");
      setForm((f) => ({ ...f, number: "", authority: "", issueDate: "", expiryDate: "" }));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the credential");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this credential record?")) return;
    setBusy(true); setError("");
    try {
      await apiClient.delete(`/facility/credentials/${id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove the credential");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" className="text-sm text-emerald-600">{success}</p>}

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Record a credential</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="cred-staff">Staff member</Label>
                <select id="cred-staff" className={select} required value={form.staffId} onChange={(e) => setForm((f) => ({ ...f, staffId: e.target.value }))}>
                  {staff.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-type">Type</Label>
                <select id="cred-type" className={select} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-number">Credential number</Label>
                <Input id="cred-number" required maxLength={80} value={form.number} onChange={(e) => setForm((f) => ({ ...f, number: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-authority">Issuing authority</Label>
                <Input id="cred-authority" required maxLength={160} value={form.authority} onChange={(e) => setForm((f) => ({ ...f, authority: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-issue">Issue date</Label>
                <Input id="cred-issue" type="date" value={form.issueDate} onChange={(e) => setForm((f) => ({ ...f, issueDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cred-expiry">Expiry date</Label>
                <Input id="cred-expiry" type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <Button type="submit" disabled={busy || staff.length === 0}>{busy ? "Saving…" : "Record credential"}</Button>
            {staff.length === 0 && <p className="text-xs text-muted-foreground">Add a staff member first.</p>}
          </form>
        </CardContent>
      </Card>

      {credentials.length === 0 && <p className="text-sm text-muted-foreground">No credentials recorded yet.</p>}

      {credentials.map((c) => (
        <Card key={c.id} className="beeline-card">
          <CardContent className="space-y-2 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">{TYPE_LABEL[c.type] ?? c.type} · {c.staff.fullName}</p>
                <p className="text-xs text-muted-foreground">{c.authority} · № {c.number}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-lg text-xs">{VERIFICATION_LABEL[c.verificationStatus] ?? c.verificationStatus}</Badge>
                {c.expiryState === "EXPIRED" && <Badge variant="destructive" className="rounded-lg text-xs">Expired</Badge>}
                {c.expiryState === "EXPIRING_SOON" && <Badge variant="secondary" className="rounded-lg text-xs text-amber-600">Expiring soon</Badge>}
                {c.expiryState === "UNKNOWN" && <Badge variant="outline" className="rounded-lg text-xs">No expiry date</Badge>}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <p>
                {c.expiryDate ? `Expires ${new Date(c.expiryDate).toLocaleDateString()}` : "No expiry on record"}
                {c.issueDate ? ` · issued ${new Date(c.issueDate).toLocaleDateString()}` : ""}
              </p>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(c.id)}>Remove</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
