"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass, textareaClass } from "./use-api";

interface QueueRow {
  id: string;
  encounterNumber: string;
  status: string;
  priority: string;
  triageCategory: string | null;
  arrivalMode: string | null;
  presentingComplaint: string | null;
  clinicianName: string | null;
  department: string | null;
  reassessmentDueAt: string | null;
  temporaryLabel: string | null;
  registeredAt: string;
  minutesWaiting: number;
  patient: { id: string; caseNumber: string; firstName: string; lastName: string; unidentified: boolean };
}

interface BoardData {
  queue: QueueRow[];
  kpis: {
    active: number;
    critical: number;
    awaitingTriage: number;
    overdueReassessment: number;
    ambulanceLastHour: number;
    admissionsPending: number;
  };
  beds: { available: number; occupied: number; reserved: number; cleaning: number; maintenance: number; isolation: number };
}

interface Vitals {
  temperature: string;
  pulse: string;
  bloodPressure: string;
  respiratoryRate: string;
  spo2: string;
}

const STATUSES = ["AWAITING_TRIAGE", "TRIAGED", "AWAITING_CLINICIAN", "UNDER_ASSESSMENT", "AWAITING_INVESTIGATIONS", "AWAITING_TREATMENT", "AWAITING_ADMISSION", "ADMITTED", "AWAITING_DISCHARGE", "DISCHARGED"];

const STATUS_LABEL: Record<string, string> = {
  AWAITING_TRIAGE: "Awaiting triage", TRIAGED: "Triaged", AWAITING_CLINICIAN: "Awaiting clinician",
  UNDER_ASSESSMENT: "Under assessment", AWAITING_INVESTIGATIONS: "Awaiting investigations",
  AWAITING_TREATMENT: "Awaiting treatment", AWAITING_ADMISSION: "Awaiting admission",
  ADMITTED: "Admitted", AWAITING_DISCHARGE: "Awaiting discharge", DISCHARGED: "Discharged",
};

const ARRIVAL_LABEL: Record<string, string> = {
  AMBULANCE: "Ambulance", WALK_IN: "Walk-in", REFERRAL: "Referral", TRANSFER: "Transfer",
};

/** Beeline-inspired KPI card: rounded, roomy, colored accent. */
function KpiCard({ label, value, accent, hint }: { label: string; value: number | string; accent: string; hint?: string }) {
  return (
    <Card className={`rounded-2xl border-l-4 ${accent}`}>
      <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

/** The clinical Emergency Department board. */
export function EmergencyDepartment({ triageCategories }: { triageCategories: string[]; triageProtocol: string | null }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);

  const [form, setForm] = useState({
    mode: "EXISTING" as "EXISTING" | "UNIDENTIFIED",
    caseNumber: "", dateOfBirth: "", temporaryLabel: "",
    arrivalMode: "WALK_IN", presentingComplaint: "", knownAllergies: "",
  });
  const [vitals, setVitals] = useState<Vitals>({ temperature: "", pulse: "", bloodPressure: "", respiratoryRate: "", spo2: "" });
  const [reconcileForm, setReconcileForm] = useState({ temporaryPatientId: "", caseNumber: "", dateOfBirth: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api<BoardData>("/api/facility/his/emergency");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(load, 30_000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, [load]);

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    const cleanedVitals = Object.fromEntries(Object.entries(vitals).filter(([, v]) => v !== ""));
    try {
      const res = await api<{ encounter: { encounterNumber: string } }>("/api/facility/his/emergency", {
        body: {
          ...form,
          caseNumber: form.caseNumber || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          temporaryLabel: form.temporaryLabel || undefined,
          presentingComplaint: form.presentingComplaint || undefined,
          knownAllergies: form.knownAllergies || undefined,
          initialObservations: Object.keys(cleanedVitals).length > 0 ? cleanedVitals : undefined,
        },
      });
      setMessage(`Emergency encounter ${res.encounter.encounterNumber} registered.`);
      setForm({ ...form, caseNumber: "", dateOfBirth: "", temporaryLabel: "", presentingComplaint: "", knownAllergies: "" });
      setVitals({ temperature: "", pulse: "", bloodPressure: "", respiratoryRate: "", spo2: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const patchEncounter = async (id: string, body: Record<string, unknown>) => {
    setError(null); setMessage(null);
    try {
      await api(`/api/facility/his/emergency/${id}`, { method: "PATCH", body });
      setMessage("Encounter updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const reconcile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      await api("/api/facility/his/emergency/reconcile", { body: reconcileForm });
      setMessage("Temporary record reconciled with the patient's real record.");
      setReconcileForm({ temporaryPatientId: "", caseNumber: "", dateOfBirth: "" });
      setShowReconcile(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const unidentified = (data?.queue ?? []).filter((r) => r.patient.unidentified);

  return (
    <div className="space-y-4">
      {/* KPI overview */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Active emergency cases" value={data?.kpis.active ?? "…"} accent="border-l-red-500" />
        <KpiCard label="Critical" value={data?.kpis.critical ?? "…"} accent="border-l-red-600" />
        <KpiCard label="Awaiting triage" value={data?.kpis.awaitingTriage ?? "…"} accent="border-l-amber-500" />
        <KpiCard label="Reassessment overdue" value={data?.kpis.overdueReassessment ?? "…"} accent="border-l-orange-600" />
        <KpiCard label="Ambulance (last hour)" value={data?.kpis.ambulanceLastHour ?? "…"} accent="border-l-blue-500" />
        <KpiCard
          label="Beds available"
          value={data ? `${data.beds.available}` : "…"}
          accent="border-l-emerald-500"
          hint={data ? `${data.beds.occupied} occupied · ${data.beds.cleaning} cleaning · ${data.beds.isolation} isolation` : undefined}
        />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowRegister(!showRegister)} data-testid="button-ed-register">
          {showRegister ? "Close registration" : "New emergency registration"}
        </Button>
        {unidentified.length > 0 && (
          <Button variant="outline" onClick={() => setShowReconcile(!showReconcile)} data-testid="button-ed-reconcile">
            {showReconcile ? "Close reconciliation" : `Reconcile unidentified (${unidentified.length})`}
          </Button>
        )}
      </div>

      {/* Registration form */}
      {showRegister && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Rapid emergency registration</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={register} data-testid="form-ed-register">
              <div className="flex gap-2" role="tablist" aria-label="Patient identification">
                <Button type="button" size="sm" role="tab" aria-selected={form.mode === "EXISTING"} variant={form.mode === "EXISTING" ? "default" : "outline"} onClick={() => setForm({ ...form, mode: "EXISTING" })}>Existing patient</Button>
                <Button type="button" size="sm" role="tab" aria-selected={form.mode === "UNIDENTIFIED"} variant={form.mode === "UNIDENTIFIED" ? "default" : "outline"} onClick={() => setForm({ ...form, mode: "UNIDENTIFIED" })}>Unidentified patient</Button>
              </div>
              {form.mode === "EXISTING" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">Case number<input required className={inputClass} value={form.caseNumber} onChange={(e) => setForm({ ...form, caseNumber: e.target.value })} data-testid="input-ed-case" /></label>
                  <label className="text-xs">Date of birth<input required type="date" className={inputClass} value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} data-testid="input-ed-dob" /></label>
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="text-xs">Temporary label (e.g. John DOE #2)<input required className={inputClass} value={form.temporaryLabel} onChange={(e) => setForm({ ...form, temporaryLabel: e.target.value })} data-testid="input-ed-temp-label" /></label>
                </div>
              )}
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="text-xs">Arrival
                  <select className={inputClass} value={form.arrivalMode} onChange={(e) => setForm({ ...form, arrivalMode: e.target.value })} data-testid="select-ed-arrival">
                    {Object.entries(ARRIVAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="text-xs">Temperature (°C)<input inputMode="decimal" className={inputClass} value={vitals.temperature} onChange={(e) => setVitals({ ...vitals, temperature: e.target.value })} /></label>
                <label className="text-xs">Pulse (bpm)<input inputMode="numeric" className={inputClass} value={vitals.pulse} onChange={(e) => setVitals({ ...vitals, pulse: e.target.value })} /></label>
                <label className="text-xs">Blood pressure<input className={inputClass} placeholder="120/80" value={vitals.bloodPressure} onChange={(e) => setVitals({ ...vitals, bloodPressure: e.target.value })} /></label>
                <label className="text-xs">Respiratory rate<input inputMode="numeric" className={inputClass} value={vitals.respiratoryRate} onChange={(e) => setVitals({ ...vitals, respiratoryRate: e.target.value })} /></label>
                <label className="text-xs">SpO₂ (%)<input inputMode="numeric" className={inputClass} value={vitals.spo2} onChange={(e) => setVitals({ ...vitals, spo2: e.target.value })} /></label>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs">Presenting complaint<textarea className={textareaClass} rows={2} value={form.presentingComplaint} onChange={(e) => setForm({ ...form, presentingComplaint: e.target.value })} /></label>
                <label className="text-xs">Known allergies<textarea className={textareaClass} rows={2} value={form.knownAllergies} onChange={(e) => setForm({ ...form, knownAllergies: e.target.value })} /></label>
              </div>
              <Button type="submit" data-testid="button-ed-submit">Register emergency patient</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Reconciliation form */}
      {showReconcile && unidentified.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Reconcile an unidentified patient</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={reconcile} data-testid="form-ed-reconcile">
              <label className="text-xs">Temporary record
                <select required className={inputClass} value={reconcileForm.temporaryPatientId} onChange={(e) => setReconcileForm({ ...reconcileForm, temporaryPatientId: e.target.value })}>
                  <option value="">Select…</option>
                  {unidentified.map((r) => <option key={r.id} value={r.patient.id}>{r.patient.caseNumber} — {r.temporaryLabel ?? r.patient.lastName}</option>)}
                </select>
              </label>
              <label className="text-xs">Real case number<input required className={inputClass} value={reconcileForm.caseNumber} onChange={(e) => setReconcileForm({ ...reconcileForm, caseNumber: e.target.value })} /></label>
              <label className="text-xs">Date of birth<input required type="date" className={inputClass} value={reconcileForm.dateOfBirth} onChange={(e) => setReconcileForm({ ...reconcileForm, dateOfBirth: e.target.value })} /></label>
              <Button type="submit" className="sm:col-span-3">Reconcile records</Button>
            </form>
            <p className="mt-2 text-xs text-muted-foreground">All clinical activity recorded under the temporary record moves to the patient&#39;s real record. The temporary record is retired, never deleted.</p>
          </CardContent>
        </Card>
      )}

      {error && <p role="alert" className="text-sm text-destructive" data-testid="text-ed-error">{error}</p>}
      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-ed-message">{message}</p>}
      {triageCategories.length === 0 && (
        <p className="text-xs text-muted-foreground">No approved triage protocol configured. Triage categories are disabled until one is set in Hospital settings.</p>
      )}

      {/* Live queue */}
      {data === null ? (
        <p className="text-sm text-muted-foreground">Loading emergency board…</p>
      ) : data.queue.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No active emergency cases right now.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm" data-testid="table-ed-queue">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-3">Patient</th><th className="p-3">Arrival</th><th className="p-3">Triage</th>
                <th className="p-3">Status</th><th className="p-3">Waiting</th><th className="p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.queue.map((r) => {
                const critical = r.priority === "EMERGENCY";
                const overdue = r.reassessmentDueAt !== null && new Date(r.reassessmentDueAt) < new Date();
                return (
                  <tr key={r.id} className={`border-t ${critical ? "bg-red-50 dark:bg-red-950/30" : ""} ${overdue ? "ring-1 ring-inset ring-orange-400" : ""}`} data-testid={`row-ed-${r.encounterNumber}`}>
                    <td className="p-3">
                      {r.patient.unidentified ? (
                        <span className="font-medium">{r.temporaryLabel ?? r.patient.lastName} <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">unidentified</span></span>
                      ) : (
                        <Link href={`/lab/patients/${r.patient.id}`} className="font-medium hover:underline">{r.patient.firstName} {r.patient.lastName}</Link>
                      )}
                      <div className="text-xs text-muted-foreground">{r.patient.caseNumber} · {r.encounterNumber}{r.presentingComplaint ? ` · ${r.presentingComplaint.slice(0, 40)}` : ""}</div>
                    </td>
                    <td className="p-3 text-xs">{ARRIVAL_LABEL[r.arrivalMode ?? ""] ?? "—"}<div className="text-muted-foreground">{new Date(r.registeredAt).toLocaleTimeString()}</div></td>
                    <td className="p-3 text-xs">
                      {r.triageCategory ? <span className={`rounded-full px-2 py-1 text-xs font-semibold ${critical ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200" : "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200"}`}>{r.triageCategory}</span> : <span className="text-muted-foreground">Not triaged</span>}
                      {triageCategories.length > 0 && (
                        <select className="mt-1 h-7 w-full rounded border text-xs" aria-label="Set triage category" value="" onChange={(e) => e.target.value && patchEncounter(r.id, { triageCategory: e.target.value, reassessmentInMinutes: 30 })}>
                          <option value="">Triage…</option>
                          {triageCategories.map((t) => <option key={t}>{t}</option>)}
                        </select>
                      )}
                    </td>
                    <td className="p-3 text-xs">{STATUS_LABEL[r.status] ?? r.status}{r.clinicianName ? <div className="text-muted-foreground">Dr {r.clinicianName}</div> : null}</td>
                    <td className="p-3 text-xs tabular-nums">
                      {r.minutesWaiting} min
                      {overdue ? <div className="font-semibold text-orange-600">Reassessment overdue</div> : null}
                    </td>
                    <td className="space-y-1 p-3">
                      <select className="h-7 w-full rounded border text-xs" aria-label="Move to status" value="" onChange={(e) => e.target.value && patchEncounter(r.id, { status: e.target.value })}>
                        <option value="">Move to…</option>
                        {STATUSES.filter((s) => s !== r.status).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                      <select className="h-7 w-full rounded border text-xs" aria-label="Assign clinician" value="" onChange={(e) => e.target.value && patchEncounter(r.id, { clinicianName: e.target.value })}>
                        <option value="">Assign clinician…</option>
                        {["on-call physician", "attending physician", "trauma lead", "medical officer"].map((c) => <option key={c}>{c}</option>)}
                      </select>
                      <select className="h-7 w-full rounded border text-xs" aria-label="Pain score" value="" onChange={(e) => e.target.value && patchEncounter(r.id, { painScore: Number(e.target.value) })}>
                        <option value="">Pain score…</option>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((p) => <option key={p} value={p}>{p}/10</option>)}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
