import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AddNoteForm, TransferForm, DischargeForm } from "@/components/lab/admission-forms";
import { requireModulePage } from "@/lib/modules/page-guards";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active admission",
  DISCHARGED: "Discharged",
  TRANSFERRED: "Transferred",
  CANCELLED: "Cancelled",
};

const NOTE_LABEL: Record<string, string> = {
  ADMISSION_EXAMINATION: "Admission examination",
  PHYSICIAN_PROGRESS: "Physician progress",
  NURSING_OBSERVATION: "Nursing observation",
  SPECIALIST_CONSULTATION: "Specialist consultation",
  PROCEDURE_REPORT: "Procedure report",
};

// Hospital Management — admission record detail (Module 01, Category 03/05).
export default async function AdmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { facilityId } = await requireModulePage("HOSPITAL");
  const { id } = await params;

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId },
    include: {
      patient: { select: { firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } },
      admittingDoctor: { select: { user: { select: { name: true } } } },
      notes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
      wardTransfers: { orderBy: { transferredAt: "desc" }, include: { actor: { select: { name: true } } } },
    },
  });
  if (!admission) notFound();

  const isActive = admission.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/lab/admissions" className="hover:underline">Admissions</Link>
        <span>/</span>
        <span>{admission.patient.caseNumber}</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold">
          {admission.patient.firstName} {admission.patient.lastName}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-lg text-xs">{admission.patient.caseNumber}</Badge>
          <Badge variant={isActive ? "default" : "secondary"} className="rounded-lg text-xs">{STATUS_LABEL[admission.status]}</Badge>
          {admission.ward && <Badge variant="secondary" className="rounded-lg text-xs">{admission.ward}{admission.bed ? ` · bed ${admission.bed}` : ""}</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Admitted {formatClinicDateTime(admission.admissionDate)}
          {admission.admittingDoctor ? ` · attending: ${admission.admittingDoctor.user.name}` : ""}
        </p>
      </div>

      {(admission.reason || admission.initialAssessment || admission.workingDiagnosis) && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Admission</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {admission.reason && <p><span className="font-medium">Reason:</span> {admission.reason}</p>}
            {admission.initialAssessment && <p><span className="font-medium">Initial assessment:</span> {admission.initialAssessment}</p>}
            {admission.workingDiagnosis && (
              <p>
                <span className="font-medium">Working diagnosis:</span> {admission.workingDiagnosis}
                {admission.diagnosisCode ? ` (${admission.diagnosisCode})` : ""}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {admission.status === "DISCHARGED" && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Discharge summary (epicrisis)</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <span className="font-medium">Discharged:</span> {admission.dischargeDate ? formatClinicDateTime(admission.dischargeDate) : "—"}
              {admission.disposition ? ` · ${admission.disposition.toLowerCase()}` : ""}
            </p>
            {admission.finalDiagnosisName && (
              <p>
                <span className="font-medium">Final diagnosis:</span> {admission.finalDiagnosisName}
                {admission.finalDiagnosisCode ? ` (${admission.finalDiagnosisCode})` : ""}
              </p>
            )}
            {admission.outcome && <p><span className="font-medium">Outcome:</span> {admission.outcome}</p>}
            {admission.epicrisis && <p className="whitespace-pre-wrap">{admission.epicrisis}</p>}
            {admission.medicationInstructions && <p><span className="font-medium">Medications:</span> {admission.medicationInstructions}</p>}
            {admission.followUpInstructions && <p><span className="font-medium">Follow-up:</span> {admission.followUpInstructions}</p>}
          </CardContent>
        </Card>
      )}

      {admission.status === "TRANSFERRED" && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Transfer summary</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-medium">Transferred to facility:</span> {admission.transferredToFacilityId}</p>
            {admission.transferSummary && <p className="whitespace-pre-wrap">{admission.transferSummary}</p>}
          </CardContent>
        </Card>
      )}

      {admission.wardTransfers.length > 0 && (
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Ward transfers</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {admission.wardTransfers.map((t) => (
              <p key={t.id} className="text-xs">
                {formatClinicDateTime(t.transferredAt)}: {t.fromWard ?? "—"} → {t.toWard}
                {t.reason ? ` (${t.reason})` : ""} · recorded by {t.actor.name}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card className="beeline-card">
        <CardHeader><CardTitle className="text-base">Clinical notes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {admission.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes recorded yet.</p>}
          {admission.notes.map((n) => (
            <div key={n.id} className="rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-lg text-xs">{NOTE_LABEL[n.type]}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatClinicDateTime(n.createdAt)} · {n.author.name}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap">{n.content}</p>
              {n.vitals && typeof n.vitals === "object" && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Vitals: {Object.entries(n.vitals as Record<string, unknown>).map(([k, v]) => `${k} ${String(v)}`).join(", ")}
                </p>
              )}
            </div>
          ))}
          {isActive && <AddNoteForm admissionId={admission.id} />}
        </CardContent>
      </Card>

      {isActive && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Transfer</CardTitle></CardHeader>
            <CardContent><TransferForm admissionId={admission.id} /></CardContent>
          </Card>
          <Card className="beeline-card">
            <CardHeader><CardTitle className="text-base">Discharge</CardTitle></CardHeader>
            <CardContent><DischargeForm admissionId={admission.id} /></CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
