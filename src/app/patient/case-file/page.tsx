import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CaseFileExplorer, type CaseFileEntry } from "@/components/case-file/case-file-explorer";
import { PatientAssistant } from "@/components/patient/patient-assistant";
import { prisma } from "@/lib/prisma";
import { getPatientProfile, requirePageRole } from "@/lib/guards";
import { writeAudit } from "@/lib/audit";
import { classifyCaseFileDocument } from "@/lib/case-file/folders";
import { ageFromDob, formatDate } from "@/lib/format";
import { calculateBMI } from "@/lib/bmi";
import { notFound } from "next/navigation";

// Pull display text out of the loosely-structured JSON lists on a medical history.
function labels(value: unknown, keys: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (item && typeof item === "object" ? keys.map((k) => (item as Record<string, unknown>)[k]).find((v) => typeof v === "string" && v) : null))
    .filter((v): v is string => typeof v === "string");
}

/**
 * The patient's view of their central case file. Only released, approved or
 * verified items are ever included: drafts, blank forms, internal templates
 * and unreleased clinical documents are never queried here, so the patient
 * view cannot expose them.
 */
export default async function PatientCaseFilePage() {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient) notFound();

  const [careTeam, history, documents, labResults, consultations, prescriptions, media, referrals] = await Promise.all([
    prisma.patientAssignment.findMany({ take: 100,
      where: { patientId: patient.id, status: "ACTIVE" },
      include: { doctor: { select: { specialty: true, user: { select: { name: true } } } } },
    }),
    prisma.medicalHistory.findFirst({ where: { patientId: patient.id }, orderBy: { createdAt: "desc" } }),
    // Released hospital documents only (FINAL or AMENDED, released to patient).
    prisma.clinicalDocument.findMany({ take: 200,
      where: { patientId: patient.id, releasedToPatientAt: { not: null }, status: { in: ["FINAL", "AMENDED"] } },
      orderBy: { finalizedAt: "desc" },
      select: {
        id: true, documentNumber: true, title: true, groupCode: true, department: true, status: true,
        finalizedAt: true, createdAt: true,
        author: { select: { name: true } },
        encounter: { select: { id: true } },
      },
    }),
    prisma.labResult.findMany({ take: 200,
      where: { patientId: patient.id, status: "VERIFIED" },
      orderBy: { testDate: "desc" },
      select: { id: true, panelType: true, status: true, testDate: true, createdAt: true, labName: true },
    }),
    prisma.consultation.findMany({ take: 200,
      where: { patientId: patient.id, status: "FINALIZED" },
      orderBy: { createdAt: "desc" },
      select: { id: true, chiefComplaint: true, createdAt: true, doctor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.prescription.findMany({ take: 200,
      where: { patientId: patient.id, status: { in: ["ACTIVE", "EXPIRED"] } },
      orderBy: { issuedAt: "desc" },
      select: { id: true, status: true, issuedAt: true, doctor: { select: { user: { select: { name: true } } } } },
    }),
    prisma.medicalMedia.findMany({ take: 200,
      where: { patientId: patient.id, releasedToPatientAt: { not: null }, deletedAt: null, reportStatus: { in: ["VERIFIED", "AMENDED"] }, scanStatus: { not: "INFECTED" } },
      orderBy: { examinationAt: "desc" },
      select: { id: true, category: true, examinationType: true, examinationAt: true, reportStatus: true, facility: { select: { laboratoryName: true } } },
    }),
    prisma.facilityReferral.findMany({ take: 100,
      where: { patientId: patient.id, status: { in: ["ACCEPTED", "FULFILLED"] } },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true, facility: { select: { laboratoryName: true } } },
    }),
  ]);

  // Every patient case-file view is recorded in the platform audit trail.
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    patientId: patient.id,
    action: "PATIENT_CASE_FILE_VIEWED",
    resourceType: "Patient",
    resourceId: patient.id,
  });

  const bmi = calculateBMI(patient.height, patient.weight);
  const allergies = labels(history?.allergies, ["allergen", "name"]);
  const conditions = labels(history?.pastHistory, ["diagnosis", "condition", "name"]);

  const details: [string, string | null][] = [
    ["Case number", patient.caseNumber],
    ["Age", `${ageFromDob(patient.dateOfBirth)} (born ${formatDate(patient.dateOfBirth)})`],
    ["Sex", patient.gender.charAt(0) + patient.gender.slice(1).toLowerCase()],
    ["Blood group / genotype", [patient.bloodGroup, patient.genotype].filter(Boolean).join(" / ") || null],
    ["Height / weight", patient.height && patient.weight ? `${patient.height} cm / ${patient.weight} kg${bmi ? ` (BMI ${bmi.value})` : ""}` : null],
    ["Occupation", patient.occupation],
    ["Address", [patient.addressLine1, patient.city, patient.state].filter(Boolean).join(", ") || null],
    ["Emergency contact", patient.ecName ? `${patient.ecName}${patient.ecRelationship ? ` (${patient.ecRelationship})` : ""}${patient.ecPhone ? ` — ${patient.ecPhone}` : ""}` : null],
  ];

  // Case-file entries — only released/approved/verified patient-facing items.
  const entries: CaseFileEntry[] = [
    ...documents.map((d): CaseFileEntry => ({
      id: d.id,
      kind: "document",
      title: d.title,
      folder: classifyCaseFileDocument(d.groupCode, d.title),
      statusLabel: d.status === "AMENDED" ? "Amended" : "Final",
      statusTone: d.status === "AMENDED" ? "amended" : "final",
      author: d.author?.name,
      department: d.department ?? undefined,
      encounter: d.encounter ? d.encounter.id.slice(0, 8) : undefined,
      date: (d.finalizedAt ?? d.createdAt).toISOString(),
      href: `/patient/documents/${d.id}`,
      pdfHref: `/api/patient/clinical-documents/${d.id}/pdf`,
    })),
    ...labResults.map((r): CaseFileEntry => ({
      id: r.id,
      kind: "lab",
      title: r.panelType,
      folder: "laboratory",
      statusLabel: "Verified",
      statusTone: "final",
      author: r.labName ?? "Laboratory",
      date: (r.testDate ?? r.createdAt).toISOString(),
      href: "/patient/results",
    })),
    ...consultations.map((c): CaseFileEntry => ({
      id: c.id,
      kind: "consultation",
      title: c.chiefComplaint || "Consultation report",
      folder: "assessments",
      statusLabel: "Finalised",
      statusTone: "final",
      author: c.doctor.user.name,
      date: c.createdAt.toISOString(),
      href: "/patient/records",
    })),
    ...prescriptions.map((p): CaseFileEntry => ({
      id: p.id,
      kind: "prescription",
      title: `Prescription — ${formatDate(p.issuedAt)}`,
      folder: "other",
      statusLabel: p.status === "ACTIVE" ? "Active" : "Expired",
      statusTone: "final",
      author: p.doctor.user.name,
      date: p.issuedAt.toISOString(),
      href: "/patient/prescriptions",
    })),
    ...media.map((m): CaseFileEntry => ({
      id: m.id,
      kind: "media",
      title: m.examinationType,
      folder: "radiology",
      statusLabel: m.reportStatus === "AMENDED" ? "Amended" : "Verified",
      statusTone: m.reportStatus === "AMENDED" ? "amended" : "final",
      department: m.facility.laboratoryName ?? "Diagnostic centre",
      date: (m.examinationAt ?? new Date()).toISOString(),
      href: "/patient/case-reports?tab=documents",
    })),
    ...referrals.map((r): CaseFileEntry => ({
      id: r.id,
      kind: "referral",
      title: `Referral — ${r.facility.laboratoryName ?? "Facility"}`,
      folder: "admissions",
      statusLabel: r.status === "FULFILLED" ? "Fulfilled" : "Approved",
      statusTone: "final",
      date: r.createdAt.toISOString(),
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">
          {patient.firstName} {patient.lastName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Your case file</p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Personal details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          {details.map(([label, value]) => (
            <div key={label}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <p>{value || "—"}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Health summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Allergies</p>
            {allergies.length ? <div className="flex flex-wrap gap-2">{allergies.map((a) => <Badge key={a} variant="outline" className="rounded-lg">{a}</Badge>)}</div> : <p className="text-muted-foreground">None recorded</p>}
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Past conditions</p>
            {conditions.length ? <div className="flex flex-wrap gap-2">{conditions.map((c) => <Badge key={c} variant="outline" className="rounded-lg">{c}</Badge>)}</div> : <p className="text-muted-foreground">None recorded</p>}
          </div>
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Your care team</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {careTeam.length === 0 && <p className="text-muted-foreground">No doctors yet. Book an appointment to get started.</p>}
          {careTeam.map((c) => (
            <p key={c.id}>
              {c.doctor.user.name} {c.doctor.specialty && <span className="text-muted-foreground">— {c.doctor.specialty}</span>}
            </p>
          ))}
        </CardContent>
      </Card>

      <CaseFileExplorer entries={entries} viewLabel="Released documents approved for you" />

      <PatientAssistant />
    </div>
  );
}
