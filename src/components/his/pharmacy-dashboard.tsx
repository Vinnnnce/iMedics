"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass, textareaClass } from "./use-api";

interface OrderRow {
  id: string;
  medicationName: string;
  strength: string | null;
  dose: string | null;
  route: string | null;
  frequency: string | null;
  duration: string | null;
  notes: string | null;
  status: string;
  prescriberId: string;
  createdAt: string;
  dispensedAt: string | null;
  allergies: unknown;
  patient: { id: string; firstName: string; lastName: string; caseNumber: string; dateOfBirth: string };
}

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT: ["SUBMITTED", "CANCELLED"],
  SUBMITTED: ["REVIEWED", "CANCELLED"],
  REVIEWED: ["DISPENSED", "CANCELLED"],
  DISPENSED: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};
const STATUS_LABEL: Record<string, string> = { DRAFT: "Draft", SUBMITTED: "Submitted", REVIEWED: "Reviewed", DISPENSED: "Dispensed", COMPLETED: "Completed", CANCELLED: "Cancelled" };
const ACTION_LABEL: Record<string, string> = { SUBMITTED: "Submit to pharmacy", REVIEWED: "Mark reviewed", DISPENSED: "Dispense", COMPLETED: "Mark completed", CANCELLED: "Cancel" };
const statusClass = (s: string) =>
  s === "DISPENSED" || s === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : s === "CANCELLED" ? "bg-red-100 text-red-800" : s === "REVIEWED" ? "bg-blue-100 text-blue-800" : s === "SUBMITTED" ? "bg-amber-100 text-amber-800" : "bg-muted text-foreground";

const allergyText = (allergies: unknown): string | null => {
  if (Array.isArray(allergies) && allergies.length > 0) return allergies.map((a) => (typeof a === "string" ? a : String((a as { name?: string })?.name ?? ""))).filter(Boolean).join(", ") || null;
  if (typeof allergies === "string" && allergies.trim()) return allergies.trim();
  return null;
};
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");

interface FormularyRow { id: string; medicationName: string; strength: string | null; form: string | null; defaultRoute: string | null; highAlert: boolean; active: boolean }
interface InteractionRuleRow { id: string; medicationA: string; medicationB: string; severity: string; description: string; active: boolean }
interface OutboxRow { id: string; status: string; attempts: number; lastError: string | null; sentAt: string | null; createdAt: string; order: { medicationName: string; status: string } }

/** Pharmacy workstation: the medication order worklist. Orders flow
 *  draft → submitted → reviewed → dispensed (→ completed), each step
 *  permission-gated and audited. Allergies and the facility's own configured
 *  interaction rules are surfaced as advisory alerts — the system never checks
 *  against rules the hospital did not enter, recommends dosing or integrates
 *  live dispensing hardware. */
export function PharmacyDashboard({ canOrder, canReview, canManageFormulary }: { canOrder: boolean; canReview: boolean; canManageFormulary: boolean }) {
  const [mode, setMode] = useState<"worklist" | "patient">("worklist");
  const [patient, setPatient] = useState<IdentifiedPatient | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState<string>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [strength, setStrength] = useState("");
  const [dose, setDose] = useState("");
  const [route, setRoute] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [safetyAlerts, setSafetyAlerts] = useState<string[]>([]);
  // Formulary management
  const [formulary, setFormulary] = useState<FormularyRow[]>([]);
  const [fName, setFName] = useState("");
  const [fStrength, setFStrength] = useState("");
  const [fForm, setFForm] = useState("");
  const [fRoute, setFRoute] = useState("");
  const [fHighAlert, setFHighAlert] = useState(false);
  // Interaction rules
  const [rules, setRules] = useState<InteractionRuleRow[]>([]);
  const [rA, setRA] = useState("");
  const [rB, setRB] = useState("");
  const [rSeverity, setRSeverity] = useState("ADVISORY");
  const [rDescription, setRDescription] = useState("");
  // E-prescribing outbox
  const [outbox, setOutbox] = useState<OutboxRow[]>([]);
  const [endpointConfigured, setEndpointConfigured] = useState(false);

  const reload = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (mode === "patient" && patient) params.set("patientId", patient.id);
      if (filter !== "ALL") params.set("status", filter);
      const { orders: rows } = await api<{ orders: OrderRow[] }>(`/api/facility/his/medication-orders?${params}`);
      setOrders(rows);
      if (canManageFormulary) {
        const [f, r] = await Promise.all([
          api<{ items: FormularyRow[] }>("/api/facility/his/formulary"),
          api<{ rules: InteractionRuleRow[] }>("/api/facility/his/interaction-rules"),
        ]);
        setFormulary(f.items);
        setRules(r.rules);
      }
      if (canReview) {
        const e = await api<{ outbox: OutboxRow[]; endpointConfigured: boolean }>("/api/facility/his/eprescribing");
        setOutbox(e.outbox);
        setEndpointConfigured(e.endpointConfigured);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the medication orders");
    }
  }, [mode, patient, filter, canManageFormulary, canReview]);

  useEffect(() => {
    const t = setTimeout(() => void reload(), 0);
    return () => clearTimeout(t);
  }, [reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    setError(null);
    try {
      await action();
      setNotice(ok);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  };

  const visible = filter === "ALL" ? orders : orders;

  return (
    <div className="space-y-4" data-testid="pharmacy-dashboard">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant={mode === "worklist" ? "default" : "outline"} size="sm" onClick={() => { setMode("worklist"); setPatient(null); }} data-testid="button-worklist">Facility worklist</Button>
        <Button variant={mode === "patient" ? "default" : "outline"} size="sm" onClick={() => setMode("patient")} data-testid="button-patient-view">Patient orders</Button>
        {mode === "patient" && patient && (
          <span className="text-sm text-muted-foreground">{patient.firstName} {patient.lastName} · Case {patient.caseNumber}</span>
        )}
      </div>

      {mode === "patient" && !patient && (
        <PatientIdentify onFound={setPatient} label="Open medication history" />
      )}
      {mode === "patient" && patient && canOrder && (
        <form className="space-y-2 rounded-lg border p-4" onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            const response = await api<{ alerts?: { kind: string; severity?: string; allergen?: string; between?: [string, string]; description?: string }[] }>("/api/facility/his/medication-orders", {
              body: {
                patientId: patient.id,
                medicationName: name,
                ...(strength.trim() ? { strength: strength.trim() } : {}),
                ...(dose.trim() ? { dose: dose.trim() } : {}),
                ...(route.trim() ? { route: route.trim() } : {}),
                ...(frequency.trim() ? { frequency: frequency.trim() } : {}),
                ...(duration.trim() ? { duration: duration.trim() } : {}),
                ...(notes.trim() ? { notes: notes.trim() } : {}),
              },
            });
            setSafetyAlerts((response.alerts ?? []).map((a) =>
              a.kind === "ALLERGY" ? `Allergy alert: patient has a recorded allergy to ${a.allergen}` :
              `Interaction alert (${a.severity?.toLowerCase()}): ${a.between?.join(" + ")} — ${a.description}`));
            setName(""); setStrength(""); setDose(""); setRoute(""); setFrequency(""); setDuration(""); setNotes("");
          }, "Order created as draft");
        }}>
          {safetyAlerts.length > 0 && (
            <ul role="alert" className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900" data-testid="safety-alerts">
              {safetyAlerts.map((alert, i) => <li key={i}>{alert}</li>)}
              <li>Advisory only — clinical judgement stays with the prescriber and pharmacist.</li>
            </ul>
          )}
          <h3 className="font-semibold">New medication order (saved as draft)</h3>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="text-xs">Medication
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} data-testid="input-medication-name" />
            </label>
            <label className="text-xs">Strength
              <input className={inputClass} value={strength} onChange={(e) => setStrength(e.target.value)} maxLength={60} data-testid="input-medication-strength" />
            </label>
            <label className="text-xs">Dose
              <input className={inputClass} value={dose} onChange={(e) => setDose(e.target.value)} maxLength={100} data-testid="input-medication-dose" />
            </label>
            <label className="text-xs">Route
              <input className={inputClass} value={route} onChange={(e) => setRoute(e.target.value)} maxLength={40} placeholder="e.g. oral, IV" data-testid="input-medication-route" />
            </label>
            <label className="text-xs">Frequency
              <input className={inputClass} value={frequency} onChange={(e) => setFrequency(e.target.value)} maxLength={60} placeholder="e.g. twice daily" data-testid="input-medication-frequency" />
            </label>
            <label className="text-xs">Duration
              <input className={inputClass} value={duration} onChange={(e) => setDuration(e.target.value)} maxLength={60} placeholder="e.g. 7 days" data-testid="input-medication-duration" />
            </label>
          </div>
          <textarea className={textareaClass} rows={2} placeholder="Notes for the pharmacist (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} data-testid="input-medication-notes" />
          <Button type="submit" data-testid="button-create-order">Create order</Button>
        </form>
      )}

      <div className="flex flex-wrap gap-1">
        {["ACTIVE", "DRAFT", "SUBMITTED", "REVIEWED", "DISPENSED", "COMPLETED", "CANCELLED", "ALL"].map((f) => (
          <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => setFilter(f)} data-testid={`button-filter-${f}`}>
            {f === "ALL" ? "All" : f === "ACTIVE" ? "Awaiting action" : STATUS_LABEL[f]}
          </Button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No medication orders match this view.</p>
      ) : (
        <ul className="space-y-2" data-testid="list-orders">
          {visible.map((o) => {
            const allergies = allergyText(o.allergies);
            return (
              <li key={o.id} className="rounded-lg border p-3" data-testid={`order-${o.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{o.medicationName}{o.strength ? ` ${o.strength}` : ""}</p>
                    <p className="text-xs text-muted-foreground">
                      {o.patient.firstName} {o.patient.lastName} (Case {o.patient.caseNumber}) · DOB {o.patient.dateOfBirth}
                    </p>
                    <p className="mt-1 text-sm">
                      {[o.dose, o.route, o.frequency, o.duration].filter(Boolean).join(" · ") || "—"}
                    </p>
                    {allergies && <p className="mt-1 text-xs font-medium text-red-700" data-testid={`allergies-${o.id}`}>Recorded allergies: {allergies}</p>}
                    {o.notes && <p className="mt-1 text-xs text-muted-foreground">Note: {o.notes}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">Ordered {fmt(o.createdAt)}{o.dispensedAt ? ` · dispensed ${fmt(o.dispensedAt)}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(o.status)}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
                </div>
                {(STATUS_FLOW[o.status] ?? []).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(STATUS_FLOW[o.status] ?? []).map((next) => {
                      const needsReview = next === "REVIEWED" || next === "DISPENSED";
                      const needsOrder = next === "SUBMITTED";
                      const allowed = needsReview ? canReview : needsOrder ? canOrder : next === "CANCELLED" ? canOrder : true;
                      return (
                        <Button key={next} size="sm" variant="outline" disabled={!allowed} data-testid={`button-order-${o.id}-${next}`} onClick={() => void run(async () => {
                          await api(`/api/facility/his/medication-orders/${o.id}`, { method: "PATCH", body: { status: next } });
                        }, `Order ${STATUS_LABEL[next]}`)}>{ACTION_LABEL[next]}</Button>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canManageFormulary && (
        <section className="space-y-3 rounded-lg border p-4" data-testid="section-formulary">
          <h2 className="font-semibold">Formulary <span className="ml-1 text-xs font-normal text-muted-foreground">configured by this hospital; entries carry no clinical claim</span></h2>
          <form className="grid gap-2 sm:grid-cols-5" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("/api/facility/his/formulary", {
                body: { medicationName: fName, ...(fStrength.trim() ? { strength: fStrength.trim() } : {}), ...(fForm.trim() ? { form: fForm.trim() } : {}), ...(fRoute.trim() ? { defaultRoute: fRoute.trim() } : {}), highAlert: fHighAlert },
              });
              setFName(""); setFStrength(""); setFForm(""); setFRoute(""); setFHighAlert(false);
            }, "Formulary entry added");
          }}>
            <label className="text-xs">Medication
              <input className={inputClass} value={fName} onChange={(e) => setFName(e.target.value)} required maxLength={160} data-testid="input-formulary-name" />
            </label>
            <label className="text-xs">Strength
              <input className={inputClass} value={fStrength} onChange={(e) => setFStrength(e.target.value)} maxLength={60} data-testid="input-formulary-strength" />
            </label>
            <label className="text-xs">Form
              <input className={inputClass} value={fForm} onChange={(e) => setFForm(e.target.value)} placeholder="tablet, syrup..." maxLength={60} data-testid="input-formulary-form" />
            </label>
            <label className="text-xs">Default route
              <input className={inputClass} value={fRoute} onChange={(e) => setFRoute(e.target.value)} placeholder="oral, IV..." maxLength={40} data-testid="input-formulary-route" />
            </label>
            <label className="flex items-end gap-2 text-xs">
              <input type="checkbox" checked={fHighAlert} onChange={(e) => setFHighAlert(e.target.checked)} data-testid="input-formulary-high-alert" /> High-alert
              <Button type="submit" size="sm" className="ml-auto" data-testid="button-add-formulary">Add</Button>
            </label>
          </form>
          {formulary.length === 0 ? (
            <p className="text-sm text-muted-foreground">No formulary entries yet.</p>
          ) : (
            <ul className="space-y-1" data-testid="list-formulary">
              {formulary.map((f) => (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 flex-1">{f.medicationName}{f.strength ? ` ${f.strength}` : ""}{f.form ? ` (${f.form})` : ""}{f.defaultRoute ? ` · ${f.defaultRoute}` : ""}</span>
                  {f.highAlert && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">High alert</span>}
                  <span className={`rounded-full px-2 py-0.5 text-xs ${f.active ? "bg-emerald-100 text-emerald-800" : "bg-muted"}`}>{f.active ? "Active" : "Retired"}</span>
                  <Button size="sm" variant="outline" disabled={f.active} onClick={() => void run(async () => { await api(`/api/facility/his/formulary/${f.id}`, { method: "PATCH", body: { action: "reactivate" } }); }, "Entry restored")} data-testid={`button-formulary-${f.id}`}>{f.active ? "Retired" : "Reactivate"}</Button>
                  {f.active && <Button size="sm" variant="outline" onClick={() => void run(async () => { await api(`/api/facility/his/formulary/${f.id}`, { method: "PATCH", body: { action: "deactivate" } }); }, "Entry retired")} data-testid={`button-formulary-retire-${f.id}`}>Retire</Button>}
                </li>
              ))}
            </ul>
          )}

          <h3 className="pt-2 font-semibold">Interaction rules <span className="ml-1 text-xs font-normal text-muted-foreground">the engine reports only rules this hospital enters</span></h3>
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("/api/facility/his/interaction-rules", {
                body: { medicationA: rA, medicationB: rB, severity: rSeverity, description: rDescription },
              });
              setRA(""); setRB(""); setRSeverity("ADVISORY"); setRDescription("");
            }, "Interaction rule added");
          }}>
            <label className="text-xs">Medication A
              <input className={inputClass} value={rA} onChange={(e) => setRA(e.target.value)} required maxLength={160} data-testid="input-rule-a" />
            </label>
            <label className="text-xs">Medication B
              <input className={inputClass} value={rB} onChange={(e) => setRB(e.target.value)} required maxLength={160} data-testid="input-rule-b" />
            </label>
            <label className="text-xs">Severity
              <select className={inputClass} value={rSeverity} onChange={(e) => setRSeverity(e.target.value)} data-testid="select-rule-severity">
                <option value="ADVISORY">Advisory</option>
                <option value="WARNING">Warning</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            <label className="text-xs">Description
              <input className={inputClass} value={rDescription} onChange={(e) => setRDescription(e.target.value)} required maxLength={500} data-testid="input-rule-description" />
            </label>
            <Button type="submit" className="sm:col-span-4" data-testid="button-add-rule">Add rule</Button>
          </form>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No interaction rules configured.</p>
          ) : (
            <ul className="space-y-1" data-testid="list-rules">
              {rules.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 flex-1">{r.medicationA} + {r.medicationB} — {r.description}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${r.severity === "CRITICAL" ? "bg-red-100 text-red-800" : r.severity === "WARNING" ? "bg-amber-100 text-amber-800" : "bg-muted"}`}>{r.severity}</span>
                  {!r.active && <span className="rounded-full bg-muted px-2 py-0.5 text-xs">Retired</span>}
                  <Button size="sm" variant="outline" onClick={() => void run(async () => { await api(`/api/facility/his/interaction-rules/${r.id}`, { method: "PATCH", body: { action: r.active ? "deactivate" : "reactivate" } }); }, "Rule updated")} data-testid={`button-rule-${r.id}`}>{r.active ? "Retire" : "Reactivate"}</Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {canReview && (
        <section className="space-y-3 rounded-lg border p-4" data-testid="section-eprescribing">
          <h2 className="font-semibold">E-prescribing outbox <span className="ml-1 text-xs font-normal text-muted-foreground">integration boundary — delivery requires a configured external endpoint</span></h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`rounded-full px-2 py-0.5 text-xs ${endpointConfigured ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
              {endpointConfigured ? "External endpoint configured" : "No external endpoint configured — entries stay pending (documented dependency)"}
            </span>
            <Button size="sm" variant="outline" onClick={() => void run(async () => {
              const result = await api<{ attempted: number; delivered: number }>("/api/facility/his/eprescribing", { method: "POST", body: {} });
              setNotice(`Dispatch attempted for ${result.attempted} entries (${result.delivered} delivered)`);
            }, "Dispatch attempted")} data-testid="button-dispatch-eprescribing">Attempt delivery of pending entries</Button>
          </div>
          {outbox.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outbound entries yet. Submitting an order enqueues one.</p>
          ) : (
            <ul className="space-y-1" data-testid="list-outbox">
              {outbox.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                  <span className="min-w-0 flex-1">{e.order.medicationName} · queued {fmt(e.createdAt)}{e.sentAt ? ` · sent ${fmt(e.sentAt)}` : ""}{e.lastError ? ` · ${e.lastError}` : ""}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${e.status === "SENT" ? "bg-emerald-100 text-emerald-800" : e.status === "FAILED" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{e.status.toLowerCase()}{e.attempts > 0 ? ` (${e.attempts} attempts)` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
