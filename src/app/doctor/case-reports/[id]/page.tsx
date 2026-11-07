import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { caseReportBundle } from "@/lib/case-reports";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDownloadButton } from "@/components/shared/file-download";
import { PatientMediaDownload } from "@/components/his/patient-media-download";
import { STATUS_LABEL } from "@/lib/his/workflow";

const FLAG_LABEL: Record<string, string> = { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL_LOW: "Very low", CRITICAL_HIGH: "Very high" };

// A case report for the doctor: the care episode with all of its results,
// including results and documents not yet released to the patient.
export default async function DoctorCaseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getVerifiedDoctorProfile(user);
  const { id } = await params;

  // Authorization: the doctor is either primarily responsible for the case or
  // assigned to the patient. A case id never grants access.
  const careCase = await prisma.careCase.findUnique({
    where: { id },
    select: { id: true, patientId: true, primaryDoctorId: true },
  });
  if (!careCase) notFound();
  const allowed =
    careCase.primaryDoctorId === doctor.id
      ? true
      : await prisma.patientAssignment.findFirst({
          where: { doctorId: doctor.id, patientId: careCase.patientId },
          select: { id: true },
        }).then((assignment) => Boolean(assignment));
  if (!allowed) notFound();

  const bundle = await caseReportBundle(id, true);
  if (!bundle) notFound();
  const { careCase: report, labOrders, documents, media } = bundle;

  const ordersWithResults = labOrders.filter((order) => order.results.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/doctor/case-reports" className="text-sm text-muted-foreground hover:underline">← Case reports</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
            {report.caseNumber}
            <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[report.type]}</Badge>
            <StatusChip tone={report.status === "CLOSED" || report.status === "ARCHIVED" ? "neutral" : "success"}>
              {CARE_CASE_STATUS_LABELS[report.status]}
            </StatusChip>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.patient.firstName} {report.patient.lastName} ({report.patient.caseNumber}) · opened {formatDate(report.createdAt)}
            {report.primaryDoctor ? ` · primary: Dr ${report.primaryDoctor.user.name}` : ""}
          </p>
        </div>
        <Link href="/doctor/patients" className="text-sm text-primary hover:underline">My patients →</Link>
      </div>

      {ordersWithResults.length === 0 && documents.length === 0 && media.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-results">No results recorded for this case yet.</p>
      ) : null}

      {ordersWithResults.map((order) =>
        order.results.map((result) => (
          <Card key={result.id} className="beeline-card" data-testid={`card-lab-result-${result.id}`}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {result.panelType}
                <Badge variant="outline" className="rounded-lg text-xs">{formatDate(result.testDate)}</Badge>
                <Badge variant={result.status === "VERIFIED" ? "secondary" : "outline"} className="rounded-lg text-xs">{result.status}</Badge>
                {result.labName && <span className="text-xs font-normal text-muted-foreground">{result.labName}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.values.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="p-2">Test</th><th className="p-2">Value</th><th className="p-2">Reference</th><th className="p-2">Flag</th></tr>
                    </thead>
                    <tbody>
                      {result.values.map((value) => (
                        <tr key={value.id} className="border-t">
                          <td className="p-2">{value.name}</td>
                          <td className="p-2 font-medium">{value.value}{value.unit ? ` ${value.unit}` : ""}</td>
                          <td className="p-2 text-xs text-muted-foreground">{value.refLow != null && value.refHigh != null ? `${value.refLow} – ${value.refHigh}` : "—"}</td>
                          <td className="p-2 text-xs">{value.flag ? FLAG_LABEL[value.flag] : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {result.files.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {result.files.map((file) => (
                    <FileDownloadButton key={file.id} fileId={file.id} fileName={file.fileName} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )),
      )}

      {documents.length > 0 && (
        <section aria-labelledby="case-docs-h" className="space-y-2">
          <h2 id="case-docs-h" className="text-lg font-semibold">Documents</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link href={`/lab/clinical-documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <p className="text-xs text-muted-foreground">{d.documentNumber} · {d.facility.laboratoryName ?? "Facility"} · {STATUS_LABEL[d.status]} · {formatDate(d.updatedAt)}</p>
                </div>
                {d.releasedToPatientAt ? (
                  <span className="text-xs text-emerald-700">released to patient</span>
                ) : (
                  <span className="text-xs text-muted-foreground">not released</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {media.length > 0 && (
        <section aria-labelledby="case-media-h" className="space-y-2">
          <h2 id="case-media-h" className="text-lg font-semibold">Diagnostic files</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {media.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 p-3">
                <div>
                  <p className="font-medium">{m.examinationType}</p>
                  <p className="text-xs text-muted-foreground">{m.fileName} · {m.examinationAt ? formatDate(m.examinationAt) : formatDate(m.createdAt)}</p>
                </div>
                <PatientMediaDownload id={m.id} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
