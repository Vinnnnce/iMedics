"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass } from "./use-api";

interface Equipment {
  id: string;
  name: string;
  kind: string | null;
  model: string | null;
  serialNumber: string | null;
  location: string | null;
  status: string;
  lastServicedAt: string | null;
  nextServiceDueAt: string | null;
  maintenanceLogs: { id: string; type: string; performedAt: string; notes: string | null }[];
  _count: { qcRuns: number };
}

interface Reagent {
  id: string;
  name: string;
  manufacturer: string | null;
  lotNumber: string | null;
  quantity: number;
  unit: string;
  minStockLevel: number;
  expiresAt: string | null;
  lowStock: boolean;
  expired: boolean;
}

interface QcRun {
  id: string;
  testName: string | null;
  controlName: string;
  expected: string | null;
  observed: string;
  result: string;
  performedAt: string;
  equipment: { id: string; name: string } | null;
  performedBy: { name: string } | null;
}

type Tab = "equipment" | "reagents" | "qc";

/** Laboratory equipment, maintenance, reagent inventory and quality control. */
export function LabEquipmentManager({ canManage }: { canManage: boolean }) {
  const [tab, setTab] = useState<Tab>("equipment");
  const [equipment, setEquipment] = useState<Equipment[] | null>(null);
  const [reagents, setReagents] = useState<Reagent[] | null>(null);
  const [qcRuns, setQcRuns] = useState<QcRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [eqForm, setEqForm] = useState({ name: "", kind: "", model: "", serialNumber: "", location: "" });
  const [reagentForm, setReagentForm] = useState({ name: "", manufacturer: "", lotNumber: "", quantity: "", unit: "", minStockLevel: "", expiresAt: "" });
  const [qcForm, setQcForm] = useState({ controlName: "", expected: "", observed: "", result: "PASS", notes: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [eq, rg, qc] = await Promise.all([
        api<{ equipment: Equipment[] }>("/api/facility/his/lab/equipment"),
        api<{ reagents: Reagent[] }>("/api/facility/his/lab/reagents"),
        api<{ runs: QcRun[] }>("/api/facility/his/lab/qc"),
      ]);
      setEquipment(eq.equipment);
      setReagents(rg.reagents);
      setQcRuns(qc.runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => { const t = setTimeout(() => void load(), 0); return () => clearTimeout(t); }, [load]);

  const addEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    try {
      await api("/api/facility/his/lab/equipment", {
        body: { ...eqForm, kind: eqForm.kind || undefined, model: eqForm.model || undefined, serialNumber: eqForm.serialNumber || undefined, location: eqForm.location || undefined },
      });
      setNotice("Equipment registered.");
      setEqForm({ name: "", kind: "", model: "", serialNumber: "", location: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const addReagent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    try {
      await api("/api/facility/his/lab/reagents", {
        body: {
          ...reagentForm,
          quantity: Number(reagentForm.quantity),
          minStockLevel: reagentForm.minStockLevel ? Number(reagentForm.minStockLevel) : undefined,
          manufacturer: reagentForm.manufacturer || undefined,
          lotNumber: reagentForm.lotNumber || undefined,
          expiresAt: reagentForm.expiresAt || undefined,
        },
      });
      setNotice("Reagent added.");
      setReagentForm({ name: "", manufacturer: "", lotNumber: "", quantity: "", unit: "", minStockLevel: "", expiresAt: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const recordQc = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setNotice(null);
    try {
      await api("/api/facility/his/lab/qc", {
        body: { ...qcForm, expected: qcForm.expected || undefined, notes: qcForm.notes || undefined },
      });
      setNotice("QC run recorded.");
      setQcForm({ controlName: "", expected: "", observed: "", result: "PASS", notes: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const setEquipmentStatus = async (id: string, status: string) => {
    setError(null);
    try {
      await api(`/api/facility/his/lab/equipment/${id}`, { method: "PATCH", body: { action: "SET_STATUS", status } });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  const logMaintenance = async (id: string, type: string) => {
    setError(null);
    try {
      await api(`/api/facility/his/lab/equipment/${id}`, {
        method: "PATCH",
        body: { action: "LOG_MAINTENANCE", maintenanceType: type, notes: `${type} service` },
      });
      setNotice("Maintenance logged.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Laboratory management">
        {([["equipment", "Equipment"], ["reagents", "Reagents"], ["qc", "Quality control"]] as const).map(([k, label]) => (
          <Button key={k} size="sm" role="tab" aria-selected={tab === k} variant={tab === k ? "default" : "outline"} onClick={() => setTab(k)} data-testid={`tab-lab-${k}`}>{label}</Button>
        ))}
      </div>

      {error && <p role="alert" className="text-sm text-destructive" data-testid="text-lab-error">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-lab-notice">{notice}</p>}

      {tab === "equipment" && (
        <div className="space-y-4">
          {canManage && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Register equipment</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-2 sm:grid-cols-3" onSubmit={addEquipment} data-testid="form-equipment">
                  <label className="text-xs">Name<input required className={inputClass} value={eqForm.name} onChange={(e) => setEqForm({ ...eqForm, name: e.target.value })} /></label>
                  <label className="text-xs">Kind<input className={inputClass} placeholder="e.g. Chemistry analyzer" value={eqForm.kind} onChange={(e) => setEqForm({ ...eqForm, kind: e.target.value })} /></label>
                  <label className="text-xs">Model<input className={inputClass} value={eqForm.model} onChange={(e) => setEqForm({ ...eqForm, model: e.target.value })} /></label>
                  <label className="text-xs">Serial number<input className={inputClass} value={eqForm.serialNumber} onChange={(e) => setEqForm({ ...eqForm, serialNumber: e.target.value })} /></label>
                  <label className="text-xs">Location<input className={inputClass} value={eqForm.location} onChange={(e) => setEqForm({ ...eqForm, location: e.target.value })} /></label>
                  <Button type="submit" className="self-end" data-testid="button-add-equipment">Register</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {equipment === null ? <p className="text-sm text-muted-foreground">Loading equipment…</p> : equipment.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No equipment registered yet.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-equipment">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Equipment</th><th className="p-3">Status</th><th className="p-3">Service</th><th className="p-3">Actions</th></tr></thead>
                <tbody>
                  {equipment.map((eq) => (
                    <tr key={eq.id} className="border-t" data-testid={`row-equipment-${eq.name}`}>
                      <td className="p-3">
                        <div className="font-medium">{eq.name}</div>
                        <div className="text-xs text-muted-foreground">{[eq.kind, eq.model, eq.location].filter(Boolean).join(" · ")}</div>
                      </td>
                      <td className="p-3 text-xs">
                        <span className={`rounded-full px-2 py-1 font-semibold ${eq.status === "OPERATIONAL" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" : eq.status === "MAINTENANCE" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200" : "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200"}`}>{eq.status}</span>
                      </td>
                      <td className="p-3 text-xs">
                        Last: {eq.lastServicedAt ? new Date(eq.lastServicedAt).toLocaleDateString() : "—"}
                        {eq.nextServiceDueAt ? <div className="text-muted-foreground">Next due: {new Date(eq.nextServiceDueAt).toLocaleDateString()}</div> : null}
                        <div className="text-muted-foreground">{eq._count.qcRuns} QC runs</div>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {eq.status !== "OPERATIONAL" && <Button size="sm" variant="outline" onClick={() => setEquipmentStatus(eq.id, "OPERATIONAL")}>Mark operational</Button>}
                          {eq.status === "OPERATIONAL" && <Button size="sm" variant="outline" onClick={() => setEquipmentStatus(eq.id, "MAINTENANCE")}>Under maintenance</Button>}
                          <Button size="sm" variant="outline" onClick={() => logMaintenance(eq.id, "PREVENTIVE")}>Log preventive</Button>
                          <Button size="sm" variant="outline" onClick={() => logMaintenance(eq.id, "CALIBRATION")}>Log calibration</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "reagents" && (
        <div className="space-y-4">
          {canManage && (
            <Card className="rounded-2xl">
              <CardHeader><CardTitle className="text-base">Add reagent</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-2 sm:grid-cols-4" onSubmit={addReagent} data-testid="form-reagent">
                  <label className="text-xs">Name<input required className={inputClass} value={reagentForm.name} onChange={(e) => setReagentForm({ ...reagentForm, name: e.target.value })} /></label>
                  <label className="text-xs">Manufacturer<input className={inputClass} value={reagentForm.manufacturer} onChange={(e) => setReagentForm({ ...reagentForm, manufacturer: e.target.value })} /></label>
                  <label className="text-xs">Lot number<input className={inputClass} value={reagentForm.lotNumber} onChange={(e) => setReagentForm({ ...reagentForm, lotNumber: e.target.value })} /></label>
                  <label className="text-xs">Quantity<input required inputMode="numeric" className={inputClass} value={reagentForm.quantity} onChange={(e) => setReagentForm({ ...reagentForm, quantity: e.target.value })} /></label>
                  <label className="text-xs">Unit<input required className={inputClass} placeholder="e.g. vials" value={reagentForm.unit} onChange={(e) => setReagentForm({ ...reagentForm, unit: e.target.value })} /></label>
                  <label className="text-xs">Min stock level<input inputMode="numeric" className={inputClass} value={reagentForm.minStockLevel} onChange={(e) => setReagentForm({ ...reagentForm, minStockLevel: e.target.value })} /></label>
                  <label className="text-xs">Expiry<input type="date" className={inputClass} value={reagentForm.expiresAt} onChange={(e) => setReagentForm({ ...reagentForm, expiresAt: e.target.value })} /></label>
                  <Button type="submit" className="self-end" data-testid="button-add-reagent">Add</Button>
                </form>
              </CardContent>
            </Card>
          )}
          {reagents === null ? <p className="text-sm text-muted-foreground">Loading reagents…</p> : reagents.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No reagents tracked yet.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-reagents">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Reagent</th><th className="p-3">Stock</th><th className="p-3">Expiry</th><th className="p-3">Status</th></tr></thead>
                <tbody>
                  {reagents.map((r) => (
                    <tr key={r.id} className={`border-t ${r.expired ? "bg-red-50 dark:bg-red-950/30" : r.lowStock ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                      <td className="p-3"><div className="font-medium">{r.name}</div><div className="text-xs text-muted-foreground">{[r.manufacturer, r.lotNumber].filter(Boolean).join(" · ") || "—"}</div></td>
                      <td className="p-3 tabular-nums text-xs">{r.quantity} {r.unit}</td>
                      <td className="p-3 text-xs">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                      <td className="p-3 text-xs">
                        {r.expired ? <span className="font-semibold text-red-600">expired</span> : r.lowStock ? <span className="font-semibold text-amber-600">low stock</span> : "OK"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "qc" && (
        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardHeader><CardTitle className="text-base">Record a QC run</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-2 sm:grid-cols-3" onSubmit={recordQc} data-testid="form-qc">
                <label className="text-xs">Control name<input required className={inputClass} value={qcForm.controlName} onChange={(e) => setQcForm({ ...qcForm, controlName: e.target.value })} /></label>
                <label className="text-xs">Expected<input className={inputClass} value={qcForm.expected} onChange={(e) => setQcForm({ ...qcForm, expected: e.target.value })} /></label>
                <label className="text-xs">Observed<input required className={inputClass} value={qcForm.observed} onChange={(e) => setQcForm({ ...qcForm, observed: e.target.value })} /></label>
                <label className="text-xs">Result
                  <select className={inputClass} value={qcForm.result} onChange={(e) => setQcForm({ ...qcForm, result: e.target.value })}>
                    {["PASS", "FAIL", "WARNING"].map((r) => <option key={r}>{r}</option>)}
                  </select>
                </label>
                <label className="text-xs">Notes (mandatory on FAIL)<input className={inputClass} value={qcForm.notes} onChange={(e) => setQcForm({ ...qcForm, notes: e.target.value })} /></label>
                <Button type="submit" className="self-end" data-testid="button-record-qc">Record</Button>
              </form>
            </CardContent>
          </Card>
          {qcRuns === null ? <p className="text-sm text-muted-foreground">Loading QC history…</p> : qcRuns.length === 0 ? (
            <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No QC runs recorded yet.</CardContent></Card>
          ) : (
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full text-sm" data-testid="table-qc">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">When</th><th className="p-3">Control</th><th className="p-3">Result</th><th className="p-3">By</th></tr></thead>
                <tbody>
                  {qcRuns.map((q) => (
                    <tr key={q.id} className="border-t">
                      <td className="p-3 text-xs">{new Date(q.performedAt).toLocaleString()}</td>
                      <td className="p-3 text-xs">{q.controlName}{q.testName ? ` · ${q.testName}` : ""}{q.expected ? ` · expected ${q.expected}, observed ${q.observed}` : ` · observed ${q.observed}`}</td>
                      <td className="p-3 text-xs">
                        <span className={`rounded-full px-2 py-1 font-semibold ${q.result === "PASS" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200" : q.result === "FAIL" ? "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"}`}>{q.result}</span>
                      </td>
                      <td className="p-3 text-xs">{q.performedBy?.name ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
