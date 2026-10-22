"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { applyTemplateToFields, TemplatePicker } from "@/components/lab/template-picker";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data;
}

/** Patient lookup + admission registration form (Module 01, Category 01). */
export function CreateAdmissionDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [caseNumber, setCaseNumber] = useState("");
  const [patientId, setPatientId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [form, setForm] = useState({
    ward: "", bed: "", reason: "", initialAssessment: "", workingDiagnosis: "", diagnosisCode: "",
  });

  const lookup = async () => {
    setError(null);
    setPatientId(""); setPatientName("");
    if (!caseNumber.trim()) return setError("Enter the patient's case number");
    const res = await fetch(`/api/facility/patients?caseNumber=${encodeURIComponent(caseNumber.trim())}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.patient) return setError("No patient found with that case number");
    setPatientId(data.patient.id);
    setPatientName(`${data.patient.firstName} ${data.patient.lastName}`);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!patientId) return setError("Look up the patient first");
    if (!form.reason.trim()) return setError("The reason for admission is required");
    setBusy(true);
    try {
      await postJson("/api/facility/admissions", {
        patientId,
        admissionDate: new Date().toISOString(),
        ...form,
        ward: form.ward || undefined,
        bed: form.bed || undefined,
      });
      setOpen(false);
      setCaseNumber(""); setPatientId(""); setPatientName("");
      setForm({ ward: "", bed: "", reason: "", initialAssessment: "", workingDiagnosis: "", diagnosisCode: "" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">New admission</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Register an admission</DialogTitle>
          <DialogDescription>
            Identify the patient by case number, then record the admission decision and initial assessment.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="caseNumber">Patient case number</Label>
            <div className="flex gap-2">
              <Input id="caseNumber" value={caseNumber} onChange={(e) => setCaseNumber(e.target.value)} placeholder="e.g. MC-2026-000123" />
              <Button type="button" variant="secondary" onClick={lookup}>Look up</Button>
            </div>
            {patientName && <p className="text-xs text-muted-foreground">Patient: {patientName}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ward">Ward</Label>
              <Input id="ward" value={form.ward} onChange={(e) => setForm({ ...form, ward: e.target.value })} placeholder="e.g. Internal medicine" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="bed">Bed</Label>
              <Input id="bed" value={form.bed} onChange={(e) => setForm({ ...form, bed: e.target.value })} placeholder="e.g. 214" />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="reason">Reason for admission *</Label>
            <Textarea id="reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor="initialAssessment">Initial assessment / anamnesis</Label>
            <Textarea id="initialAssessment" value={form.initialAssessment} onChange={(e) => setForm({ ...form, initialAssessment: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="workingDiagnosis">Working diagnosis</Label>
              <Input id="workingDiagnosis" value={form.workingDiagnosis} onChange={(e) => setForm({ ...form, workingDiagnosis: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="diagnosisCode">ICD-10 code</Label>
              <Input id="diagnosisCode" value={form.diagnosisCode} onChange={(e) => setForm({ ...form, diagnosisCode: e.target.value })} placeholder="e.g. J18.9" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Register admission
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const NOTE_TYPES = [
  { value: "ADMISSION_EXAMINATION", label: "Admission examination" },
  { value: "PHYSICIAN_PROGRESS", label: "Physician progress note" },
  { value: "NURSING_OBSERVATION", label: "Nursing observation" },
  { value: "SPECIALIST_CONSULTATION", label: "Specialist consultation" },
  { value: "PROCEDURE_REPORT", label: "Procedure / operation report" },
];

/** Daily progress / observation note form (Module 01, Category 03). */
export function AddNoteForm({ admissionId }: { admissionId: string }) {
  const router = useRouter();
  const [type, setType] = useState("PHYSICIAN_PROGRESS");
  const [content, setContent] = useState("");
  const [vitals, setVitals] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!content.trim()) return setError("The note content is required");
    setBusy(true);
    try {
      const body: Record<string, unknown> = { type, content };
      if (vitals.trim()) {
        // Simple "36.8, 72, 120/80" shorthand into structured vitals.
        const parts = vitals.split(",").map((p) => parseFloat(p.trim())).filter((n) => !Number.isNaN(n));
        const v: Record<string, number> = {};
        if (parts[0] !== undefined) v.temperature = parts[0];
        if (parts[1] !== undefined) v.pulse = parts[1];
        const bp = vitals.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
        if (bp) { v.systolic = parseInt(bp[1], 10); v.diastolic = parseInt(bp[2], 10); }
        if (Object.keys(v).length > 0) body.vitals = v;
      }
      await postJson(`/api/facility/admissions/${admissionId}/notes`, body);
      setContent(""); setVitals("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Note type</Label>
          <Select value={type} onValueChange={(v) => setType(v ?? "PHYSICIAN_PROGRESS")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {NOTE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="vitals">Vitals (temp °C, pulse, BP)</Label>
          <Input id="vitals" value={vitals} onChange={(e) => setVitals(e.target.value)} placeholder="36.8, 72, 120/80" />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="content">Note *</Label>
        <Textarea id="content" value={content} onChange={(e) => setContent(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add note
      </Button>
    </form>
  );
}

/** Ward transfer or interfacility transfer (Module 01, Category 05). */
export function TransferForm({ admissionId }: { admissionId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"ward" | "facility">("ward");
  const [toWard, setToWard] = useState("");
  const [reason, setReason] = useState("");
  const [toFacilityId, setToFacilityId] = useState("");
  const [summary, setSummary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await postJson(`/api/facility/admissions/${admissionId}/transfers`, mode === "ward"
        ? { toWard: toWard || undefined, reason: reason || undefined }
        : { toFacilityId, summary: summary || undefined });
      setToWard(""); setReason(""); setToFacilityId(""); setSummary("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        <Button type="button" size="sm" variant={mode === "ward" ? "default" : "outline"} onClick={() => setMode("ward")}>Internal ward transfer</Button>
        <Button type="button" size="sm" variant={mode === "facility" ? "default" : "outline"} onClick={() => setMode("facility")}>Interfacility transfer</Button>
      </div>
      {mode === "ward" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>To ward *</Label>
            <Input value={toWard} onChange={(e) => setToWard(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Reason</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Receiving facility ID *</Label>
            <Input value={toFacilityId} onChange={(e) => setToFacilityId(e.target.value)} placeholder="Paste the receiving facility's identifier" required />
          </div>
          <div className="space-y-1">
            <Label>Transfer summary *</Label>
            <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} required />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record transfer
      </Button>
    </form>
  );
}

/** Discharge with mandatory epicrisis (Module 01, Category 05). */
export function DischargeForm({ admissionId }: { admissionId: string }) {
  const router = useRouter();
  const [disposition, setDisposition] = useState("RECOVERED");
  const [finalDiagnosisName, setFinalDiagnosisName] = useState("");
  const [finalDiagnosisCode, setFinalDiagnosisCode] = useState("");
  const [outcome, setOutcome] = useState("");
  const [epicrisis, setEpicrisis] = useState("");
  const [medicationInstructions, setMedicationInstructions] = useState("");
  const [followUpInstructions, setFollowUpInstructions] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!epicrisis.trim()) return setError("The discharge summary (epicrisis) is required");
    setBusy(true);
    try {
      await postJson(`/api/facility/admissions/${admissionId}/discharge`, {
        dischargeDate: new Date().toISOString(),
        disposition,
        finalDiagnosisName: finalDiagnosisName || undefined,
        finalDiagnosisCode: finalDiagnosisCode || undefined,
        outcome: outcome || undefined,
        epicrisis,
        medicationInstructions: medicationInstructions || undefined,
        followUpInstructions: followUpInstructions || undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  const applyTemplate = (content: string) => {
    const fields = {
      finalDiagnosisName,
      finalDiagnosisCode,
      outcome,
      epicrisis,
      medicationInstructions,
      followUpInstructions,
    };
    const next = applyTemplateToFields(content, fields, "epicrisis");
    setFinalDiagnosisName(next.finalDiagnosisName ?? "");
    setFinalDiagnosisCode(next.finalDiagnosisCode ?? "");
    setOutcome(next.outcome ?? "");
    setEpicrisis(next.epicrisis ?? "");
    setMedicationInstructions(next.medicationInstructions ?? "");
    setFollowUpInstructions(next.followUpInstructions ?? "");
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Pre-fill from a saved template</p>
        <TemplatePicker kind="DISCHARGE_SUMMARY" onApply={applyTemplate} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Outcome</Label>
          <Select value={disposition} onValueChange={(v) => setDisposition(v ?? "RECOVERED")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["RECOVERED", "IMPROVED", "UNCHANGED", "WORSE", "DECEASED", "REFERRED"].map((d) => (
                <SelectItem key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Final diagnosis</Label>
          <Input value={finalDiagnosisName} onChange={(e) => setFinalDiagnosisName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>ICD-10 code</Label>
          <Input value={finalDiagnosisCode} onChange={(e) => setFinalDiagnosisCode(e.target.value)} placeholder="e.g. J18.9" />
        </div>
      </div>
      <div className="space-y-1">
        <Label>Treatment outcome</Label>
        <Input value={outcome} onChange={(e) => setOutcome(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label>Discharge summary (epicrisis) *</Label>
        <Textarea value={epicrisis} onChange={(e) => setEpicrisis(e.target.value)} rows={6} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Medication instructions</Label>
          <Textarea value={medicationInstructions} onChange={(e) => setMedicationInstructions(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Follow-up instructions</Label>
          <Textarea value={followUpInstructions} onChange={(e) => setFollowUpInstructions(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={busy} size="sm">
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Discharge patient
      </Button>
    </form>
  );
}
