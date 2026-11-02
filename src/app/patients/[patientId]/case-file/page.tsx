import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, FolderOpen, Stethoscope, FlaskConical, FileText, BedDouble,
  Briefcase, ClipboardList, HeartPulse,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";
import { findAccessiblePatient } from "@/lib/access";
import { ageFromDob, formatClinicDateTime, formatDate } from "@/lib/format";
import { calculateBMI } from "@/lib/bmi";

/** Pull display text out of the loosely-structured JSON lists on a medical history. */
function labels(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? keys.map((k) => (item as Record<string, unknown>)[k]).find((v) => typeof v === "string" && v) : null))
    .filter((v): v is string => typeof v === "string");
}

/**
 * The patient's unified electronic case file — the longitudinal record every
 * clinical activity links back to. A doctor may only open the case file of a
 * patient assigned to their care (findAccessiblePatient enforces the same
 * scope as every other patient API).
 */
export default async function PatientCaseFilePage({ params }: { params: Promise<{ patientId: string }> }) {
  const user = await requirePageRole("DOCTOR");
  const { patientId } = await params;
  let patient: Awaited<ReturnType<typeof findAccessiblePatient>>;
  try {
    patient = await findAccessiblePatient(user, patientId);
  } catch {
    // Out of scope or not found — same 404 the patient APIs return.
    notFound();
  }

  const [
    latestHistory, histories, consultations, labResults, prescriptions,
    admissions, careCases, referrals,
  ] = await Promise.all([
    prisma.medicalHistory.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" } }),
    prisma.medicalHistory.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.consultation.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { doctor: { include: { user: { select: { name: true } } } } },
    }),
    prisma.labResult.findMany({
      where: { patientId: patient.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { values: { take: 3 } },
    }),
    prisma.prescription.findMany({
      where: { patientId: patient.id },
      orderBy: { issuedAt: "desc" },
      take: 10,
      include: { items: true, doctor: { include: { user: { select: { name: true } } } } },
    }),
    prisma.admission.findMany({ where: { patientId: patient.id }, orderBy: { admissionDate: "desc" }, take: 10 }),
    prisma.careCase.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 10 }),
    prisma.facilityReferral.findMany({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" }, take: 10 }),
  ]);

  const bmi = calculateBMI(patient.height, patient.weight);
  const allergies = labels(latestHistory?.allergies, ["allergen", "name"]);
  const conditions = labels(latestHistory?.pastHistory, ["diagnosis", "condition", "name"]);
  const currentMedications = labels(latestHistory?.medications, ["name"]).slice(0, 8);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-4">
          <Link
            href={`/patients/${patient.id}`}
            aria-label="Back to patient"
            className={buttonVariants({ variant: "ghost", size: "icon" })}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Patient Case File</h1>
            <p className="text-sm text-muted-foreground">
              {patient.firstName} {patient.lastName} — Case <span className="font-mono">{patient.caseNumber}</span>
            </p>
          </div>
        </div>
        <Badge variant="outline" className="rounded-lg">
          <FolderOpen className="h-3 w-3 mr-1" /> Longitudinal record
        </Badge>
      </div>

      {/* A. Patient identification and medical summary */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Patient identification & medical summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
          <SummaryRow label="Patient" value={`${patient.firstName} ${patient.middleName ?? ""} ${patient.lastName}`} />
          <SummaryRow label="Case number" value={patient.caseNumber} />
          <SummaryRow label="Age" value={`${ageFromDob(patient.dateOfBirth)} (born ${formatDate(patient.dateOfBirth)})`} />
          <SummaryRow label="Gender" value={patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()} />
          <SummaryRow label="Blood group / genotype" value={[patient.bloodGroup, patient.genotype].filter(Boolean).join(" / ") || "—"} />
          <SummaryRow label="Height / weight" value={patient.height && patient.weight ? `${patient.height} cm / ${patient.weight} kg${bmi ? ` (BMI ${bmi.value})` : ""}` : "—"} />
          <SummaryRow label="Emergency contact" value={patient.ecName ? `${patient.ecName}${patient.ecPhone ? ` — ${patient.ecPhone}` : ""}` : "—"} />
          <SummaryRow label="Address" value={[patient.addressLine1, patient.city, patient.state].filter(Boolean).join(", ") || "—"} />
          <SummaryRow label="Allergies" value={allergies.length > 0 ? allergies.join(", ") : "No known allergies recorded"} />
          <SummaryRow label="Chronic conditions" value={conditions.length > 0 ? conditions.join(", ") : "None recorded"} />
          <SummaryRow label="Current medications" value={currentMedications.length > 0 ? currentMedications.join(", ") : "None recorded"} />
        </CardContent>
      </Card>

      {/* B. Medical history */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-4 w-4" /> Medical history
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {histories.length === 0 && <p className="text-sm text-muted-foreground">No medical history recorded yet.</p>}
          {histories.map((h) => (
            <Link key={h.id} href={`/patients/${patient.id}/history`} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:bg-muted/50">
              <div>
                <p className="font-medium">{h.chiefComplaint || "History entry"}</p>
                <p className="text-xs text-muted-foreground">Recorded {formatDate(h.createdAt)}</p>
              </div>
              <Badge variant={h.status === "COMPLETE" ? "default" : "secondary"} className="rounded-lg">{h.status === "COMPLETE" ? "Complete" : "Draft"}</Badge>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* C. Consultation documents */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Stethoscope className="h-4 w-4" /> Consultations
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {consultations.length === 0 && <p className="text-sm text-muted-foreground">No consultations recorded.</p>}
          {consultations.map((c) => (
            <div key={c.id} className="flex items-start justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{c.chiefComplaint || "Consultation"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatClinicDateTime(c.createdAt)} — {c.doctor.user.name}
                  {c.diagnosis ? ` — ${c.diagnosis}` : ""}
                </p>
              </div>
              <Badge variant={c.status === "FINALIZED" ? "default" : "secondary"} className="shrink-0 rounded-lg">
                {c.status === "FINALIZED" ? "Finalised" : "Draft"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* E. Laboratory documents and results */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-4 w-4" /> Laboratory results
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {labResults.length === 0 && <p className="text-sm text-muted-foreground">No laboratory results on file.</p>}
          {labResults.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium">{r.panelType}</p>
                <p className="text-xs text-muted-foreground">
                  Sampled {formatDate(r.testDate)}
                  {r.interpretation ? ` — ${r.interpretation}` : ""}
                </p>
              </div>
              <Badge variant={r.status === "VERIFIED" ? "default" : "secondary"} className="rounded-lg">{r.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* G. Prescriptions and medication records */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-4 w-4" /> Prescriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {prescriptions.length === 0 && <p className="text-sm text-muted-foreground">No prescriptions issued.</p>}
          {prescriptions.map((p) => (
            <div key={p.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{p.items.map((i) => i.drugName).join(", ") || "Prescription"}</p>
                <Badge variant={p.status === "ACTIVE" ? "default" : "secondary"} className="rounded-lg">{p.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Issued {formatDate(p.issuedAt)} by {p.doctor.user.name}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* I. Admission, ward and nursing records */}
      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BedDouble className="h-4 w-4" /> Admissions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {admissions.length === 0 && <p className="text-sm text-muted-foreground">No admissions recorded.</p>}
          {admissions.map((a) => (
            <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm">
              <div>
                <p className="font-medium">Admitted {formatDate(a.admissionDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {a.dischargeDate ? `Discharged ${formatDate(a.dischargeDate)}` : "Currently in care"}
                </p>
              </div>
              <Badge variant={a.status === "ACTIVE" ? "default" : "secondary"} className="rounded-lg">{a.status}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Care cases and referrals */}
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <HeartPulse className="h-4 w-4" /> Care cases
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {careCases.length === 0 && <p className="text-sm text-muted-foreground">No care cases opened.</p>}
            {careCases.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium font-mono">{c.caseNumber}</p>
                  <p className="text-xs text-muted-foreground">Opened {formatDate(c.createdAt)}</p>
                </div>
                <Badge variant="outline" className="rounded-lg">{c.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Briefcase className="h-4 w-4" /> Referrals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {referrals.length === 0 && <p className="text-sm text-muted-foreground">No referrals on file.</p>}
            {referrals.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm">
                <div>
                  <p className="font-medium">{r.serviceId ? "Service referral" : "Facility referral"}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(r.createdAt)}{r.note ? ` — ${r.note}` : ""}</p>
                </div>
                <Badge variant={r.status === "PENDING" ? "secondary" : "outline"} className="rounded-lg">{r.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium">{value}</span>
    </div>
  );
}
