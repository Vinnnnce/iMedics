import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { ChatPanel } from "@/components/shared/chat-panel";
import { prisma } from "@/lib/prisma";
import { getPatientProfile, requirePageRole } from "@/lib/guards";
import { notFound } from "next/navigation";

export default async function PatientConsultPage() {
  const user = await requirePageRole("PATIENT");
  const patient = await getPatientProfile(user.id);
  if (!patient) notFound();

  const careTeam = await prisma.patientAssignment.findMany({ take: 100,
    where: { patientId: patient.id, status: "ACTIVE" },
    include: { doctor: { select: { id: true, user: { select: { name: true } } } } },
  });

  const reports = await prisma.consultation.findMany({
    where: { patientId: patient.id, status: "FINALIZED" },
    orderBy: { finalizedAt: "desc" },
    take: 20,
    select: {
      id: true, finalizedAt: true, revision: true, amendedAt: true, diagnosis: true, chiefComplaint: true,
      doctor: { select: { user: { select: { name: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Consultation</h1>
        <p className="mt-1 text-sm text-muted-foreground">Message the doctors who are caring for you</p>
      </div>

      <Card className="beeline-card">
        <CardContent className="p-3 text-xs text-muted-foreground">
          Chat is for non-urgent questions. If you think you are having a medical emergency, contact your local emergency services or go to the nearest hospital.
          Video consultations are not available yet.
        </CardContent>
      </Card>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-lg">Your consultation reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 && <p className="text-sm text-muted-foreground">Reports your doctors finalize will appear here.</p>}
          {reports.map((r) => (
            <div key={r.id} className="flex flex-col gap-2 rounded-lg border border-border p-3 sm:flex-row sm:items-center sm:justify-between" data-testid={`row-report-${r.id}`}>
              <div className="min-w-0 text-sm">
                <p className="truncate font-medium">{r.diagnosis || r.chiefComplaint || "Consultation report"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.doctor.user.name} · {r.finalizedAt ? formatDate(r.finalizedAt) : ""}
                  {r.amendedAt && <Badge variant="outline" className="ml-2 rounded-lg text-[10px]">Updated {formatDate(r.amendedAt)}</Badge>}
                </p>
              </div>
              <a
                href={`/api/consultations/${r.id}/pdf`}
                className="inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent"
                aria-label="Download this report as a PDF"
              >
                <Download className="h-4 w-4" /> Download PDF
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      <section aria-labelledby="reports-heading" className="space-y-3">
        <h2 id="reports-heading" className="text-lg font-semibold">Consultation reports</h2>
        {reports.length === 0 && <p className="text-sm text-muted-foreground">No consultation reports yet. Your doctors&apos; finalized reports appear here.</p>}
        {reports.map((r) => (
          <Card key={r.id} className="beeline-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0">
                <p className="font-medium">{r.diagnosis || r.chiefComplaint || "Consultation report"}</p>
                <p className="text-xs text-muted-foreground">
                  {r.doctor.user.name} · {r.finalizedAt ? formatDate(r.finalizedAt) : ""}
                </p>
                {r.revision > 1 && r.amendedAt && (
                  <Badge variant="outline" className="mt-1 rounded-lg text-xs">Amended {formatDate(r.amendedAt)}</Badge>
                )}
              </div>
              <a
                href={`/api/consultations/${r.id}/pdf`}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium hover:bg-accent"
                aria-label={`Download PDF of the report from ${r.doctor.user.name}`}
              >
                <Download className="h-4 w-4" aria-hidden="true" /> Download PDF
              </a>
            </CardContent>
          </Card>
        ))}
      </section>

      <ChatPanel startKey="doctorId" contacts={careTeam.map((c) => ({ id: c.doctor.id, name: c.doctor.user.name }))} />
    </div>
  );
}
