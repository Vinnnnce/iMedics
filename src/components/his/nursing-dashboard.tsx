"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { PatientIdentify, type IdentifiedPatient } from "./patient-identify";
import { api, inputClass, textareaClass } from "./use-api";
import { OBSERVATION_TYPES } from "@/lib/his/observation-types";

interface ObservationRow { id: string; observationType: string; value: string; unit: string; recordedAt: string; notes: string | null; recordedById: string }
interface TaskRow { id: string; title: string; instructions: string | null; dueAt: string | null; status: string; assignedToId: string | null; completedAt: string | null; createdAt: string }
interface HandoverRow { id: string; summary: string; fromUserId: string; toUserId: string | null; openTaskIds: string[] | string; createdAt: string }

const TASK_TRANSITIONS: Record<string, string[]> = {
  DUE: ["IN_PROGRESS", "COMPLETED", "DEFERRED", "ESCALATED"],
  IN_PROGRESS: ["COMPLETED", "DEFERRED", "ESCALATED", "DUE"],
  COMPLETED: [],
  DEFERRED: ["DUE", "ESCALATED", "IN_PROGRESS"],
  ESCALATED: ["IN_PROGRESS", "COMPLETED", "DUE"],
};
const STATUS_LABEL: Record<string, string> = { DUE: "Due", IN_PROGRESS: "In progress", COMPLETED: "Completed", DEFERRED: "Deferred", ESCALATED: "Escalated" };
const ACTION_LABEL: Record<string, string> = { DUE: "Reopen", IN_PROGRESS: "Start", COMPLETED: "Complete", DEFERRED: "Defer", ESCALATED: "Escalate" };
const statusClass = (s: string) =>
  s === "COMPLETED" ? "bg-emerald-100 text-emerald-800" : s === "ESCALATED" ? "bg-red-100 text-red-800" : s === "DEFERRED" ? "bg-amber-100 text-amber-800" : s === "IN_PROGRESS" ? "bg-blue-100 text-blue-800" : "bg-muted text-foreground";

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
const openTaskCount = (raw: string[] | string): number => {
  const ids = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
  return Array.isArray(ids) ? ids.length : 0;
};

interface OrderRow { id: string; medicationName: string; strength: string | null; dose: string | null; route: string | null; frequency: string | null; status: string }
interface AdministrationRow { id: string; status: string; administeredDose: string | null; route: string | null; notes: string | null; administeredAt: string; order: { medicationName: string; strength: string | null } }

/** Nursing workstation: identify a patient, then record observations, manage
 *  care tasks, administer medications (MAR) and write shift handovers. Entries
 *  are timestamped, unit-annotated and attributed; the app never interprets
 *  clinical values. */
export function NursingDashboard({ canRecord, canAdminister }: { canRecord: boolean; canAdminister: boolean }) {
  const [patient, setPatient] = useState<IdentifiedPatient | null>(null);
  const [observations, setObservations] = useState<ObservationRow[]>([]);
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [handovers, setHandovers] = useState<HandoverRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [administrations, setAdministrations] = useState<AdministrationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Observation form
  const [obsType, setObsType] = useState(OBSERVATION_TYPES[0].key);
  const [obsValue, setObsValue] = useState("");
  const [obsAt, setObsAt] = useState("");
  const [obsNotes, setObsNotes] = useState("");
  // Task form
  const [taskTitle, setTaskTitle] = useState("");
  const [taskInstructions, setTaskInstructions] = useState("");
  const [taskDueAt, setTaskDueAt] = useState("");
  // Handover form
  const [handoverSummary, setHandoverSummary] = useState("");
  // MAR form (per order, keyed by order id)
  const [marStatus, setMarStatus] = useState("GIVEN");
  const [marDose, setMarDose] = useState("");
  const [marNotes, setMarNotes] = useState("");

  const reload = useCallback(async (patientId: string) => {
    try {
      const [obs, tsk, hnd, ords, adm] = await Promise.all([
        api<{ observations: ObservationRow[] }>(`/api/facility/his/nursing/observations?patientId=${patientId}`),
        api<{ tasks: TaskRow[] }>(`/api/facility/his/nursing/tasks?patientId=${patientId}`),
        api<{ handovers: HandoverRow[] }>(`/api/facility/his/nursing/handover?patientId=${patientId}`),
        api<{ orders: OrderRow[] }>(`/api/facility/his/medication-orders?patientId=${patientId}`),
        api<{ administrations: AdministrationRow[] }>(`/api/facility/his/medication-orders/administrations?patientId=${patientId}`),
      ]);
      setObservations(obs.observations);
      setTasks(tsk.tasks);
      setHandovers(hnd.handovers);
      setOrders(ords.orders);
      setAdministrations(adm.administrations);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the nursing chart");
    }
  }, []);

  useEffect(() => {
    if (!patient) return;
    const t = setTimeout(() => void reload(patient.id), 0);
    return () => clearTimeout(t);
  }, [patient, reload]);

  const run = async (action: () => Promise<void>, ok: string) => {
    setError(null);
    try {
      await action();
      setNotice(ok);
      if (patient) await reload(patient.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  };

  const selectedType = OBSERVATION_TYPES.find((t) => t.key === obsType);

  if (!patient) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Identify the patient by case number and date of birth to open the nursing chart.</p>
        <PatientIdentify onFound={setPatient} label="Open nursing chart" />
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }

  const openTasks = tasks.filter((t) => t.status !== "COMPLETED");

  return (
    <div className="space-y-6" data-testid="nursing-dashboard">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/40 p-3">
        <div>
          <p className="font-medium">{patient.firstName} {patient.lastName}</p>
          <p className="text-xs text-muted-foreground">Case {patient.caseNumber} · DOB {patient.dateOfBirth}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { setPatient(null); setObservations([]); setTasks([]); setHandovers([]); }}>Close chart</Button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-emerald-700">{notice}</p>}

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Observations</h2>
        {canRecord ? (
          <form className="grid gap-2 sm:grid-cols-5" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const body: Record<string, unknown> = { patientId: patient.id, observationType: obsType, value: obsValue };
              if (obsAt) body.recordedAt = new Date(obsAt).toISOString();
              if (obsNotes.trim()) body.notes = obsNotes.trim();
              await api("/api/facility/his/nursing/observations", { body });
              setObsValue(""); setObsNotes(""); setObsAt("");
            }, "Observation recorded");
          }}>
            <label className="text-xs">Type
              <select className={inputClass} value={obsType} onChange={(e) => setObsType(e.target.value)} data-testid="select-observation-type">
                {OBSERVATION_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </label>
            <label className="text-xs">Value ({selectedType?.unit})
              <input className={inputClass} value={obsValue} onChange={(e) => setObsValue(e.target.value)} required data-testid="input-observation-value" />
            </label>
            <label className="text-xs">Taken at (optional)
              <input type="datetime-local" className={inputClass} value={obsAt} onChange={(e) => setObsAt(e.target.value)} data-testid="input-observation-at" />
            </label>
            <label className="text-xs sm:col-span-2">Notes
              <input className={inputClass} value={obsNotes} onChange={(e) => setObsNotes(e.target.value)} maxLength={500} data-testid="input-observation-notes" />
            </label>
            <Button type="submit" className="sm:col-span-5" data-testid="button-record-observation">Record observation</Button>
          </form>
        ) : (
          <p className="text-xs text-muted-foreground">You can view observations; recording requires nursing permission.</p>
        )}
        {observations.length === 0 ? (
          <p className="text-sm text-muted-foreground">No observations recorded yet.</p>
        ) : (
          <table className="w-full text-sm" data-testid="table-observations">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-1.5 pr-2">Type</th><th className="pr-2">Value</th><th className="pr-2">Recorded at</th><th>Notes</th></tr></thead>
            <tbody>
              {observations.map((o) => (
                <tr key={o.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{OBSERVATION_TYPES.find((t) => t.key === o.observationType)?.label ?? o.observationType}</td>
                  <td className="pr-2 font-mono">{o.value} {o.unit}</td>
                  <td className="pr-2">{fmt(o.recordedAt)}</td>
                  <td className="text-muted-foreground">{o.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Care tasks <span className="ml-1 text-xs font-normal text-muted-foreground">{openTasks.length} open</span></h2>
        {canRecord ? (
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const body: Record<string, unknown> = { patientId: patient.id, title: taskTitle };
              if (taskInstructions.trim()) body.instructions = taskInstructions.trim();
              if (taskDueAt) body.dueAt = new Date(taskDueAt).toISOString();
              await api("/api/facility/his/nursing/tasks", { body });
              setTaskTitle(""); setTaskInstructions(""); setTaskDueAt("");
            }, "Task created");
          }}>
            <label className="text-xs">Task
              <input className={inputClass} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} required maxLength={200} data-testid="input-task-title" />
            </label>
            <label className="text-xs">Instructions
              <input className={inputClass} value={taskInstructions} onChange={(e) => setTaskInstructions(e.target.value)} maxLength={1000} data-testid="input-task-instructions" />
            </label>
            <label className="text-xs">Due at (optional)
              <input type="datetime-local" className={inputClass} value={taskDueAt} onChange={(e) => setTaskDueAt(e.target.value)} data-testid="input-task-due" />
            </label>
            <Button type="submit" className="self-end" data-testid="button-create-task">Add task</Button>
          </form>
        ) : null}
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No care tasks yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="list-tasks">
            {tasks.map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.instructions ?? "—"} · due {fmt(t.dueAt)}{t.completedAt ? ` · completed ${fmt(t.completedAt)}` : ""}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${statusClass(t.status)}`}>{STATUS_LABEL[t.status] ?? t.status}</span>
                {canRecord && (TASK_TRANSITIONS[t.status] ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(TASK_TRANSITIONS[t.status] ?? []).map((next) => (
                      <Button key={next} size="sm" variant="outline" data-testid={`button-task-${t.id}-${next}`} onClick={() => void run(async () => {
                        await api(`/api/facility/his/nursing/tasks/${t.id}`, { method: "PATCH", body: { status: next } });
                      }, `Task moved to ${STATUS_LABEL[next]}`)}>{ACTION_LABEL[next]}</Button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Medication administration (MAR)</h2>
        {orders.filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED").length === 0 ? (
          <p className="text-sm text-muted-foreground">No administrable medication orders for this patient.</p>
        ) : (
          <ul className="space-y-2" data-testid="list-mar-orders">
            {orders.filter((o) => o.status !== "DRAFT" && o.status !== "CANCELLED").map((o) => (
              <li key={o.id} className="rounded-lg border p-2">
                <p className="text-sm font-medium">{o.medicationName}{o.strength ? ` ${o.strength}` : ""}</p>
                <p className="text-xs text-muted-foreground">{[o.dose, o.route, o.frequency].filter(Boolean).join(" · ") || "—"} · order status {o.status.toLowerCase()}</p>
                {canAdminister && (
                  <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(`/api/facility/his/medication-orders/${o.id}/administrations`, {
                        body: { status: marStatus, ...(marDose.trim() ? { administeredDose: marDose.trim() } : {}), ...(marNotes.trim() ? { notes: marNotes.trim() } : {}) },
                      });
                      setMarDose(""); setMarNotes("");
                    }, marStatus === "GIVEN" ? "Administration recorded" : `${marStatus.toLowerCase()} recorded`);
                  }}>
                    <label className="text-xs">Outcome
                      <select className={inputClass} value={marStatus} onChange={(e) => setMarStatus(e.target.value)} data-testid={`select-mar-status-${o.id}`}>
                        <option value="GIVEN">Given</option>
                        <option value="HELD">Held</option>
                        <option value="REFUSED">Refused by patient</option>
                        <option value="OMITTED">Omitted</option>
                      </select>
                    </label>
                    <label className="text-xs">Dose given
                      <input className={inputClass} value={marDose} onChange={(e) => setMarDose(e.target.value)} placeholder={o.dose ?? "e.g. 1 tablet"} maxLength={100} data-testid={`input-mar-dose-${o.id}`} />
                    </label>
                    <label className="text-xs">Notes
                      <input className={inputClass} value={marNotes} onChange={(e) => setMarNotes(e.target.value)} maxLength={500} data-testid={`input-mar-notes-${o.id}`} />
                    </label>
                    <Button type="submit" size="sm" data-testid={`button-record-mar-${o.id}`}>Record</Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
        {administrations.length > 0 && (
          <table className="w-full text-sm" data-testid="table-administrations">
            <thead><tr className="border-b text-left text-xs uppercase text-muted-foreground"><th className="py-1.5 pr-2">Medication</th><th className="pr-2">Outcome</th><th className="pr-2">Dose</th><th className="pr-2">At</th><th>Notes</th></tr></thead>
            <tbody>
              {administrations.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-1.5 pr-2">{a.order.medicationName}{a.order.strength ? ` ${a.order.strength}` : ""}</td>
                  <td className="pr-2">{a.status}</td>
                  <td className="pr-2">{a.administeredDose ?? "—"}</td>
                  <td className="pr-2">{fmt(a.administeredAt)}</td>
                  <td className="text-muted-foreground">{a.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-3 rounded-lg border p-4">
        <h2 className="font-semibold">Handover</h2>
        {canRecord ? (
          <form className="space-y-2" onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("/api/facility/his/nursing/handover", {
                body: { patientId: patient.id, summary: handoverSummary, openTaskIds: openTasks.filter((t) => t.status !== "DEFERRED").map((t) => t.id) },
              });
              setHandoverSummary("");
            }, "Handover recorded");
          }}>
            <textarea className={textareaClass} rows={3} placeholder="Summary of the patient's status, outstanding tasks and anything the next shift must watch" value={handoverSummary} onChange={(e) => setHandoverSummary(e.target.value)} required maxLength={2000} data-testid="input-handover-summary" />
            <Button type="submit" data-testid="button-record-handover">Record handover ({openTasks.filter((t) => t.status !== "DEFERRED").length} open tasks attached)</Button>
          </form>
        ) : null}
        {handovers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No handovers recorded yet.</p>
        ) : (
          <ul className="space-y-2" data-testid="list-handovers">
            {handovers.map((h) => (
              <li key={h.id} className="rounded-lg border p-2 text-sm">
                <p className="text-muted-foreground text-xs">{fmt(h.createdAt)} · {openTaskCount(h.openTaskIds)} open tasks attached</p>
                <p className="mt-1">{h.summary}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
