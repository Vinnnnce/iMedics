"use client";

/**
 * Registration & admission workspace.
 *
 * Two views:
 * 1. Dashboard — today's activity, queue counters, drafts and the recent
 *    registration table.
 * 2. Workspace — a guided stepper covering the full admission workflow:
 *    identification (with duplicate review), demographics, contacts &
 *    emergency contacts, medical history & allergies, clinical assessment
 *    with vitals, admission details, insurance, consents, documents and a
 *    review step. Emergency registrations bypass non-essential steps.
 *
 * Steps can be saved as drafts and resumed later. All data entry is reviewed
 * by authorised staff before submission; nothing is sent to external AI.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { computeBmi, computeAge, isMinor } from "@/lib/his/registration";
import { ADMISSION_TYPES, PAYER_CATEGORIES, CONSENT_CATALOGUE } from "@/lib/his/registration";
import { Activity, ClipboardList, Search, Save, UserPlus, CheckCircle2, AlertTriangle, FileText, Stethoscope, ShieldCheck } from "lucide-react";

/* ---------------------------------------------------------------- */
/* Types                                                            */
/* ---------------------------------------------------------------- */

interface DashboardData {
  today: { registrations: number; newPatients: number; returningPatients: number; emergency: number; byStatus: Record<string, number> };
  activeAdmissions: number;
  pendingInsuranceVerification: number;
  awaitingTriage: number;
  drafts: { id: string; label: string; updatedAt: string; createdBy: string }[];
  recentRegistrations: {
    id: string; encounterNumber: string; caseNumber: string; patientName: string; type: string;
    priority: string; status: string; department: string | null; isEmergency: boolean;
    registeredAt: string; consentsRecorded: boolean;
  }[];
}

interface SearchHit {
  id: string; caseNumber: string; firstName: string; lastName: string; gender: string;
  dateOfBirth: string; phone: string | null; email: string | null; unidentified: boolean;
  score: number; reasons: string[];
}

interface FormState {
  admissionType: string;
  emergency: boolean;
  patientMode: "EXISTING" | "NEW" | "TEMPORARY";
  caseNumber: string;
  dob: string;
  temporaryLabel: string;
  firstName: string; lastName: string; middleName: string; preferredName: string;
  gender: string; newDob: string; maritalStatus: string; nationality: string;
  preferredLanguage: string; occupation: string; identityNumber: string; identityVerified: boolean;
  phone: string; altPhone: string; email: string; preferredContactMethod: string;
  addressLine1: string; city: string; state: string; country: string; postalCode: string;
  ecName: string; ecRelationship: string; ecPhone: string;
  guardianName: string; guardianRelationship: string; guardianPhone: string; guardianAuthority: string;
  medicalHistory: string; chronicConditions: string; previousAdmissions: string;
  surgeries: string; familyHistory: string; socialHistory: string; smoking: string; alcohol: string;
  immunisations: string;
  currentMedications: string; previousMedications: string; medicationAdherence: string;
  drugAllergies: string; foodAllergies: string; environmentalAllergies: string; allergyReactions: string;
  presentingComplaint: string; historyOfComplaint: string; durationOfSymptoms: string;
  examinationFindings: string; provisionalDiagnosis: string; initialTreatment: string;
  systolic: string; diastolic: string; heartRate: string; respiratoryRate: string;
  temperatureC: string; spo2: string; weightKg: string; heightCm: string; glucoseMmolL: string; painScore: string;
  department: string; clinicianName: string; responsibleConsultant: string;
  reasonForAdmission: string; expectedDischarge: string; isolationRequirements: string; specialCareNotes: string;
  wardId: string; bedId: string;
  referralSource: string; arrivalMode: string;
  payerCategory: string; providerName: string; planName: string; memberNumber: string;
  policyNumber: string; principalMemberName: string; dependentRelationship: string;
  coverageStart: string; coverageEnd: string; authorizationNumber: string; copay: string;
  consents: Record<string, "GIVEN" | "REFUSED" | "NOT_APPLICABLE">;
  acknowledgedDuplicateIds: string[];
}

const EMPTY_FORM: FormState = {
  admissionType: "OUTPATIENT", emergency: false, patientMode: "NEW",
  caseNumber: "", dob: "", temporaryLabel: "",
  firstName: "", lastName: "", middleName: "", preferredName: "",
  gender: "", newDob: "", maritalStatus: "", nationality: "",
  preferredLanguage: "", occupation: "", identityNumber: "", identityVerified: false,
  phone: "", altPhone: "", email: "", preferredContactMethod: "",
  addressLine1: "", city: "", state: "", country: "", postalCode: "",
  ecName: "", ecRelationship: "", ecPhone: "",
  guardianName: "", guardianRelationship: "", guardianPhone: "", guardianAuthority: "",
  medicalHistory: "", chronicConditions: "", previousAdmissions: "",
  surgeries: "", familyHistory: "", socialHistory: "", smoking: "", alcohol: "",
  immunisations: "",
  currentMedications: "", previousMedications: "", medicationAdherence: "",
  drugAllergies: "", foodAllergies: "", environmentalAllergies: "", allergyReactions: "",
  presentingComplaint: "", historyOfComplaint: "", durationOfSymptoms: "",
  examinationFindings: "", provisionalDiagnosis: "", initialTreatment: "",
  systolic: "", diastolic: "", heartRate: "", respiratoryRate: "",
  temperatureC: "", spo2: "", weightKg: "", heightCm: "", glucoseMmolL: "", painScore: "",
  department: "", clinicianName: "", responsibleConsultant: "",
  reasonForAdmission: "", expectedDischarge: "", isolationRequirements: "", specialCareNotes: "",
  wardId: "", bedId: "",
  referralSource: "", arrivalMode: "",
  payerCategory: "SELF_PAY", providerName: "", planName: "", memberNumber: "",
  policyNumber: "", principalMemberName: "", dependentRelationship: "",
  coverageStart: "", coverageEnd: "", authorizationNumber: "", copay: "",
  consents: {},
  acknowledgedDuplicateIds: [],
};

const STEPS = [
  { id: 1, label: "Identification", icon: Search, essential: true },
  { id: 2, label: "Personal details", icon: UserPlus, essential: true },
  { id: 3, label: "Contacts & NOK", icon: ClipboardList, essential: false },
  { id: 4, label: "History & allergies", icon: Stethoscope, essential: false },
  { id: 5, label: "Assessment & vitals", icon: Activity, essential: true },
  { id: 6, label: "Admission details", icon: ClipboardList, essential: true },
  { id: 7, label: "Insurance", icon: ShieldCheck, essential: false },
  { id: 8, label: "Consent", icon: FileText, essential: true },
  { id: 9, label: "Documents", icon: FileText, essential: false },
  { id: 10, label: "Review & confirm", icon: CheckCircle2, essential: true },
] as const;

/* ---------------------------------------------------------------- */
/* Component                                                        */
/* ---------------------------------------------------------------- */

export function RegistrationWorkspace() {
  const { theme } = useTheme();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [view, setView] = useState<"dashboard" | "workspace">("dashboard");
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [showDuplicates, setShowDuplicates] = useState(false);

  const loadDashboard = useCallback(async () => {
    const res = await fetch("/api/facility/his/registration");
    if (res.ok) setDashboard(await res.json());
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void loadDashboard(), 0);
    return () => clearTimeout(first);
  }, [loadDashboard]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const minor = form.newDob ? isMinor(form.newDob) : false;
  const age = form.newDob ? computeAge(form.newDob) : null;
  const bmi = computeBmi({ weightKg: form.weightKg ? Number(form.weightKg) : undefined, heightCm: form.heightCm ? Number(form.heightCm) : undefined });

  const config = useMemo(() => ADMISSION_TYPES.find((t) => t.value === form.admissionType) ?? ADMISSION_TYPES[0], [form.admissionType]);
  const visibleSteps = STEPS.filter((s) => !form.emergency || s.essential);

  /* ------------------------- dashboard --------------------------- */

  if (view === "dashboard") {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Registration & admission</h2>
            <p className="text-sm text-muted-foreground">
              Today&#39;s registrations, queues and pending work across the facility.
            </p>
          </div>
          <Button
            onClick={() => { setForm(EMPTY_FORM); setStep(1); setView("workspace"); setSuccess(null); setError(null); setDraftId(null); }}
          >
            <UserPlus className="mr-2 h-4 w-4" /> New registration
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Today's registrations", value: dashboard?.today.registrations ?? "–" },
            { label: "New patients", value: dashboard?.today.newPatients ?? "–" },
            { label: "Returning patients", value: dashboard?.today.returningPatients ?? "–" },
            { label: "Emergency", value: dashboard?.today.emergency ?? "–" },
            { label: "Active admissions", value: dashboard?.activeAdmissions ?? "–" },
            { label: "Insurance pending", value: dashboard?.pendingInsuranceVerification ?? "–" },
          ].map((k) => (
            <Card key={k.label}>
              <CardHeader className="pb-1"><CardTitle className="text-xs font-medium text-muted-foreground">{k.label}</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{k.value}</div></CardContent>
            </Card>
          ))}
        </div>

        {dashboard && dashboard.drafts.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Incomplete registration drafts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {dashboard.drafts.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                  <div>
                    <div className="font-medium">{d.label}</div>
                    <div className="text-xs text-muted-foreground">
                      by {d.createdBy} · updated {new Date(d.updatedAt).toLocaleString()}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => void openDraft(d.id)}>Resume</Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Recent registrations</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Encounter</TableHead><TableHead>Patient</TableHead><TableHead>Type</TableHead>
                  <TableHead>Status</TableHead><TableHead>Consents</TableHead><TableHead>Registered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dashboard?.recentRegistrations ?? []).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs">{r.encounterNumber}</TableCell>
                    <TableCell>
                      <div className="font-medium">{r.patientName}</div>
                      <div className="text-xs text-muted-foreground">{r.caseNumber}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Badge variant="outline">{r.type.replace(/_/g, " ").toLowerCase()}</Badge>
                        {r.isEmergency && <Badge variant="destructive">ER</Badge>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary">{r.status.replace(/_/g, " ").toLowerCase()}</Badge></TableCell>
                    <TableCell>
                      {r.consentsRecorded
                        ? <Badge className="bg-emerald-600 text-white dark:bg-emerald-600">Recorded</Badge>
                        : <Badge variant="outline" className="text-amber-600 dark:text-amber-400">Missing</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(r.registeredAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
                {dashboard && dashboard.recentRegistrations.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No registrations yet today.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <span className="hidden">{theme}</span>
      </div>
    );
  }

  /* ------------------------- workspace --------------------------- */

  async function openDraft(id: string) {
    const res = await fetch(`/api/facility/his/registration/drafts/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({}) });
    if (!res.ok) { setError("Draft could not be opened."); return; }
    const json = await res.json();
    const payload = (json.draft?.payload ?? {}) as Partial<FormState> & { step?: number };
    setForm({ ...EMPTY_FORM, ...payload, consents: payload.consents ?? {} });
    setDraftId(id);
    setStep(payload.step && payload.step >= 1 && payload.step <= 10 ? payload.step : 1);
    setView("workspace");
    setError(null);
  }

  async function saveDraft() {
    setBusy(true); setError(null);
    try {
      const label = form.patientMode === "EXISTING"
        ? `Registration — ${form.caseNumber}`
        : form.patientMode === "TEMPORARY"
          ? `Registration — ${form.temporaryLabel || "unidentified"}`
          : `Registration — ${form.firstName} ${form.lastName}`.trim();
      const body = { label, payload: { ...form, step } };
      const res = draftId
        ? await fetch(`/api/facility/his/registration/drafts/${draftId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/facility/his/registration/drafts", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Draft could not be saved");
      if (!draftId) {
        const json = await res.json();
        setDraftId(json.draft.id);
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Draft could not be saved");
    } finally {
      setBusy(false);
    }
  }

  async function runSearch() {
    if (searchQuery.trim().length < 2) return;
    setBusy(true);
    try {
      const res = await fetch("/api/facility/his/registration/search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim() }),
      });
      const json = await res.json();
      setSearchHits(json.patients ?? []);
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true); setError(null); setSuccess(null);
    try {
      const payload = buildPayload();
      const res = await fetch("/api/facility/his/registration", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setError("Possible duplicates must be reviewed before this patient can be registered.");
          setShowDuplicates(true);
        } else {
          setError(json.error ?? "Registration failed");
        }
        return;
      }
      setSuccess(`Registration complete — encounter ${json.encounter?.encounterNumber ?? "created"}${json.admissionNumber ? `, admission ${json.admissionNumber}` : ""}.`);
      setDraftId(null);
      await loadDashboard();
    } finally {
      setBusy(false);
    }
  }

  function buildPayload() {
    const num = (v: string) => (v === "" ? undefined : Number(v));
    const str = (v: string) => (v === "" ? undefined : v);
    return {
      draftId: draftId ?? undefined,
      admissionType: form.admissionType,
      emergency: form.emergency || form.admissionType === "EMERGENCY_DEPARTMENT",
      arrivalMode: str(form.arrivalMode),
      referralSource: str(form.referralSource),
      department: str(form.department),
      clinicianName: str(form.clinicianName),
      responsibleConsultant: str(form.responsibleConsultant),
      wardId: str(form.wardId), bedId: str(form.bedId),
      reasonForAdmission: str(form.reasonForAdmission),
      expectedDischarge: str(form.expectedDischarge),
      isolationRequirements: str(form.isolationRequirements),
      specialCareNotes: str(form.specialCareNotes),
      knownAllergies: [form.drugAllergies, form.foodAllergies, form.environmentalAllergies].filter(Boolean).join("; ") || undefined,
      patient:
        form.patientMode === "EXISTING"
          ? { mode: "EXISTING", caseNumber: form.caseNumber.trim(), dateOfBirth: form.dob }
          : form.patientMode === "TEMPORARY"
            ? { mode: "TEMPORARY", temporaryLabel: form.temporaryLabel }
            : {
                mode: "NEW",
                acknowledgedDuplicateIds: form.acknowledgedDuplicateIds,
                data: {
                  firstName: form.firstName.trim(), lastName: form.lastName.trim(),
                  middleName: str(form.middleName), preferredName: str(form.preferredName),
                  dateOfBirth: form.newDob, gender: form.gender,
                  maritalStatus: str(form.maritalStatus), nationality: str(form.nationality),
                  preferredLanguage: str(form.preferredLanguage), occupation: str(form.occupation),
                  identityNumber: str(form.identityNumber), identityVerified: form.identityVerified,
                  phone: str(form.phone), altPhone: str(form.altPhone), email: str(form.email),
                  preferredContactMethod: str(form.preferredContactMethod),
                  addressLine1: str(form.addressLine1), city: str(form.city), state: str(form.state),
                  country: str(form.country), postalCode: str(form.postalCode),
                  emergencyContacts: form.ecName ? [{ name: form.ecName, relationship: str(form.ecRelationship), phone: str(form.ecPhone) }] : [],
                  guardian: form.guardianName ? { name: form.guardianName, relationship: str(form.guardianRelationship), phone: str(form.guardianPhone), authority: str(form.guardianAuthority) } : undefined,
                },
              },
      assessment: {
        presentingComplaint: str(form.presentingComplaint),
        historyOfComplaint: str(form.historyOfComplaint),
        durationOfSymptoms: str(form.durationOfSymptoms),
        examinationFindings: str(form.examinationFindings),
        provisionalDiagnosis: str(form.provisionalDiagnosis),
        relevantConditions: str(form.chronicConditions),
        initialTreatment: str(form.initialTreatment),
        vitals: (form.systolic || form.heartRate || form.temperatureC || form.spo2 || form.weightKg || form.heightCm) ? {
          systolic: num(form.systolic), diastolic: num(form.diastolic), heartRate: num(form.heartRate),
          respiratoryRate: num(form.respiratoryRate), temperatureC: num(form.temperatureC), spo2: num(form.spo2),
          weightKg: num(form.weightKg), heightCm: num(form.heightCm), glucoseMmolL: num(form.glucoseMmolL), painScore: num(form.painScore),
        } : undefined,
      },
      coverage: form.payerCategory === "SELF_PAY" && !form.providerName ? undefined : {
        category: form.payerCategory,
        providerName: str(form.providerName), planName: str(form.planName),
        memberNumber: str(form.memberNumber), policyNumber: str(form.policyNumber),
        principalMemberName: str(form.principalMemberName), dependentRelationship: str(form.dependentRelationship),
        coverageStart: str(form.coverageStart), coverageEnd: str(form.coverageEnd),
        authorizationNumber: str(form.authorizationNumber), copayKobo: form.copay ? Math.round(Number(form.copay) * 100) : undefined,
      },
      consents: CONSENT_CATALOGUE
        .filter((c) => form.consents[c.key])
        .map((c) => ({ key: c.key, title: c.title, version: c.version, status: form.consents[c.key], signedByRole: "PATIENT" as const })),
    };
  }

  const progress = Math.round(((step - 1) / (visibleSteps.length - 1)) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => { setView("dashboard"); void loadDashboard(); }}>&larr; Back to dashboard</Button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void saveDraft()} disabled={busy}>
            <Save className="mr-2 h-4 w-4" /> Save draft
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {success}
        </div>
      )}

      <Progress value={progress} />

      {/* Stepper */}
      <div className="flex flex-wrap gap-2">
        {visibleSteps.map((s) => (
          <button
            key={s.id}
            onClick={() => setStep(s.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              step === s.id
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
          >
            <s.icon className="h-3.5 w-3.5" />
            {s.id}. {s.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label>Admission type</Label>
                <Select value={form.admissionType} onValueChange={(v) => set("admissionType", v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ADMISSION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="flex items-center gap-2">
                  <input type="checkbox" checked={form.emergency} onChange={(e) => set("emergency", e.target.checked)} className="h-4 w-4" />
                  Emergency workflow — bypass non-essential steps, defer non-critical consents
                </Label>
              </div>
              <div>
                <Label>Patient identification</Label>
                <div className="flex flex-wrap gap-2">
                  {(["EXISTING", "NEW", "TEMPORARY"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => set("patientMode", m)}
                      className={`rounded-md border px-3 py-1.5 text-sm ${form.patientMode === m ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-accent"}`}
                    >
                      {m === "EXISTING" ? "Existing patient" : m === "NEW" ? "New patient" : "Unidentified (emergency)"}
                    </button>
                  ))}
                </div>
              </div>

              {form.patientMode === "EXISTING" && (
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>Patient ID / case number</Label><Input value={form.caseNumber} onChange={(e) => set("caseNumber", e.target.value)} placeholder="MC-XXXXXXXX" /></div>
                  <div><Label>Date of birth (verification)</Label><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></div>
                </div>
              )}
              {form.patientMode === "TEMPORARY" && (
                <div>
                  <Label>Temporary description label</Label>
                  <Input value={form.temporaryLabel} onChange={(e) => set("temporaryLabel", e.target.value)} placeholder="e.g. Male, red jacket, RTA" />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Temporary records are clearly flagged and can be reconciled with the real patient identity later.
                  </p>
                </div>
              )}
              {form.patientMode === "NEW" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by name, DOB, phone, email, case number…" />
                    <Button variant="outline" onClick={() => void runSearch()} disabled={busy}><Search className="h-4 w-4" /></Button>
                  </div>
                  {searchHits && (
                    <div className="space-y-2">
                      {searchHits.length === 0 && <p className="text-sm text-muted-foreground">No existing patients matched — safe to register as new.</p>}
                      {searchHits.map((h) => (
                        <div key={h.id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                          <div>
                            <div className="font-medium">{h.firstName} {h.lastName} {h.unidentified && <Badge variant="destructive">Unidentified</Badge>}</div>
                            <div className="text-xs text-muted-foreground">
                              {h.caseNumber} · DOB {h.dateOfBirth}
                              {h.score > 0 && ` · ${Math.round(h.score * 100)}% possible match`}
                            </div>
                            {h.reasons.length > 0 && <div className="mt-0.5 text-xs text-amber-600 dark:text-amber-400">{h.reasons.join(" · ")}</div>}
                          </div>
                          <Button size="sm" variant="outline" onClick={() => { set("patientMode", "EXISTING"); set("caseNumber", h.caseNumber); set("dob", h.dateOfBirth); }}>
                            This is the patient
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 2 && form.patientMode === "NEW" && (
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>First name *</Label><Input value={form.firstName} onChange={(e) => set("firstName", e.target.value)} /></div>
              <div><Label>Middle name</Label><Input value={form.middleName} onChange={(e) => set("middleName", e.target.value)} /></div>
              <div><Label>Last name *</Label><Input value={form.lastName} onChange={(e) => set("lastName", e.target.value)} /></div>
              <div><Label>Preferred name</Label><Input value={form.preferredName} onChange={(e) => set("preferredName", e.target.value)} /></div>
              <div>
                <Label>Date of birth *</Label>
                <Input type="date" value={form.newDob} onChange={(e) => set("newDob", e.target.value)} />
                {age !== null && <p className="mt-1 text-xs text-muted-foreground">Age: {age} years{minor ? " — guardian details required" : ""}</p>}
              </div>
              <div>
                <Label>Sex *</Label>
                <Select value={form.gender} onValueChange={(v) => set("gender", v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem><SelectItem value="OTHER">Other</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Marital status</Label><Input value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)} /></div>
              <div><Label>Nationality</Label><Input value={form.nationality} onChange={(e) => set("nationality", e.target.value)} /></div>
              <div><Label>Preferred language</Label><Input value={form.preferredLanguage} onChange={(e) => set("preferredLanguage", e.target.value)} /></div>
              <div><Label>Occupation</Label><Input value={form.occupation} onChange={(e) => set("occupation", e.target.value)} /></div>
              <div><Label>Identity number (NIN/passport)</Label><Input value={form.identityNumber} onChange={(e) => set("identityNumber", e.target.value)} /></div>
              <div>
                <Label className="flex items-center gap-2 pt-6">
                  <input type="checkbox" checked={form.identityVerified} onChange={(e) => set("identityVerified", e.target.checked)} className="h-4 w-4" />
                  Identity document verified
                </Label>
              </div>
            </div>
          )}
          {step === 2 && form.patientMode !== "NEW" && (
            <p className="text-sm text-muted-foreground">
              {form.patientMode === "EXISTING" ? "Existing patient — demographics come from the verified record." : "Unidentified emergency patient — demographics are completed after reconciliation."}
            </p>
          )}

          {step === 3 && form.patientMode === "NEW" && (
            <div className="grid gap-3 md:grid-cols-3">
              <div><Label>Primary phone</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
              <div><Label>Alternative phone</Label><Input value={form.altPhone} onChange={(e) => set("altPhone", e.target.value)} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
              <div>
                <Label>Preferred contact method</Label>
                <Select value={form.preferredContactMethod} onValueChange={(v) => set("preferredContactMethod", v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHONE">Phone call</SelectItem><SelectItem value="SMS">SMS</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem><SelectItem value="MAIL">Post</SelectItem><SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3"><Label>Address</Label><Input value={form.addressLine1} onChange={(e) => set("addressLine1", e.target.value)} /></div>
              <div><Label>City</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
              <div><Label>Region / state</Label><Input value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
              <div><Label>Country</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
              <div><Label>Postal code</Label><Input value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} /></div>
              <div className="md:col-span-3 border-t pt-3">
                <h4 className="mb-2 text-sm font-medium">Emergency contact / next of kin</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>Full name</Label><Input value={form.ecName} onChange={(e) => set("ecName", e.target.value)} /></div>
                  <div><Label>Relationship</Label><Input value={form.ecRelationship} onChange={(e) => set("ecRelationship", e.target.value)} /></div>
                  <div><Label>Phone</Label><Input value={form.ecPhone} onChange={(e) => set("ecPhone", e.target.value)} /></div>
                </div>
              </div>
              <div className="md:col-span-3 border-t pt-3">
                <h4 className="mb-2 text-sm font-medium">
                  Guardian / authorised representative {minor && <span className="text-red-600 dark:text-red-400">(required for this minor)</span>}
                </h4>
                <div className="grid gap-3 md:grid-cols-4">
                  <div><Label>Full name</Label><Input value={form.guardianName} onChange={(e) => set("guardianName", e.target.value)} /></div>
                  <div><Label>Relationship</Label><Input value={form.guardianRelationship} onChange={(e) => set("guardianRelationship", e.target.value)} /></div>
                  <div><Label>Phone</Label><Input value={form.guardianPhone} onChange={(e) => set("guardianPhone", e.target.value)} /></div>
                  <div><Label>Legal authority</Label><Input value={form.guardianAuthority} onChange={(e) => set("guardianAuthority", e.target.value)} placeholder="e.g. parent, court order" /></div>
                </div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>Previous illnesses / medical history</Label><Textarea rows={2} value={form.medicalHistory} onChange={(e) => set("medicalHistory", e.target.value)} /></div>
                <div><Label>Chronic diseases / relevant conditions</Label><Textarea rows={2} value={form.chronicConditions} onChange={(e) => set("chronicConditions", e.target.value)} /></div>
                <div><Label>Previous hospital admissions</Label><Textarea rows={2} value={form.previousAdmissions} onChange={(e) => set("previousAdmissions", e.target.value)} /></div>
                <div><Label>Previous surgeries / procedures</Label><Textarea rows={2} value={form.surgeries} onChange={(e) => set("surgeries", e.target.value)} /></div>
                <div><Label>Family medical history</Label><Textarea rows={2} value={form.familyHistory} onChange={(e) => set("familyHistory", e.target.value)} /></div>
                <div><Label>Social history</Label><Textarea rows={2} value={form.socialHistory} onChange={(e) => set("socialHistory", e.target.value)} /></div>
                <div><Label>Smoking history</Label><Input value={form.smoking} onChange={(e) => set("smoking", e.target.value)} /></div>
                <div><Label>Alcohol / substance use</Label><Input value={form.alcohol} onChange={(e) => set("alcohol", e.target.value)} /></div>
                <div className="md:col-span-2"><Label>Immunisation history</Label><Input value={form.immunisations} onChange={(e) => set("immunisations", e.target.value)} /></div>
              </div>
              <div className="border-t pt-3">
                <h4 className="mb-2 text-sm font-medium">Medications</h4>
                <div className="grid gap-3 md:grid-cols-3">
                  <div><Label>Current medications</Label><Textarea rows={2} value={form.currentMedications} onChange={(e) => set("currentMedications", e.target.value)} /></div>
                  <div><Label>Previous medications</Label><Textarea rows={2} value={form.previousMedications} onChange={(e) => set("previousMedications", e.target.value)} /></div>
                  <div><Label>Adherence notes</Label><Textarea rows={2} value={form.medicationAdherence} onChange={(e) => set("medicationAdherence", e.target.value)} /></div>
                </div>
              </div>
              <div className="border-t pt-3">
                <h4 className="mb-2 text-sm font-medium">Allergies — severe verified allergies are shown prominently to clinicians</h4>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>Drug allergies</Label><Input value={form.drugAllergies} onChange={(e) => set("drugAllergies", e.target.value)} /></div>
                  <div><Label>Food allergies</Label><Input value={form.foodAllergies} onChange={(e) => set("foodAllergies", e.target.value)} /></div>
                  <div><Label>Environmental allergies</Label><Input value={form.environmentalAllergies} onChange={(e) => set("environmentalAllergies", e.target.value)} /></div>
                  <div><Label>Reaction description / severity</Label><Input value={form.allergyReactions} onChange={(e) => set("allergyReactions", e.target.value)} /></div>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              <div className="grid gap-3 md:grid-cols-2">
                <div><Label>Presenting complaint</Label><Textarea rows={2} value={form.presentingComplaint} onChange={(e) => set("presentingComplaint", e.target.value)} /></div>
                <div><Label>History of presenting complaint</Label><Textarea rows={2} value={form.historyOfComplaint} onChange={(e) => set("historyOfComplaint", e.target.value)} /></div>
                <div><Label>Duration of symptoms</Label><Input value={form.durationOfSymptoms} onChange={(e) => set("durationOfSymptoms", e.target.value)} placeholder="e.g. 3 days" /></div>
                <div><Label>Initial treatment already received</Label><Input value={form.initialTreatment} onChange={(e) => set("initialTreatment", e.target.value)} /></div>
                <div><Label>Examination findings</Label><Textarea rows={2} value={form.examinationFindings} onChange={(e) => set("examinationFindings", e.target.value)} /></div>
                <div><Label>Provisional diagnosis</Label><Textarea rows={2} value={form.provisionalDiagnosis} onChange={(e) => set("provisionalDiagnosis", e.target.value)} /></div>
              </div>
              <div className="border-t pt-3">
                <h4 className="mb-2 text-sm font-medium">Vital signs</h4>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  <div><Label>Blood pressure (sys/dias)</Label><div className="flex gap-1"><Input value={form.systolic} onChange={(e) => set("systolic", e.target.value)} placeholder="120" /><Input value={form.diastolic} onChange={(e) => set("diastolic", e.target.value)} placeholder="80" /></div></div>
                  <div><Label>Heart rate</Label><Input value={form.heartRate} onChange={(e) => set("heartRate", e.target.value)} /></div>
                  <div><Label>Resp. rate</Label><Input value={form.respiratoryRate} onChange={(e) => set("respiratoryRate", e.target.value)} /></div>
                  <div><Label>Temp. (°C)</Label><Input value={form.temperatureC} onChange={(e) => set("temperatureC", e.target.value)} /></div>
                  <div><Label>SpO₂ (%)</Label><Input value={form.spo2} onChange={(e) => set("spo2", e.target.value)} /></div>
                  <div><Label>Weight (kg)</Label><Input value={form.weightKg} onChange={(e) => set("weightKg", e.target.value)} /></div>
                  <div><Label>Height (cm)</Label><Input value={form.heightCm} onChange={(e) => set("heightCm", e.target.value)} /></div>
                  <div><Label>Glucose (mmol/L)</Label><Input value={form.glucoseMmolL} onChange={(e) => set("glucoseMmolL", e.target.value)} /></div>
                  <div><Label>Pain score (0–10)</Label><Input value={form.painScore} onChange={(e) => set("painScore", e.target.value)} /></div>
                  <div className="flex items-end"><div className="text-sm text-muted-foreground">BMI: {bmi ?? "—"}</div></div>
                </div>
              </div>
            </div>
          )}

          {step === 6 && (
            <div className="grid gap-3 md:grid-cols-2">
              <div><Label>Department</Label><Input value={form.department} onChange={(e) => set("department", e.target.value)} /></div>
              <div><Label>Attending clinician</Label><Input value={form.clinicianName} onChange={(e) => set("clinicianName", e.target.value)} /></div>
              <div><Label>Responsible consultant</Label><Input value={form.responsibleConsultant} onChange={(e) => set("responsibleConsultant", e.target.value)} /></div>
              <div><Label>Referring facility / doctor</Label><Input value={form.referralSource} onChange={(e) => set("referralSource", e.target.value)} /></div>
              <div><Label>Reason for admission</Label><Textarea rows={2} value={form.reasonForAdmission} onChange={(e) => set("reasonForAdmission", e.target.value)} /></div>
              <div><Label>Expected discharge date</Label><Input type="date" value={form.expectedDischarge} onChange={(e) => set("expectedDischarge", e.target.value)} /></div>
              <div><Label>Isolation requirements</Label><Input value={form.isolationRequirements} onChange={(e) => set("isolationRequirements", e.target.value)} /></div>
              <div><Label>Special care notes</Label><Input value={form.specialCareNotes} onChange={(e) => set("specialCareNotes", e.target.value)} /></div>
              {config.inpatient && (
                <>
                  <div><Label>Ward ID (bed management)</Label><Input value={form.wardId} onChange={(e) => set("wardId", e.target.value)} placeholder="Optional — assign in Wards & Beds" /></div>
                  <div><Label>Bed ID</Label><Input value={form.bedId} onChange={(e) => set("bedId", e.target.value)} /></div>
                </>
              )}
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Admission, encounter and patient identifiers (case number, encounter number, admission number) are generated automatically and audited.
                {config.inpatient ? " This admission type creates an inpatient admission." : " This type registers an outpatient encounter."}
              </p>
            </div>
          )}

          {step === 7 && (
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Payer category</Label>
                <Select value={form.payerCategory} onValueChange={(v) => set("payerCategory", v ?? "")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYER_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace(/_/g, " ").toLowerCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Insurance provider</Label><Input value={form.providerName} onChange={(e) => set("providerName", e.target.value)} /></div>
              <div><Label>Plan name</Label><Input value={form.planName} onChange={(e) => set("planName", e.target.value)} /></div>
              <div><Label>Membership number</Label><Input value={form.memberNumber} onChange={(e) => set("memberNumber", e.target.value)} /></div>
              <div><Label>Policy number</Label><Input value={form.policyNumber} onChange={(e) => set("policyNumber", e.target.value)} /></div>
              <div><Label>Principal member name</Label><Input value={form.principalMemberName} onChange={(e) => set("principalMemberName", e.target.value)} /></div>
              <div><Label>Dependent relationship</Label><Input value={form.dependentRelationship} onChange={(e) => set("dependentRelationship", e.target.value)} /></div>
              <div><Label>Policy start</Label><Input type="date" value={form.coverageStart} onChange={(e) => set("coverageStart", e.target.value)} /></div>
              <div><Label>Policy expiry</Label><Input type="date" value={form.coverageEnd} onChange={(e) => set("coverageEnd", e.target.value)} /></div>
              <div><Label>Pre-authorisation number</Label><Input value={form.authorizationNumber} onChange={(e) => set("authorizationNumber", e.target.value)} /></div>
              <div><Label>Copay (₦)</Label><Input value={form.copay} onChange={(e) => set("copay", e.target.value)} /></div>
              <p className="md:col-span-2 text-xs text-muted-foreground">
                Coverage is recorded as not verified until the payer confirms eligibility — treatment coverage is never assumed automatically.
              </p>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Each acknowledgement is stored with its document version, the staff member who obtained it and a timestamp.
                {form.emergency && " Emergency registrations may defer the general admission consent; it must be completed once the patient is stabilised."}
              </p>
              {CONSENT_CATALOGUE.map((c) => (
                <div key={c.key} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                  <div className="text-sm">
                    <div className="font-medium">{c.title} <span className="text-xs text-muted-foreground">v{c.version}</span></div>
                    {c.required && <div className="text-xs text-amber-600 dark:text-amber-400">Required</div>}
                  </div>
                  <Select value={form.consents[c.key] ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, consents: { ...f.consents, [c.key]: v as "GIVEN" | "REFUSED" | "NOT_APPLICABLE" } }))}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Not recorded" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GIVEN">Acknowledged</SelectItem>
                      <SelectItem value="REFUSED">Refused</SelectItem>
                      <SelectItem value="NOT_APPLICABLE">Not applicable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          )}

          {step === 9 && (
            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                Supporting documents (referral letters, identity documents, previous reports, imaging, insurance documents)
                are uploaded through the facility Documents module, which enforces file-type restrictions, verification
                status, access permissions and audit trails.
              </p>
              <ul className="list-inside list-disc space-y-1 text-muted-foreground">
                <li>After registration, open the patient record to upload documents.</li>
                <li>Only approved and released documents are ever visible to the patient portal.</li>
              </ul>
            </div>
          )}

          {step === 10 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Review before submission</h4>
              <div className="rounded-md border p-3 text-sm">
                <dl className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div><dt className="text-muted-foreground">Admission type</dt><dd className="font-medium">{config.label}</dd></div>
                  <div><dt className="text-muted-foreground">Patient</dt><dd className="font-medium">
                    {form.patientMode === "EXISTING" ? form.caseNumber : form.patientMode === "TEMPORARY" ? `Unidentified — ${form.temporaryLabel}` : `${form.firstName} ${form.lastName}`.trim()}
                  </dd></div>
                  <div><dt className="text-muted-foreground">Department</dt><dd>{form.department || "—"}</dd></div>
                  <div><dt className="text-muted-foreground">Payer</dt><dd>{form.payerCategory.replace(/_/g, " ").toLowerCase()}{form.providerName ? ` — ${form.providerName}` : ""}</dd></div>
                  <div><dt className="text-muted-foreground">Consents recorded</dt><dd>{Object.values(form.consents).filter((v) => v === "GIVEN").length} of {CONSENT_CATALOGUE.length}</dd></div>
                  <div><dt className="text-muted-foreground">Vitals</dt><dd>{form.systolic ? `BP ${form.systolic}/${form.diastolic || "—"}` : "—"}{bmi ? ` · BMI ${bmi}` : ""}</dd></div>
                </dl>
              </div>
              <Button onClick={() => void submit()} disabled={busy || !success === false}>
                {busy ? "Submitting…" : "Complete registration"}
              </Button>
            </div>
          )}

          <div className="flex justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setStep(Math.max(1, step - 1))} disabled={step === 1}>Previous</Button>
            <Button variant="outline" onClick={() => setStep(Math.min(visibleSteps[visibleSteps.length - 1].id, step + 1))} disabled={step === visibleSteps[visibleSteps.length - 1].id}>Next</Button>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate review dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent>
          <DialogHeader><DialogTitle>Possible duplicate patient records</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              These records look similar to the patient being registered. Review them carefully — creating a duplicate
              record fragments clinical history. If none of them is this patient, acknowledge each one to continue.
            </p>
            {(searchHits ?? []).filter((h) => h.score >= 0.45).map((h) => (
              <div key={h.id} className="rounded-md border p-2">
                <div className="font-medium">{h.firstName} {h.lastName} ({h.caseNumber})</div>
                <div className="text-xs text-muted-foreground">DOB {h.dateOfBirth} · {h.reasons.join(" · ")}</div>
                <Button
                  size="sm" variant="outline" className="mt-1"
                  onClick={() => setForm((f) => ({ ...f, acknowledgedDuplicateIds: [...f.acknowledgedDuplicateIds, h.id] }))}
                  disabled={form.acknowledgedDuplicateIds.includes(h.id)}
                >
                  {form.acknowledgedDuplicateIds.includes(h.id) ? "Acknowledged" : "Not this patient"}
                </Button>
              </div>
            ))}
            <Button onClick={() => { setShowDuplicates(false); void submit(); }} disabled={busy}>Retry submission</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
