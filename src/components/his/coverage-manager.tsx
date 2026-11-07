"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass } from "./use-api";

const CATEGORIES = ["PUBLIC_INSURANCE", "PRIVATE_INSURANCE", "EMPLOYER_SPONSORED", "GOVERNMENT_SUBSIDIZED", "INTERNATIONAL_INSURANCE", "TRAVEL_INSURANCE", "SELF_PAY", "UNINSURED", "CHARITY", "OTHER"];
const FILTERS = ["all", "insured", "uninsured", "pending", "authorization", "rejected", "selfpay"];
interface Coverage { id: string; category: string; rank: number; providerName: string | null; memberNumber: string | null; eligibility: string; claimStatus: string; preauthRequired: boolean; authorizationNumber: string | null; coverageEnd: string | null; patient: { id: string; caseNumber: string; firstName: string; lastName: string } }

/** Payer classification: record coverage after identity verification, verify eligibility, end/move classifications. */
export function CoverageManager({ initialFilter }: { initialFilter: string }) {
  const [filter, setFilter] = useState(initialFilter);
  const [rows, setRows] = useState<Coverage[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [patient, setPatient] = useState<IdentifiedPatient | null>(null);
  const [form, setForm] = useState({ category: "PRIVATE_INSURANCE", rank: 1, providerName: "", memberNumber: "", coverageEnd: "", preauthRequired: false });
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const d = await api<{ coverages: Coverage[]; counts: Record<string, number> }>(`/api/facility/his/coverage?filter=${filter}`); setRows(d.coverages); setCounts(d.counts); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setRows([]); }
  }, [filter]);
  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);
  const run = async (fn: () => Promise<unknown>) => { setError(null); try { await fn(); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">{CATEGORIES.map((c) => <div key={c} className="rounded-lg border bg-card p-2"><p className="text-lg font-bold">{counts[c] ?? 0}</p>{c}</div>)}</div>
      <details className="rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold">Record a classification</summary>
        <div className="mt-3 space-y-2">
          {patient ? <p className="text-sm">{patient.firstName} {patient.lastName} · {patient.caseNumber} <button className="text-xs underline" onClick={() => setPatient(null)}>change</button></p> : <PatientIdentify onFound={setPatient} />}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Payer category<select className={inputClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="text-xs">Rank<select className={inputClass} value={form.rank} onChange={(e) => setForm({ ...form, rank: Number(e.target.value) })}><option value={1}>Primary</option><option value={2}>Secondary</option></select></label>
            <label className="text-xs">Insurance provider<input className={inputClass} value={form.providerName} onChange={(e) => setForm({ ...form, providerName: e.target.value })} /></label>
            <label className="text-xs">Policy / member number<input className={inputClass} value={form.memberNumber} onChange={(e) => setForm({ ...form, memberNumber: e.target.value })} /></label>
            <label className="text-xs">Coverage end<input type="date" className={inputClass} value={form.coverageEnd} onChange={(e) => setForm({ ...form, coverageEnd: e.target.value })} /></label>
            <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form.preauthRequired} onChange={(e) => setForm({ ...form, preauthRequired: e.target.checked })} /> Preauthorization required</label>
          </div>
          <Button size="sm" disabled={!patient} onClick={() => run(() => api("/api/facility/his/coverage", { body: { patientId: patient!.id, category: form.category, rank: form.rank, providerName: form.providerName || null, memberNumber: form.memberNumber || null, coverageEnd: form.coverageEnd || null, preauthRequired: form.preauthRequired } }))} data-testid="button-save-coverage">Save classification</Button>
          <p className="text-xs text-muted-foreground">Coverage is never inferred from demographics. To move a patient to another classification, end the current one and record the new one — encounters keep the payer that applied at the time.</p>
        </div>
      </details>
      <div className="flex flex-wrap gap-1">{FILTERS.map((f) => <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>{f}</Button>)}</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No patients in this view.</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
          <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Patient</th><th className="p-2">Payer</th><th className="p-2">Eligibility / claim</th><th className="p-2">Actions</th></tr></thead>
          <tbody>{rows.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2"><Link className="hover:underline" href={`/lab/patients/${c.patient.id}`}>{c.patient.firstName} {c.patient.lastName}</Link><div className="text-xs text-muted-foreground">{c.patient.caseNumber}</div></td>
              <td className="p-2">{c.category} {c.rank === 2 ? "(secondary)" : ""}<div className="text-xs text-muted-foreground">{c.providerName ?? ""} {c.memberNumber ?? ""}{c.preauthRequired ? ` · preauth ${c.authorizationNumber ?? "MISSING"}` : ""}</div></td>
              <td className="p-2 text-xs">{c.eligibility} · {c.claimStatus}</td>
              <td className="space-x-1 p-2">
                <select className="h-8 rounded border text-xs" aria-label="Record verification" value="" onChange={(e) => e.target.value && run(() => api(`/api/facility/his/coverage/${c.id}`, { method: "PATCH", body: { action: "verify", eligibility: e.target.value } }))}><option value="">Verify…</option>{["PENDING", "VERIFIED", "REJECTED", "EXPIRED"].map((x) => <option key={x}>{x}</option>)}</select>
                <select className="h-8 rounded border text-xs" aria-label="Claim status" value="" onChange={(e) => e.target.value && run(() => api(`/api/facility/his/coverage/${c.id}`, { method: "PATCH", body: { action: "verify", eligibility: c.eligibility, claimStatus: e.target.value } }))}><option value="">Claim…</option>{["SUBMITTED", "IN_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "PAID"].map((x) => <option key={x}>{x}</option>)}</select>
                <Button size="xs" variant="ghost" onClick={() => { const r = window.prompt("Reason for ending this classification"); if (r) void run(() => api(`/api/facility/his/coverage/${c.id}`, { method: "PATCH", body: { action: "end", reason: r } })); }}>End</Button>
              </td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}
