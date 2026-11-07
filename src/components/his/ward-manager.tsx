"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api, inputClass } from "./use-api";

interface Ward {
  id: string;
  name: string;
  code: string | null;
  genderPolicy: string | null;
  genderPolicyLabel: string | null;
  totalBeds: number;
  available: number;
  occupied: number;
  reserved: number;
  cleaning: number;
  maintenance: number;
  isolation: number;
}

interface Bed {
  id: string;
  label: string;
  status: string;
  isolationReason: string | null;
  notes: string | null;
  ward: { id: string; name: string };
  currentAdmission: {
    id: string;
    admissionDate: string;
    reason: string | null;
    patient: { id: string; caseNumber: string; firstName: string; lastName: string };
  } | null;
  reservedForAdmission: {
    id: string;
    admissionDate: string;
    patient: { id: string; caseNumber: string; firstName: string; lastName: string };
  } | null;
}

const STATUS_CHIP: Record<string, string> = {
  AVAILABLE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
  OCCUPIED: "bg-red-100 text-red-800 dark:bg-red-900/60 dark:text-red-200",
  RESERVED: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
  CLEANING: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
  MAINTENANCE: "bg-gray-200 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  ISOLATION: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200",
};

/** Ward and bed management with live occupancy. */
export function WardManager() {
  const [wards, setWards] = useState<Ward[] | null>(null);
  const [beds, setBeds] = useState<Bed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showNewWard, setShowNewWard] = useState(false);
  const [wardForm, setWardForm] = useState({ name: "", code: "", genderPolicy: "MIXED" });
  const [bedForm, setBedForm] = useState({ wardId: "", labels: "" });

  const load = useCallback(async () => {
    setError(null);
    try {
      const [w, b] = await Promise.all([
        api<{ wards: Ward[] }>("/api/facility/his/wards"),
        api<{ beds: Bed[] }>("/api/facility/his/beds"),
      ]);
      setWards(w.wards);
      setBeds(b.beds);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  }, []);

  useEffect(() => { const t = setTimeout(() => void load(), 0); const i = setInterval(load, 60_000); return () => { clearTimeout(t); clearInterval(i); }; }, [load]);

  const createWard = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    try {
      await api("/api/facility/his/wards", {
        body: { name: wardForm.name, code: wardForm.code || undefined, genderPolicy: wardForm.genderPolicy },
      });
      setMessage("Ward created.");
      setWardForm({ name: "", code: "", genderPolicy: "MIXED" });
      setShowNewWard(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const addBeds = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null);
    const labels = bedForm.labels.split(",").map((s) => s.trim()).filter(Boolean);
    if (labels.length === 0) return;
    try {
      await api(`/api/facility/his/wards/${bedForm.wardId}`, { body: { labels } });
      setMessage(`${labels.length} bed(s) added.`);
      setBedForm({ ...bedForm, labels: "" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    }
  };

  const bedAction = async (bedId: string, action: string, extra: Record<string, unknown> = {}) => {
    setError(null); setMessage(null);
    try {
      await api(`/api/facility/his/beds/${bedId}`, { method: "PATCH", body: { action, ...extra } });
      setMessage("Bed updated.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setShowNewWard(!showNewWard)} data-testid="button-new-ward">{showNewWard ? "Close" : "New ward"}</Button>
      </div>

      {showNewWard && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Create a ward</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={createWard} data-testid="form-new-ward">
              <label className="text-xs">Name<input required className={inputClass} value={wardForm.name} onChange={(e) => setWardForm({ ...wardForm, name: e.target.value })} data-testid="input-ward-name" /></label>
              <label className="text-xs">Code<input className={inputClass} value={wardForm.code} onChange={(e) => setWardForm({ ...wardForm, code: e.target.value })} /></label>
              <label className="text-xs">Policy
                <select className={inputClass} value={wardForm.genderPolicy} onChange={(e) => setWardForm({ ...wardForm, genderPolicy: e.target.value })}>
                  {["MIXED", "MALE", "FEMALE", "PEDIATRIC", "ISOLATION"].map((p) => <option key={p}>{p}</option>)}
                </select>
              </label>
              <Button type="submit" className="sm:col-span-3" data-testid="button-create-ward">Create ward</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {error && <p role="alert" className="text-sm text-destructive" data-testid="text-ward-error">{error}</p>}
      {message && <p className="text-sm text-emerald-600 dark:text-emerald-400" data-testid="text-ward-message">{message}</p>}

      {/* Ward occupancy overview */}
      {wards === null ? (
        <p className="text-sm text-muted-foreground">Loading wards…</p>
      ) : wards.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No wards configured yet. Create your first ward to start bed management.</CardContent></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {wards.map((w) => (
            <Card key={w.id} className="rounded-2xl" data-testid={`card-ward-${w.name}`}>
              <CardHeader className="pb-2"><CardTitle className="text-base">{w.name}{w.code ? <span className="ml-2 text-xs text-muted-foreground">{w.code}</span> : null}</CardTitle></CardHeader>
              <CardContent className="text-sm">
                {w.genderPolicyLabel ? <div className="mb-2 text-xs text-muted-foreground">{w.genderPolicyLabel}</div> : null}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-emerald-100 px-2 py-1 dark:bg-emerald-900/60 dark:text-emerald-200">{w.available} available</span>
                  <span className="rounded-full bg-red-100 px-2 py-1 dark:bg-red-900/60 dark:text-red-200">{w.occupied} occupied</span>
                  <span className="rounded-full bg-blue-100 px-2 py-1 dark:bg-blue-900/60 dark:text-blue-200">{w.reserved} reserved</span>
                  <span className="rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/60 dark:text-amber-200">{w.cleaning} cleaning</span>
                  {w.maintenance > 0 && <span className="rounded-full bg-gray-200 px-2 py-1 dark:bg-gray-800 dark:text-gray-200">{w.maintenance} maintenance</span>}
                  {w.isolation > 0 && <span className="rounded-full bg-purple-100 px-2 py-1 dark:bg-purple-900/60 dark:text-purple-200">{w.isolation} isolation</span>}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">{w.totalBeds} beds total</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add beds to a ward */}
      {wards && wards.length > 0 && (
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Add beds</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-2 sm:grid-cols-3" onSubmit={addBeds} data-testid="form-add-beds">
              <label className="text-xs">Ward
                <select required className={inputClass} value={bedForm.wardId} onChange={(e) => setBedForm({ ...bedForm, wardId: e.target.value })} data-testid="select-bed-ward">
                  <option value="">Select ward…</option>
                  {wards.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </label>
              <label className="text-xs">Bed labels (comma-separated)<input required className={inputClass} placeholder="1, 2, 3" value={bedForm.labels} onChange={(e) => setBedForm({ ...bedForm, labels: e.target.value })} data-testid="input-bed-labels" /></label>
              <Button type="submit" className="self-end" data-testid="button-add-beds">Add beds</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Bed board */}
      {beds === null ? (
        <p className="text-sm text-muted-foreground">Loading beds…</p>
      ) : beds.length === 0 ? (
        <Card className="rounded-2xl"><CardContent className="py-8 text-center text-sm text-muted-foreground">No beds yet. Create a ward and add beds.</CardContent></Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm" data-testid="table-beds">
            <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Ward / bed</th><th className="p-3">Status</th><th className="p-3">Patient</th><th className="p-3">Actions</th></tr></thead>
            <tbody>
              {beds.map((b) => (
                <tr key={b.id} className="border-t" data-testid={`row-bed-${b.ward.name}-${b.label}`}>
                  <td className="p-3"><div className="font-medium">{b.ward.name} · Bed {b.label}</div>{b.isolationReason ? <div className="text-xs text-purple-700 dark:text-purple-300">{b.isolationReason}</div> : null}</td>
                  <td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${STATUS_CHIP[b.status] ?? ""}`}>{b.status}</span></td>
                  <td className="p-3 text-xs">
                    {b.currentAdmission ? (
                      <>
                        <div className="font-medium">{b.currentAdmission.patient.firstName} {b.currentAdmission.patient.lastName}</div>
                        <div className="text-muted-foreground">{b.currentAdmission.patient.caseNumber}{b.currentAdmission.reason ? ` · ${b.currentAdmission.reason.slice(0, 40)}` : ""}</div>
                      </>
                    ) : b.reservedForAdmission ? (
                      <span className="text-muted-foreground">Reserved for {b.reservedForAdmission.patient.lastName}</span>
                    ) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {b.status === "CLEANING" && <Button size="sm" variant="outline" onClick={() => bedAction(b.id, "MARK_CLEANED")} data-testid={`button-clean-${b.label}`}>Mark cleaned</Button>}
                      {b.status === "AVAILABLE" && <Button size="sm" variant="outline" onClick={() => bedAction(b.id, "BLOCK_MAINTENANCE", { reason: "Maintenance" })}>Maintenance</Button>}
                      {b.status === "AVAILABLE" && <Button size="sm" variant="outline" onClick={() => bedAction(b.id, "BLOCK_ISOLATION", { reason: "Infection control" })}>Isolate</Button>}
                      {(b.status === "MAINTENANCE" || b.status === "ISOLATION") && <Button size="sm" variant="outline" onClick={() => bedAction(b.id, "UNBLOCK")}>Unblock</Button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
