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

/** Pharmacy workstation: the medication order worklist. Orders flow
 *  draft → submitted → reviewed → dispensed (→ completed), each step
 *  permission-gated and audited. Allergies are shown for visibility — the app
 *  never checks interactions or suggests dosing; that judgement stays with the
 *  pharmacist and prescriber. */
export function PharmacyDashboard({ canOrder, canReview }: { canOrder: boolean; canReview: boolean }) {
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

  const reload = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (mode === "patient" && patient) params.set("patientId", patient.id);
      if (filter !== "ALL") params.set("status", filter);
      const { orders: rows } = await api<{ orders: OrderRow[] }>(`/api/facility/his/medication-orders?${params}`);
      setOrders(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the medication orders");
    }
  }, [mode, patient, filter]);

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
            await api("/api/facility/his/medication-orders", {
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
            setName(""); setStrength(""); setDose(""); setRoute(""); setFrequency(""); setDuration(""); setNotes("");
          }, "Order created as draft");
        }}>
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
    </div>
  );
}
