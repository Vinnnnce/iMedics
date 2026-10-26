"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PRIORITY_LABEL, STATUS_LABEL, TYPE_LABEL, BOARDS } from "@/lib/his/encounters";
import { api, inputClass } from "./use-api";

interface Row { id: string; encounterNumber: string; type: keyof typeof TYPE_LABEL; priority: keyof typeof PRIORITY_LABEL; status: keyof typeof STATUS_LABEL; department: string | null; clinicianName: string | null; triageCategory: string | null; payerCategory: string | null; minutesSinceRegistration: number; minutesSinceUpdate: number; overdue: boolean; patient: { id: string; caseNumber: string; firstName: string; lastName: string } }

/** Live operational queues: priority-sorted, filterable, with overdue indicators and workflow controls. */
export function EncounterBoard({ initialBoard, triageCategories, triageProtocol }: { initialBoard: string; triageCategories: string[]; triageProtocol: string | null }) {
  const [board, setBoard] = useState(initialBoard);
  const [filters, setFilters] = useState({ department: "", clinician: "", payer: "", triageCategory: "" });
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ caseNumber: "", dateOfBirth: "", type: "SCHEDULED_OUTPATIENT", priority: "ROUTINE", department: "", clinicianName: "", chiefComplaint: "" });
  const load = useCallback(async () => {
    setError(null);
    const qs = new URLSearchParams({ board, ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
    try { const data = await api<{ encounters: Row[] }>(`/api/facility/his/encounters?${qs}`); setRows(data.encounters); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setRows([]); }
  }, [board, filters]);
  useEffect(() => { const first = setTimeout(() => void load(), 0); const t = setInterval(load, 60_000); return () => { clearTimeout(first); clearInterval(t); }; }, [load]);
  const patch = async (id: string, body: Record<string, unknown>) => { try { await api(`/api/facility/his/encounters/${id}`, { method: "PATCH", body }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); } };

  return (
    <div className="space-y-4">
      <details className="rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-sm font-semibold">Register encounter</summary>
        <form className="mt-3 grid gap-2 sm:grid-cols-3" onSubmit={async (e) => { e.preventDefault(); try { await api("/api/facility/his/encounters", { body: { ...form, department: form.department || undefined, clinicianName: form.clinicianName || undefined, chiefComplaint: form.chiefComplaint || undefined } }); setForm({ ...form, caseNumber: "", dateOfBirth: "", chiefComplaint: "" }); await load(); } catch (err) { setError(err instanceof Error ? err.message : "Failed"); } }}>
          <label className="text-xs">Case number<input required className={inputClass} value={form.caseNumber} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} data-testid="input-enc-case" /></label>
          <label className="text-xs">Date of birth<input required type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} data-testid="input-enc-dob" /></label>
          <label className="text-xs">Encounter type<select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs">Care priority (administrative)<select className={inputClass} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="text-xs">Department<input className={inputClass} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></label>
          <label className="text-xs">Clinician<input className={inputClass} value={form.clinicianName} onChange={(e) => setForm({ ...form, clinicianName: e.target.value })} /></label>
          <label className="text-xs sm:col-span-2">Chief complaint<input className={inputClass} value={form.chiefComplaint} onChange={(e) => setForm({ ...form, chiefComplaint: e.target.value })} /></label>
          <Button type="submit" className="self-end" data-testid="button-register-encounter">Register</Button>
        </form>
      </details>
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Dashboards">
        {BOARDS.map((b) => <Button key={b} size="sm" role="tab" aria-selected={board === b} variant={board === b ? "default" : "outline"} onClick={() => setBoard(b)}>{b[0].toUpperCase() + b.slice(1)}</Button>)}
      </div>
      <div className="grid gap-2 text-sm sm:grid-cols-4">
        <input className={inputClass} placeholder="Department" value={filters.department} onChange={(e) => setFilters({ ...filters, department: e.target.value })} aria-label="Filter department" />
        <input className={inputClass} placeholder="Clinician" value={filters.clinician} onChange={(e) => setFilters({ ...filters, clinician: e.target.value })} aria-label="Filter clinician" />
        <select className={inputClass} value={filters.payer} onChange={(e) => setFilters({ ...filters, payer: e.target.value })} aria-label="Filter payer"><option value="">Any payer</option>{["PUBLIC_INSURANCE", "PRIVATE_INSURANCE", "EMPLOYER_SPONSORED", "GOVERNMENT_SUBSIDIZED", "INTERNATIONAL_INSURANCE", "TRAVEL_INSURANCE", "SELF_PAY", "UNINSURED", "CHARITY", "OTHER"].map((p) => <option key={p}>{p}</option>)}</select>
        <select className={inputClass} value={filters.triageCategory} onChange={(e) => setFilters({ ...filters, triageCategory: e.target.value })} aria-label="Filter triage"><option value="">Any triage category</option>{triageCategories.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {!triageProtocol && <p className="text-xs text-muted-foreground">No approved triage protocol configured — triage categories are disabled until one is set in Hospital settings. Care priority is administrative, not a clinical triage decision.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {rows === null ? <p className="text-sm text-muted-foreground">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground" data-testid="text-no-encounters">No patients on this dashboard.</p> : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Patient</th><th className="p-2">Priority / type</th><th className="p-2">Status</th><th className="p-2">Waiting</th><th className="p-2">Actions</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.overdue ? "bg-red-50 dark:bg-red-950/30" : ""}`} data-testid={`row-encounter-${r.encounterNumber}`}>
                <td className="p-2"><Link href={`/lab/patients/${r.patient.id}`} className="font-medium hover:underline">{r.patient.firstName} {r.patient.lastName}</Link><div className="text-xs text-muted-foreground">{r.patient.caseNumber} · {r.encounterNumber}{r.department ? ` · ${r.department}` : ""}{r.clinicianName ? ` · ${r.clinicianName}` : ""}</div></td>
                <td className="p-2"><strong>{PRIORITY_LABEL[r.priority]}</strong><div className="text-xs">{TYPE_LABEL[r.type]}{r.triageCategory ? ` · triage ${r.triageCategory}` : ""}{r.payerCategory ? ` · ${r.payerCategory}` : ""}</div></td>
                <td className="p-2">{STATUS_LABEL[r.status]}</td>
                <td className="p-2 text-xs">{r.minutesSinceRegistration} min since registration<br />{r.minutesSinceUpdate} min since update{r.overdue ? <strong className="block text-red-700">Overdue</strong> : null}</td>
                <td className="space-y-1 p-2">
                  <select className="h-8 w-full rounded border text-xs" aria-label="Move to status" value="" onChange={(e) => e.target.value && patch(r.id, { status: e.target.value })}><option value="">Move to…</option>{Object.entries(STATUS_LABEL).filter(([k]) => k !== r.status).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  <select className="h-8 w-full rounded border text-xs" aria-label="Change priority" value="" onChange={(e) => e.target.value && patch(r.id, { priority: e.target.value })}><option value="">Priority…</option>{Object.entries(PRIORITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  {triageCategories.length > 0 && <select className="h-8 w-full rounded border text-xs" aria-label="Triage category" value="" onChange={(e) => e.target.value && patch(r.id, { triageCategory: e.target.value })}><option value="">Triage ({triageProtocol})…</option>{triageCategories.map((t) => <option key={t}>{t}</option>)}</select>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
