"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient, ApiError } from "@/lib/api-client";

export interface OrderPrefill {
  orderId: string;
  patient: { id: string; name: string; caseNumber: string };
  tests: { code: string; name: string; unit: string | null; refLow: number | null; refHigh: number | null }[];
}

interface Row {
  code: string;
  name: string;
  value: string;
  unit: string;
  refLow: string;
  refHigh: string;
}

const field = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";
const CATEGORIES = ["Blood", "Urine", "Stool", "Swab", "XRay", "CT", "Ultrasound", "MRI", "Other"];
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,application/dicom";

const emptyRow = (): Row => ({ code: "", name: "", value: "", unit: "", refLow: "", refHigh: "" });

/** Enter lab results for a patient and attach scanned reports or images. */
export function ResultEntryForm({ prefill }: { prefill: OrderPrefill | null }) {
  const router = useRouter();
  const [patient, setPatient] = useState<OrderPrefill["patient"] | null>(prefill?.patient ?? null);
  const [caseNumber, setCaseNumber] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [category, setCategory] = useState("Blood");
  const [labName, setLabName] = useState("");
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Row[]>(
    prefill
      ? prefill.tests.map((t) => ({ code: t.code, name: t.name, value: "", unit: t.unit ?? "", refLow: t.refLow?.toString() ?? "", refHigh: t.refHigh?.toString() ?? "" }))
      : [emptyRow()],
  );
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const lookup = async () => {
    setLookupError("");
    try {
      const p = await apiClient.get<{ id: string; name: string; caseNumber: string }>(`/lab/patients?caseNumber=${encodeURIComponent(caseNumber)}`);
      setPatient(p);
    } catch (e) {
      setPatient(null);
      setLookupError(e instanceof Error ? e.message : "Lookup failed");
    }
  };

  const update = (i: number, patch: Partial<Row>) => setRows((cur) => cur.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const uploadFile = async (resultId: string, file: File) => {
    const init = await apiClient.post<{ key: string; uploadUrl: string; headers: Record<string, string> }>(`/labs/${resultId}/files`, {
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
    });
    const put = await fetch(init.uploadUrl, { method: "PUT", headers: init.headers, body: file });
    if (!put.ok) throw new Error("Upload to storage failed");
    await apiClient.post(`/labs/${resultId}/files/confirm`, { key: init.key, fileName: file.name, mimeType: file.type });
  };

  const submit = async () => {
    if (!patient) return;
    setBusy(true);
    setError("");
    setLog([]);
    try {
      const filled = rows.filter((r) => r.name.trim() && r.value.trim());
      const res = await apiClient.post<{ labResultId: string }>("/labs/manual", {
        patientId: patient.id,
        labOrderId: prefill?.orderId,
        category,
        labName: labName || undefined,
        testDate,
        values: filled.map((r) => ({ ...r, code: r.code.trim() || r.name.trim().slice(0, 20).toUpperCase().replace(/\s+/g, "_") })),
      });
      setLog((l) => [...l, "Results saved."]);

      for (const file of files) {
        try {
          await uploadFile(res.labResultId, file);
          setLog((l) => [...l, `Attached ${file.name}`]);
        } catch (e) {
          const msg = e instanceof ApiError && e.status === 503 ? "File storage is not configured" : e instanceof Error ? e.message : "failed";
          setLog((l) => [...l, `Could not attach ${file.name}: ${msg}`]);
        }
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the results");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Card className="beeline-card">
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="font-semibold">Done</p>
          {log.map((line, i) => (
            <p key={i} className="text-muted-foreground">{line}</p>
          ))}
          <Button variant="outline" className="rounded-lg" onClick={() => router.push("/lab/orders")}>Back to orders</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Patient</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {patient ? (
            <p className="text-sm">
              <span className="font-medium">{patient.name}</span> <span className="text-muted-foreground">— {patient.caseNumber}</span>
              {!prefill && <button className="ml-3 text-xs underline" onClick={() => setPatient(null)}>Change</button>}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input className={field} placeholder="Case number, e.g. MC-7K3Q9XPD" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} />
                <Button type="button" variant="outline" className="rounded-lg" disabled={caseNumber.trim().length < 6} onClick={lookup}>Find</Button>
              </div>
              {lookupError && <p className="text-xs text-destructive">{lookupError}</p>}
            </>
          )}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Test details</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-muted-foreground">Category
            <select className={`${field} mt-1`} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">Laboratory
            <input className={`${field} mt-1`} value={labName} onChange={(e) => setLabName(e.target.value)} maxLength={200} />
          </label>
          <label className="text-xs text-muted-foreground">Test date
            <input type="date" className={`${field} mt-1`} value={testDate} onChange={(e) => setTestDate(e.target.value)} />
          </label>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Values</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_auto]">
              <input className={field} placeholder="Test name" value={r.name} onChange={(e) => update(i, { name: e.target.value })} />
              <input className={field} placeholder="Result" value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
              <input className={field} placeholder="Unit" value={r.unit} onChange={(e) => update(i, { unit: e.target.value })} />
              <input className={field} placeholder="Ref low" value={r.refLow} onChange={(e) => update(i, { refLow: e.target.value })} />
              <input className={field} placeholder="Ref high" value={r.refHigh} onChange={(e) => update(i, { refHigh: e.target.value })} />
              <Button type="button" variant="outline" size="sm" className="rounded-lg" aria-label="Remove row" onClick={() => setRows((cur) => cur.filter((_, idx) => idx !== i))}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="rounded-lg" onClick={() => setRows((cur) => [...cur, emptyRow()])}>
            <Plus className="mr-1 h-4 w-4" /> Add value
          </Button>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Attach files (optional)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <input type="file" multiple accept={ACCEPT} onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))} className="text-sm" />
          <p className="text-xs text-muted-foreground">PDF, PNG, JPEG, WebP or DICOM, up to 15 MB each.</p>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {log.map((line, i) => <p key={i} className="text-xs text-muted-foreground">{line}</p>)}
      <Button className="w-full bg-foreground text-background rounded-lg" disabled={busy || !patient || rows.every((r) => !r.name.trim() || !r.value.trim())} onClick={submit}>
        {busy ? "Saving…" : "Submit results"}
      </Button>
    </div>
  );
}
