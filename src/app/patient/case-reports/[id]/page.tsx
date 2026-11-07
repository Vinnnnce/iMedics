import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePageRole, getPatientProfile } from "@/lib/guards";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { caseReportBundle } from "@/lib/case-reports";
import { StatusChip } from "@/components/shared/status-chip";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDownloadButton } from "@/components/shared/file-download";
import { PatientMediaDownload } from "@/components/his/patient-media-download";

const FLAG_LABEL: Record<string, string> = { NORMAL: "Normal", LOW: "Low", HIGH: "High", CRITICAL_LOW: "Very low", CRITICAL_HIGH: "Very high" };

// A case report for a patient: results only. Verified lab results, documents
// released to the patient and verified diagnostic files tied to this episode.
// Drafts, unverified values and administrative records never appear here.
export default async function PatientCaseReportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  const { id } = await params;
  if (!patient) notFound();

  // Authorization is by ownership: a case id never grants access.
  const bundle = await caseReportBundle(id);
  if (!bundle || bundle.careCase.patient.userId !== user.id) notFound();
  const { careCase, labOrders, documents, media } = bundle;

  const verifiedOrders = labOrders.filter((order) => order.results.length > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/patient/case-reports" className="text-sm text-muted-foreground hover:underline">← Case reports</Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-bold">
            {careCase.caseNumber}
            <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[careCase.type]}</Badge>
            <StatusChip tone={careCase.status === "CLOSED" || careCase.status === "ARCHIVED" ? "neutral" : "success"}>
              {CARE_CASE_STATUS_LABELS[careCase.status]}
            </StatusChip>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Opened {formatDate(careCase.createdAt)}
            {careCase.primaryDoctor ? ` · Dr ${careCase.primaryDoctor.user.name}${careCase.primaryDoctor.specialty ? ` (${careCase.primaryDoctor.specialty})` : ""}` : ""}
          </p>
        </div>
      </div>

      {verifiedOrders.length === 0 && documents.length === 0 && media.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="text-no-results">No results are available for this case yet.</p>
      ) : null}

      {verifiedOrders.map((order) =>
        order.results.map((result) => (
          <Card key={result.id} className="beeline-card" data-testid={`card-lab-result-${result.id}`}>
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
                {result.panelType}
                <Badge variant="outline" className="rounded-lg text-xs">{formatDate(result.testDate)}</Badge>
                {result.labName && <span className="text-xs font-normal text-muted-foreground">{result.labName}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {result.values.length > 0 && (
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr><th className="p-2">Test</th><th className="p-2">Value</th><th className="p-2">Flag</th></tr>
                    </thead>
                    <tbody>
                      {result.values.map((value) => (
                        <tr key={value.id} className="border-t">
                          <td className="p-2">{value.name}</td>
                          <td className="p-2 font-medium">{value.value}{value.unit ? ` ${value.unit}` : ""}</td>
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
          <h2 id="case-docs-h" className="text-lg font-semibold">Released documents</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {documents.map((d) => (
              <li key={d.id} className="flex flex-col gap-1 p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link href={`/patient/documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                  <p className="text-xs text-muted-foreground">{d.documentNumber} · {d.facility.laboratoryName ?? "Hospital"} · {formatDate(d.releasedToPatientAt ?? d.updatedAt)}</p>
                </div>
                <a href={`/api/patient/clinical-documents/${d.id}/pdf`} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">Download PDF</a>
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
