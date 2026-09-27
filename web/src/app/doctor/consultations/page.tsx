"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ClipboardList, Plus, Trash2, Save, FileText, Activity,
  HeartPulse, FlaskConical, Pill, Stethoscope, CheckCircle2,
  Loader2,
} from "lucide-react";

type PatientOption = {
  id: string;
  name: string;
  email: string;
  dateOfBirth: string | null;
  sex: string | null;
};

type Medication = {
  name: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type Symptom = { name: string; duration: string; severity: string };

type Vitals = {
  bloodPressure: string;
  heartRate: string;
  temperature: string;
  respiratoryRate: string;
  spo2: string;
  weight: string;
  height: string;
};

type ConsultationRecord = {
  id: string;
  chiefComplaint: string | null;
  diagnosis: string | null;
  icdCode: string | null;
  status: string;
  createdAt: string;
  followUpDate: string | null;
  patient: { id: string; name: string; email: string };
  doctor: { id: string; name: string };
};

const emptyVitals: Vitals = {
  bloodPressure: "", heartRate: "", temperature: "",
  respiratoryRate: "", spo2: "", weight: "", height: "",
};

const emptyMedication: Medication = {
  name: "", dose: "", frequency: "", duration: "", instructions: "",
};

export default function DoctorConsultationsPage() {
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [patientId, setPatientId] = useState("");
  const [reports, setReports] = useState<ConsultationRecord[]>([]);
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Report form state
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [historyPresentIllness, setHistoryPresentIllness] = useState("");
  const [pastMedicalHistory, setPastMedicalHistory] = useState("");
  const [symptoms, setSymptoms] = useState<Symptom[]>([{ name: "", duration: "", severity: "mild" }]);
  const [vitals, setVitals] = useState<Vitals>(emptyVitals);
  const [examination, setExamination] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [icdCode, setIcdCode] = useState("");
  const [differentialDiagnosis, setDifferentialDiagnosis] = useState("");
  const [labFindings, setLabFindings] = useState("");
  const [imagingFindings, setImagingFindings] = useState("");
  const [medications, setMedications] = useState<Medication[]>([{ ...emptyMedication }]);
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [notes, setNotes] = useState("");

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const res = await fetch("/api/users?role=PATIENT");
      const data = await res.json();
      setPatients(data.users || []);
    } catch {
      setError("Failed to load patients.");
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const res = await fetch("/api/consultations");
      const data = await res.json();
      setReports(data.consultations || []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    loadPatients();
    loadReports();
  }, [loadPatients, loadReports]);

  const resetForm = () => {
    setChiefComplaint(""); setHistoryPresentIllness(""); setPastMedicalHistory("");
    setSymptoms([{ name: "", duration: "", severity: "mild" }]);
    setVitals(emptyVitals); setExamination(""); setDiagnosis(""); setIcdCode("");
    setDifferentialDiagnosis(""); setLabFindings(""); setImagingFindings("");
    setMedications([{ ...emptyMedication }]); setTreatmentPlan("");
    setRecommendations(""); setFollowUpDate(""); setNotes("");
  };

  const handleSave = async () => {
    setError(""); setMessage("");
    if (!patientId) {
      setError("Select a patient first.");
      return;
    }
    if (!diagnosis.trim()) {
      setError("A diagnosis is required before saving the report.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/consultations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId,
          chiefComplaint,
          historyPresentIllness,
          pastMedicalHistory,
          symptoms: symptoms.filter((s) => s.name.trim()),
          vitals,
          examination,
          diagnosis,
          icdCode,
          differentialDiagnosis,
          labFindings,
          imagingFindings,
          medications: medications.filter((m) => m.name.trim()),
          treatmentPlan,
          recommendations,
          followUpDate: followUpDate || undefined,
          notes,
          status: "finalized",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to save the consultation report.");
        return;
      }
      setMessage(`Consultation report saved for ${data.consultation.patient.name}.`);
      resetForm();
      loadReports();
    } catch {
      setError("Failed to save the consultation report. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const selectedPatient = patients.find((p) => p.id === patientId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Write Consultation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Record a structured consultation report after consulting a patient — complaints, anamnesis, examination with vitals, diagnosis, laboratory and diagnostic findings, prescriptions, and treatment plan.
        </p>
      </div>

      {message && (
        <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm flex items-center gap-2" data-testid="text-report-saved">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> {message}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm" data-testid="text-report-error">
          {error}
        </div>
      )}

      {/* Patient selector */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Patient</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={patientId} onValueChange={(v) => setPatientId(v || "")}>
            <SelectTrigger className="rounded-lg" data-testid="select-patient">
              <SelectValue placeholder={loadingPatients ? "Loading patients..." : "Select patient"} />
            </SelectTrigger>
            <SelectContent>
              {patients.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} — {p.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPatient && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {selectedPatient.dateOfBirth && (
                <span className="status-badge bg-muted">DOB: {new Date(selectedPatient.dateOfBirth).toLocaleDateString()}</span>
              )}
              {selectedPatient.sex && <span className="status-badge bg-muted">Sex: {selectedPatient.sex}</span>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chief complaint & anamnesis */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-5 w-5 text-foreground" />
            Complaints & Anamnesis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="chiefComplaint">Chief Complaint</Label>
            <Input
              id="chiefComplaint"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Chest pain on exertion for 3 days"
              className="rounded-lg"
              data-testid="input-chief-complaint"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hpi">History of Present Illness</Label>
            <Textarea
              id="hpi"
              value={historyPresentIllness}
              onChange={(e) => setHistoryPresentIllness(e.target.value)}
              placeholder="Onset, duration, character, aggravating and relieving factors, associated symptoms..."
              className="rounded-lg"
              rows={3}
              data-testid="input-hpi"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pmh">Past Medical History, Allergies, Family & Social History</Label>
            <Textarea
              id="pmh"
              value={pastMedicalHistory}
              onChange={(e) => setPastMedicalHistory(e.target.value)}
              placeholder="Chronic conditions, previous surgeries, medications, allergies, family and social history..."
              className="rounded-lg"
              rows={3}
              data-testid="input-pmh"
            />
          </div>

          {/* Symptoms */}
          <div className="space-y-2">
            <Label>Symptoms</Label>
            <div className="space-y-2">
              {symptoms.map((symptom, i) => (
                <div key={i} className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={symptom.name}
                    onChange={(e) => setSymptoms((prev) => prev.map((s, j) => j === i ? { ...s, name: e.target.value } : s))}
                    placeholder="Symptom (e.g. headache)"
                    className="rounded-lg flex-1"
                    data-testid={`input-symptom-${i}`}
                  />
                  <Input
                    value={symptom.duration}
                    onChange={(e) => setSymptoms((prev) => prev.map((s, j) => j === i ? { ...s, duration: e.target.value } : s))}
                    placeholder="Duration (e.g. 3 days)"
                    className="rounded-lg sm:w-44"
                  />
                  <Select
                    value={symptom.severity}
                    onValueChange={(v) => setSymptoms((prev) => prev.map((s, j) => j === i ? { ...s, severity: v || "mild" } : s))}
                  >
                    <SelectTrigger className="rounded-lg sm:w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mild">Mild</SelectItem>
                      <SelectItem value="moderate">Moderate</SelectItem>
                      <SelectItem value="severe">Severe</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg self-start sm:self-auto"
                    onClick={() => setSymptoms((prev) => prev.length === 1 ? [{ name: "", duration: "", severity: "mild" }] : prev.filter((_, j) => j !== i))}
                    aria-label={`Remove symptom ${i + 1}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="rounded-lg"
              onClick={() => setSymptoms((prev) => [...prev, { name: "", duration: "", severity: "mild" }])}
              data-testid="button-add-symptom"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Symptom
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Vitals & examination */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <HeartPulse className="h-5 w-5 text-foreground" />
            Objective Examination & Vitals
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {([
              ["bloodPressure", "Blood Pressure", "e.g. 120/80 mmHg"],
              ["heartRate", "Heart Rate", "e.g. 72 bpm"],
              ["temperature", "Temperature", "e.g. 36.8 °C"],
              ["respiratoryRate", "Respiratory Rate", "e.g. 16 /min"],
              ["spo2", "SpO₂", "e.g. 98 %"],
              ["weight", "Weight", "e.g. 70 kg"],
              ["height", "Height", "e.g. 175 cm"],
            ] as [keyof Vitals, string, string][]).map(([key, label, placeholder]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`vital-${key}`} className="text-xs">{label}</Label>
                <Input
                  id={`vital-${key}`}
                  value={vitals[key]}
                  onChange={(e) => setVitals((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="rounded-lg"
                  data-testid={`input-vital-${key}`}
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <Label htmlFor="examination">Physical Examination Findings</Label>
            <Textarea
              id="examination"
              value={examination}
              onChange={(e) => setExamination(e.target.value)}
              placeholder="General condition, inspection, palpation, auscultation, systems review..."
              className="rounded-lg"
              rows={3}
              data-testid="input-examination"
            />
          </div>
        </CardContent>
      </Card>

      {/* Diagnosis */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-foreground" />
            Diagnosis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="diagnosis">Primary Diagnosis *</Label>
              <Input
                id="diagnosis"
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Essential hypertension"
                className="rounded-lg"
                data-testid="input-diagnosis"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="icd">ICD-10 Code</Label>
              <Input
                id="icd"
                value={icdCode}
                onChange={(e) => setIcdCode(e.target.value)}
                placeholder="e.g. I10"
                className="rounded-lg"
                data-testid="input-icd"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="differential">Differential Diagnosis</Label>
            <Textarea
              id="differential"
              value={differentialDiagnosis}
              onChange={(e) => setDifferentialDiagnosis(e.target.value)}
              placeholder="Alternative diagnoses considered..."
              className="rounded-lg"
              rows={2}
              data-testid="input-differential"
            />
          </div>
        </CardContent>
      </Card>

      {/* Lab & diagnostics */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-foreground" />
            Laboratory & Diagnostic Findings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="labFindings">Laboratory Results</Label>
            <Textarea
              id="labFindings"
              value={labFindings}
              onChange={(e) => setLabFindings(e.target.value)}
              placeholder="Relevant blood, urine, stool or swab analysis results..."
              className="rounded-lg"
              rows={3}
              data-testid="input-lab-findings"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="imagingFindings">Imaging / Instrumental Findings</Label>
            <Textarea
              id="imagingFindings"
              value={imagingFindings}
              onChange={(e) => setImagingFindings(e.target.value)}
              placeholder="X-ray, CT, MRI, ultrasound results..."
              className="rounded-lg"
              rows={3}
              data-testid="input-imaging-findings"
            />
          </div>
        </CardContent>
      </Card>

      {/* Prescriptions */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Pill className="h-5 w-5 text-foreground" />
            Prescriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {medications.map((med, i) => (
            <div key={i} className="space-y-2 p-3 rounded-lg border border-border bg-muted/40">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Medication {i + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-7"
                  onClick={() => setMedications((prev) => prev.length === 1 ? [{ ...emptyMedication }] : prev.filter((_, j) => j !== i))}
                  aria-label={`Remove medication ${i + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <Input
                  value={med.name}
                  onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, name: e.target.value } : m))}
                  placeholder="Drug name (e.g. Amlodipine)"
                  className="rounded-lg"
                  data-testid={`input-med-name-${i}`}
                />
                <Input
                  value={med.dose}
                  onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, dose: e.target.value } : m))}
                  placeholder="Dose (e.g. 5 mg)"
                  className="rounded-lg"
                />
                <Input
                  value={med.frequency}
                  onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, frequency: e.target.value } : m))}
                  placeholder="Frequency (e.g. once daily)"
                  className="rounded-lg"
                />
                <Input
                  value={med.duration}
                  onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, duration: e.target.value } : m))}
                  placeholder="Duration (e.g. 30 days)"
                  className="rounded-lg"
                />
              </div>
              <Input
                value={med.instructions}
                onChange={(e) => setMedications((prev) => prev.map((m, j) => j === i ? { ...m, instructions: e.target.value } : m))}
                placeholder="Instructions (e.g. take in the morning after food)"
                className="rounded-lg"
              />
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            onClick={() => setMedications((prev) => [...prev, { ...emptyMedication }])}
            data-testid="button-add-medication"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Medication
          </Button>
        </CardContent>
      </Card>

      {/* Plan & recommendations */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="h-5 w-5 text-foreground" />
            Treatment Plan & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="treatment">Treatment Plan</Label>
            <Textarea
              id="treatment"
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              placeholder="Prescribed treatment, referrals, lifestyle advice..."
              className="rounded-lg"
              rows={3}
              data-testid="input-treatment-plan"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recommendations">Recommendations</Label>
            <Textarea
              id="recommendations"
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              placeholder="Advice for the patient, warning signs to watch for..."
              className="rounded-lg"
              rows={2}
              data-testid="input-recommendations"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="followUp">Follow-up Date</Label>
              <Input
                id="followUp"
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="rounded-lg"
                data-testid="input-follow-up"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Input
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional remarks"
                className="rounded-lg"
                data-testid="input-notes"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSave}
        disabled={saving || !patientId}
        className="w-full bg-foreground text-background hover:bg-foreground/90 rounded-lg h-12 text-base font-bold disabled:opacity-50"
        data-testid="button-save-report"
      >
        {saving ? (
          <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Saving Report…</>
        ) : (
          <><Save className="h-5 w-5 mr-2" /> Save Consultation Report</>
        )}
      </Button>

      {/* Saved reports */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-foreground" />
            Recent Consultation Reports
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 && (
            <p className="text-sm text-muted-foreground">No consultation reports yet. Saved reports will appear here.</p>
          )}
          {reports.slice(0, 10).map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0 flex-wrap">
              <div className="icon-badge h-8 w-8 bg-muted">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {r.patient.name} — {r.diagnosis || "No diagnosis recorded"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.icdCode ? `ICD-10 ${r.icdCode} · ` : ""}
                  {new Date(r.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
                  {r.followUpDate ? ` · Follow-up: ${new Date(r.followUpDate).toLocaleDateString()}` : ""}
                </p>
              </div>
              <span className={`status-badge ${r.status === "finalized" ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}>
                {r.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center pb-2">
        The consultation report structure follows the electronic medical record format of the JEMYS hospital
        information system (jemys.ru) — complaints, anamnesis, objective examination with vitals, diagnosis,
        laboratory and diagnostic findings, prescriptions, and treatment plan.
      </p>
    </div>
  );
}
