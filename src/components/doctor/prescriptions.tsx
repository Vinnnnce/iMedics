"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, AlertTriangle, ShieldAlert, Search, Stethoscope, Ban, RefreshCw, Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiClient } from "@/lib/api-client";
import { FREQUENCY_PRESETS, ROUTES, DOSE_UNITS } from "@/lib/prescriptions/validation";
import { ANTIBIOTIC_CLASSES, SPECTRUM_TAGS, spectrumLabel } from "@/lib/prescriptions/reference-shared";

interface PatientOption { id: string; name: string }
interface MedicationRef {
  id: string; name: string; activeIngredient: string | null; drugClass: string | null; antibioticClass: string | null;
  antimicrobialSpectrum: string[]; commonRoutes: string[]; formulations: string[];
}
interface DraftItem {
  key: number;
  drugName: string;
  activeIngredient: string;
  drugClass: string;
  antibioticClass: string;
  spectrum: string[];
  coverageNotes: string;
  indication: string;
  route: string;
  formulation: string;
  strength: string;
  doseValue: string;
  doseUnit: string;
  frequency: string;
  schedule: string[];
  duration: string;
  startDate: string;
  endDate: string;
  quantity: string;
  refills: string;
  foodInstructions: string;
  missedDoseInstructions: string;
  monitoring: string;
  medicationRefId: string | null;
}
interface SafetyAlert { code: string; severity: "HIGH" | "MODERATE" | "LOW" | "INFO" | "UNKNOWN"; message: string }
interface PrescriptionRow {
  id: string;
  issuedAt: string;
  status: string;
  notes: string | null;
  items: { id: string; drugName: string; dose: string | null; frequency: string | null; duration: string | null; route: string | null }[];
  doctor: { user: { name: string } };
}

let keyCounter = 1;
function emptyItem(): DraftItem {
  return {
    key: keyCounter++, drugName: "", activeIngredient: "", drugClass: "", antibioticClass: "", spectrum: [],
    coverageNotes: "", indication: "", route: "oral", formulation: "", strength: "", doseValue: "", doseUnit: "mg",
    frequency: "2x daily", schedule: [], duration: "", startDate: new Date().toISOString().slice(0, 10), endDate: "",
    quantity: "", refills: "0", foodInstructions: "", missedDoseInstructions: "", monitoring: "", medicationRefId: null,
  };
}

export function DoctorPrescriptions({ patients }: { patients: PatientOption[] }) {
  const [patientId, setPatientId] = useState("");
  const [items, setItems] = useState<DraftItem[]>([emptyItem()]);
  const [notes, setNotes] = useState("");
  const [alerts, setAlerts] = useState<SafetyAlert[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [currentMeds, setCurrentMeds] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<MedicationRef[]>([]);
  const [searchFor, setSearchFor] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionRow[]>([]);

  const loadPrescriptions = useCallback(async (id: string) => {
    if (!id) return;
    try {
      const data = await apiClient.get<{ prescriptions: PrescriptionRow[] }>(`/prescriptions?patientId=${id}`);
      setPrescriptions(data.prescriptions);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    if (patientId) {
      void Promise.resolve().then(() => loadPrescriptions(patientId));
    }
  }, [patientId, loadPrescriptions]);

  const update = (key: number, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  };

  const searchMedications = async (key: number, text: string) => {
    setSearchFor(key);
    setSearchText(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const data = await apiClient.get<{ medications: MedicationRef[] }>(`/medications?q=${encodeURIComponent(text.trim())}`);
      setSearchResults(data.medications);
    } catch {
      setSearchResults([]);
    }
  };

  const applyMedication = (key: number, med: MedicationRef) => {
    update(key, {
      drugName: med.name,
      activeIngredient: med.activeIngredient ?? "",
      drugClass: med.drugClass ?? "",
      antibioticClass: med.antibioticClass ?? "",
      spectrum: med.antimicrobialSpectrum,
      route: med.commonRoutes[0] ?? "oral",
      formulation: med.formulations[0] ?? "",
      medicationRefId: med.id,
    });
    setSearchFor(null);
    setSearchResults([]);
  };

  const runSafetyChecks = async () => {
    if (!patientId) {
      toast.error("Choose a patient first");
      return;
    }
    setBusy(true);
    try {
      const payloadItems = items.map((item) => ({
        drugName: item.drugName,
        activeIngredient: item.activeIngredient || undefined,
        drugClass: item.drugClass || undefined,
        antibioticClass: item.antibioticClass || undefined,
        antimicrobialSpectrum: item.spectrum,
        coverageNotes: item.coverageNotes || undefined,
        indication: item.indication || undefined,
        route: (ROUTES as readonly string[]).includes(item.route) ? (item.route as never) : undefined,
        formulation: item.formulation || undefined,
        strength: item.strength || undefined,
        doseValue: item.doseValue ? Number(item.doseValue) : undefined,
        doseUnit: (DOSE_UNITS as readonly string[]).includes(item.doseUnit) ? (item.doseUnit as never) : undefined,
        frequency: item.frequency,
        schedule: item.schedule,
        duration: item.duration || undefined,
        startDate: item.startDate ? new Date(item.startDate) : undefined,
        endDate: item.endDate ? new Date(item.endDate) : undefined,
        quantity: item.quantity ? Number(item.quantity) : undefined,
        refills: item.refills ? Number(item.refills) : 0,
        foodInstructions: item.foodInstructions || undefined,
        missedDoseInstructions: item.missedDoseInstructions || undefined,
        monitoring: item.monitoring || undefined,
        medicationRefId: item.medicationRefId ?? undefined,
      }));
      const data = await apiClient.post<{ alerts: SafetyAlert[]; context: { allergies: string[]; currentMedications: string[] } }>("/medications", {
        patientId,
        items: payloadItems,
      });
      setAlerts(data.alerts);
      setAllergies(data.context.allergies);
      setCurrentMeds(data.context.currentMedications);
      setChecked(true);
      setAcknowledged(false);
      if (data.alerts.some((a) => a.severity === "HIGH")) {
        toast.warning("High-severity safety alerts need your review before you can issue this prescription.");
      } else {
        toast.success("Safety checks complete");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Safety checks failed");
    } finally {
      setBusy(false);
    }
  };

  const issue = async () => {
    if (!patientId) return;
    const highAlerts = alerts.filter((a) => a.severity === "HIGH");
    if (highAlerts.length > 0 && !acknowledged) {
      toast.error("Review and confirm the high-severity alerts first");
      return;
    }
    setBusy(true);
    try {
      const payloadItems = items.map((item) => ({
        drugName: item.drugName,
        activeIngredient: item.activeIngredient || undefined,
        drugClass: item.drugClass || undefined,
        antibioticClass: item.antibioticClass || undefined,
        antimicrobialSpectrum: item.spectrum,
        coverageNotes: item.coverageNotes || undefined,
        indication: item.indication || undefined,
        route: (ROUTES as readonly string[]).includes(item.route) ? (item.route as never) : undefined,
        formulation: item.formulation || undefined,
        strength: item.strength || undefined,
        doseValue: item.doseValue ? Number(item.doseValue) : undefined,
        doseUnit: (DOSE_UNITS as readonly string[]).includes(item.doseUnit) ? (item.doseUnit as never) : undefined,
        frequency: item.frequency,
        frequencyText: FREQUENCY_PRESETS.find((f) => f.value === item.frequency)?.label ?? item.frequency,
        schedule: item.schedule,
        duration: item.duration || undefined,
        startDate: item.startDate ? new Date(item.startDate) : undefined,
        endDate: item.endDate ? new Date(item.endDate) : undefined,
        quantity: item.quantity ? Number(item.quantity) : undefined,
        refills: item.refills ? Number(item.refills) : 0,
        foodInstructions: item.foodInstructions || undefined,
        missedDoseInstructions: item.missedDoseInstructions || undefined,
        monitoring: item.monitoring || undefined,
        medicationRefId: item.medicationRefId ?? undefined,
        instructions: [item.foodInstructions, item.missedDoseInstructions, item.monitoring].filter(Boolean).join(" ") || undefined,
      }));
      await apiClient.post("/prescriptions", {
        patientId,
        notes: notes || undefined,
        items: payloadItems,
        safetyAcknowledged: acknowledged,
        safetyAlerts: alerts.map((a) => ({ code: a.code, severity: a.severity, message: a.message })),
      });
      toast.success("Prescription issued");
      setItems([emptyItem()]);
      setNotes("");
      setAlerts([]);
      setChecked(false);
      setAcknowledged(false);
      void loadPrescriptions(patientId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not issue the prescription");
    } finally {
      setBusy(false);
    }
  };

  const cancelPrescription = async (id: string) => {
    try {
      await apiClient.patch(`/prescriptions/${id}`, { action: "CANCEL", reason: "Cancelled by prescriber" });
      toast.success("Prescription cancelled");
      if (patientId) {
      void Promise.resolve().then(() => loadPrescriptions(patientId));
    }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel");
    }
  };

  const renewPrescription = async (id: string) => {
    try {
      await apiClient.patch(`/prescriptions/${id}`, { action: "RENEW" });
      toast.success("Prescription renewed");
      if (patientId) {
      void Promise.resolve().then(() => loadPrescriptions(patientId));
    }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not renew");
    }
  };

  const hasHighAlerts = useMemo(() => alerts.some((a) => a.severity === "HIGH"), [alerts]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold"><Stethoscope className="h-6 w-6 text-muted-foreground" aria-hidden="true" /> Prescriptions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured, clinically appropriate prescribing with safety checks. Alerts assist you — they never replace your judgment.
        </p>
      </div>

      <Card className="beeline-card">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1">
            <Label htmlFor="rx-patient">Patient</Label>
            <select id="rx-patient" value={patientId} onChange={(e) => { setPatientId(e.target.value); setAlerts([]); setChecked(false); }} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
              <option value="">Choose an assigned patient…</option>
              {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          {patientId && (allergies.length > 0 || currentMeds.length > 0) && (
            <div className="grid gap-3 sm:grid-cols-2 text-sm">
              {allergies.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
                  <p className="flex items-center gap-1.5 font-medium text-destructive"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> Recorded allergies</p>
                  <p className="mt-1 text-muted-foreground">{allergies.join(", ")}</p>
                </div>
              )}
              {currentMeds.length > 0 && (
                <div className="rounded-lg border border-border p-3">
                  <p className="font-medium">Current active medications</p>
                  <p className="mt-1 text-muted-foreground">{currentMeds.join(", ")}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items */}
      {items.map((item, index) => (
        <Card key={item.key} className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Medication {index + 1}</p>
              {items.length > 1 && (
                <Button variant="ghost" size="sm" onClick={() => setItems((prev) => prev.filter((i) => i.key !== item.key))} aria-label="Remove this medication">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>

            <div className="relative">
              <Label htmlFor={`rx-name-${item.key}`}>Medication name</Label>
              <div className="flex gap-2">
                <Input id={`rx-name-${item.key}`} value={item.drugName} onChange={(e) => { update(item.key, { drugName: e.target.value }); void searchMedications(item.key, e.target.value); }} placeholder="Type to search the medication reference" />
              </div>
              {searchFor === item.key && searchText.length >= 2 && searchResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-lg border border-border bg-popover p-1 shadow-lg">
                  {searchResults.slice(0, 8).map((med) => (
                    <button key={med.id} onClick={() => applyMedication(item.key, med)} className="block w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted">
                      <span className="font-medium">{med.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{med.drugClass}{med.antibioticClass ? ` · ${med.antibioticClass}` : ""}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1"><Label htmlFor={`rx-ingredient-${item.key}`}>Active ingredient</Label><Input id={`rx-ingredient-${item.key}`} value={item.activeIngredient} onChange={(e) => update(item.key, { activeIngredient: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`rx-class-${item.key}`}>Drug class / therapeutic category</Label><Input id={`rx-class-${item.key}`} value={item.drugClass} onChange={(e) => update(item.key, { drugClass: e.target.value })} /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor={`rx-abx-${item.key}`}>Antibiotic class (if applicable)</Label>
                <select id={`rx-abx-${item.key}`} value={item.antibioticClass} onChange={(e) => update(item.key, { antibioticClass: e.target.value })} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  <option value="">Not an antibiotic</option>
                  {ANTIBIOTIC_CLASSES.map((cls) => <option key={cls} value={cls}>{cls}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Antimicrobial spectrum (verified coverage)</Label>
                <div className="flex flex-wrap gap-1">
                  {SPECTRUM_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => update(item.key, { spectrum: item.spectrum.includes(tag) ? item.spectrum.filter((t) => t !== tag) : [...item.spectrum, tag] })}
                      className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${item.spectrum.includes(tag) ? "border-foreground bg-foreground/10" : "border-border hover:bg-muted"}`}
                    >
                      {spectrumLabel(tag)}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">Coverage is a property of the specific medication, not of its class.</p>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor={`rx-coverage-${item.key}`}>Intended bacterial coverage / clinical override notes</Label>
              <Input id={`rx-coverage-${item.key}`} value={item.coverageNotes} onChange={(e) => update(item.key, { coverageNotes: e.target.value })} placeholder="Document the organisms you intend to cover and any override of reference data" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label htmlFor={`rx-route-${item.key}`}>Route</Label>
                <select id={`rx-route-${item.key}`} value={item.route} onChange={(e) => update(item.key, { route: e.target.value })} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  {ROUTES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label htmlFor={`rx-form-${item.key}`}>Formulation & strength</Label><Input id={`rx-form-${item.key}`} value={`${item.formulation}${item.strength ? ` · ${item.strength}` : ""}`} onChange={(e) => update(item.key, { formulation: e.target.value })} placeholder="e.g. 500 mg tablet" /></div>
              <div className="space-y-1"><Label htmlFor={`rx-indication-${item.key}`}>Indication</Label><Input id={`rx-indication-${item.key}`} value={item.indication} onChange={(e) => update(item.key, { indication: e.target.value })} placeholder="Diagnosis or indication" /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label htmlFor={`rx-dose-${item.key}`}>Dose</Label><Input id={`rx-dose-${item.key}`} type="number" value={item.doseValue} onChange={(e) => update(item.key, { doseValue: e.target.value })} placeholder="500" /></div>
              <div className="space-y-1"><Label htmlFor={`rx-unit-${item.key}`}>Unit</Label>
                <select id={`rx-unit-${item.key}`} value={item.doseUnit} onChange={(e) => update(item.key, { doseUnit: e.target.value })} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  {DOSE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="space-y-1"><Label htmlFor={`rx-freq-${item.key}`}>Frequency</Label>
                <select id={`rx-freq-${item.key}`} value={item.frequency} onChange={(e) => update(item.key, { frequency: e.target.value })} className="w-full rounded-lg border border-border bg-background p-2 text-sm">
                  {FREQUENCY_PRESETS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  <option value="custom">Clinician-defined interval</option>
                </select>
              </div>
              <div className="space-y-1"><Label htmlFor={`rx-dur-${item.key}`}>Duration</Label><Input id={`rx-dur-${item.key}`} value={item.duration} onChange={(e) => update(item.key, { duration: e.target.value })} placeholder="e.g. 7 days" /></div>
            </div>

            <div className="space-y-1">
              <Label>Exact administration times</Label>
              <div className="flex flex-wrap gap-2">
                {["08:00", "13:00", "18:00", "22:00"].map((time) => (
                  <button key={time} onClick={() => update(item.key, { schedule: item.schedule.includes(time) ? item.schedule.filter((t) => t !== time) : [...item.schedule, time].sort() })}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${item.schedule.includes(time) ? "border-foreground bg-foreground/10" : "border-border hover:bg-muted"}`}>
                    {time}
                  </button>
                ))}
                {item.schedule.filter((t) => !["08:00", "13:00", "18:00", "22:00"].includes(t)).map((t) => (
                  <span key={t} className="rounded-full border border-foreground bg-foreground/10 px-3 py-1.5 text-sm">{t}</span>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <div className="space-y-1"><Label htmlFor={`rx-start-${item.key}`}>Start date</Label><Input id={`rx-start-${item.key}`} type="date" value={item.startDate} onChange={(e) => update(item.key, { startDate: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`rx-end-${item.key}`}>End date</Label><Input id={`rx-end-${item.key}`} type="date" value={item.endDate} onChange={(e) => update(item.key, { endDate: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`rx-qty-${item.key}`}>Quantity to dispense</Label><Input id={`rx-qty-${item.key}`} type="number" value={item.quantity} onChange={(e) => update(item.key, { quantity: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`rx-refill-${item.key}`}>Refills</Label><Input id={`rx-refill-${item.key}`} type="number" min={0} value={item.refills} onChange={(e) => update(item.key, { refills: e.target.value })} /></div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1"><Label htmlFor={`rx-food-${item.key}`}>Food instructions</Label><Input id={`rx-food-${item.key}`} value={item.foodInstructions} onChange={(e) => update(item.key, { foodInstructions: e.target.value })} placeholder="e.g. take with food" /></div>
              <div className="space-y-1"><Label htmlFor={`rx-missed-${item.key}`}>Missed dose instructions</Label><Input id={`rx-missed-${item.key}`} value={item.missedDoseInstructions} onChange={(e) => update(item.key, { missedDoseInstructions: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor={`rx-mon-${item.key}`}>Monitoring</Label><Input id={`rx-mon-${item.key}`} value={item.monitoring} onChange={(e) => update(item.key, { monitoring: e.target.value })} placeholder="e.g. renal function at 1 week" /></div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button variant="outline" onClick={() => setItems((prev) => [...prev, emptyItem()])}>
        <Plus className="h-4 w-4" aria-hidden="true" /> Add another medication
      </Button>

      <Card className="beeline-card">
        <CardContent className="space-y-3 p-4">
          <div className="space-y-1"><Label htmlFor="rx-notes">Prescription notes</Label>
            <textarea id="rx-notes" className="min-h-16 w-full rounded-lg border border-border bg-background p-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Overall notes and counselling points" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={runSafetyChecks} disabled={busy || !patientId} data-testid="button-safety-checks">
              <Search className="h-4 w-4" aria-hidden="true" /> {busy ? "Checking…" : "Run safety checks"}
            </Button>
            <Button onClick={issue} disabled={busy || !patientId || !checked || (hasHighAlerts && !acknowledged)} data-testid="button-issue-prescription">
              Issue prescription
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Safety alerts */}
      {checked && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <p className="flex items-center gap-2 font-medium"><ShieldAlert className="h-4 w-4 text-muted-foreground" aria-hidden="true" /> Safety review</p>
            <p className="text-xs text-muted-foreground">
              These alerts assist you and do not replace professional judgment. Interaction and spectrum data come from the
              integrated reference; “information unavailable” means the source could not verify it.
            </p>
            {alerts.length === 0 && <p className="text-sm text-muted-foreground">No alerts from the available data sources.</p>}
            {alerts.map((alert, i) => (
              <div key={i} className={`rounded-lg border p-3 text-sm ${
                alert.severity === "HIGH" ? "border-destructive/40 bg-destructive/10"
                : alert.severity === "MODERATE" ? "border-amber-500/40 bg-amber-500/10"
                : alert.severity === "UNKNOWN" ? "border-dashed border-border"
                : "border-border"}`}>
                <Badge variant={alert.severity === "HIGH" ? "destructive" : "outline"} className="mr-2 rounded-lg">{alert.severity}</Badge>
                {alert.message}
              </div>
            ))}
            {hasHighAlerts && (
              <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-1" />
                <span>I have reviewed the high-severity alerts, considered them clinically, and confirm this prescription is appropriate.</span>
              </label>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      {prescriptions.length > 0 && (
        <Card className="beeline-card">
          <CardContent className="space-y-3 p-4">
            <p className="font-medium">Prescription history</p>
            {prescriptions.map((rx) => (
              <div key={rx.id} className="space-y-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{new Date(rx.issuedAt).toLocaleDateString()}</span>
                  <Badge variant={rx.status === "ACTIVE" ? "default" : "outline"} className="rounded-lg">{rx.status.toLowerCase()}</Badge>
                  <span className="text-xs text-muted-foreground">by {rx.doctor.user.name}</span>
                  <div className="ml-auto flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => window.print()} aria-label="Print prescription"><Printer className="h-4 w-4" /></Button>
                    {rx.status === "ACTIVE" && (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => renewPrescription(rx.id)} aria-label="Renew prescription"><RefreshCw className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => cancelPrescription(rx.id)} aria-label="Cancel prescription"><Ban className="h-4 w-4 text-destructive" /></Button>
                      </>
                    )}
                  </div>
                </div>
                <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
                  {rx.items.map((item) => (
                    <li key={item.id}>
                      {item.drugName} {item.dose} {item.route && `(${item.route})`} {item.frequency} {item.duration && `for ${item.duration}`}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
