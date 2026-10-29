import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EditDraftReportForm, ReportActions } from "@/components/lab/diagnostic-report-forms";
import { DiagnosticImagesPanel } from "@/components/lab/diagnostic-images";
import { requireFacilityPortalPage } from "@/lib/guards";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";
import type { Prisma } from "@prisma/client";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  AWAITING_VERIFICATION: "Awaiting verification",
  FINALIZED: "Finalized",
  SENT: "Sent to hospital",
  AMENDED: "Amended",
};

const REPORT_SELECT = {
  id: true,
  status: true,
  preliminaryFindings: true,
  specialistInterpretation: true,
  recommendations: true,
  verifiedAt: true,
  signedAt: true,
  finalizedAt: true,
  sentAt: true,
  createdAt: true,
  booking: {
    select: {
      id: true,
      serviceName: true,
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
    },
  },
  versions: {
    orderBy: { version: "desc" as const },
    select: { id: true, version: true, reason: true, snapshot: true, createdAt: true },
  },
} as const satisfies Prisma.DiagnosticReportSelect;

type ReportView = Prisma.DiagnosticReportGetPayload<{ select: typeof REPORT_SELECT }>;

// Diagnostic report detail — shared view. The owning diagnostic centre sees
// the full working view (edit draft, workflow actions); the requesting
// hospital gets a read-only view of the report issued for their referral
// (Module 03, Category 05). Anything else is a 404.
export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireFacilityPortalPage();

  let viewer: "owner" | "recipient" = "recipient";
  let report: ReportView | null = null;

  const labAccess = await requireFacilityAccess(user, "ENTER_RESULTS").catch(() => null);
  if (labAccess && labAccess.facility.kind === "DIAGNOSTIC_CENTRE") {
    report = await prisma.diagnosticReport.findFirst({
      where: { id, facilityId: labAccess.facility.id },
      select: REPORT_SELECT,
    });
    if (report) viewer = "owner";
  }

  if (!report) {
    // Requesting hospital: read-only, and only for reports issued to them
    // (sent or an issued amendment) — drafts stay invisible to the requester.
    const hospitalAccess = await requireFacilityAccess(user, "REGISTER_PATIENTS").catch(() => null);
    if (hospitalAccess) {
      report = await prisma.diagnosticReport.findFirst({
        where: {
          id,
          status: { in: ["SENT", "AMENDED"] },
          OR: [
            { sentToFacilityId: hospitalAccess.facility.id },
            { booking: { requestingFacilityId: hospitalAccess.facility.id } },
          ],
        },
        select: REPORT_SELECT,
      });
    }
  }

  if (!report) notFound();

  // Imaging studies attached to this examination's booking. Both viewers may
  // download (the hospital only ever reaches issued reports here); only the
  // owning diagnostic centre can upload — enforced again by the API.
  const imageRows = await prisma.diagnosticImage.findMany({
    where: { bookingId: report.booking.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
  });
  const images = imageRows.map((image) => ({ ...image, createdAt: image.createdAt.toISOString() }));

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Diagnostic report</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {report.booking.patient.firstName} {report.booking.patient.lastName} ·{" "}
          {report.booking.serviceName} · {STATUS_LABEL[report.status] ?? report.status}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Patient case {report.booking.patient.caseNumber} · created {formatClinicDateTime(report.createdAt)}
          {report.finalizedAt ? ` · finalized ${formatClinicDateTime(report.finalizedAt)}` : ""}
          {report.sentAt ? ` · sent ${formatClinicDateTime(report.sentAt)}` : ""}
        </p>
      </div>

      <Card className="beeline-card">
        <CardHeader>
          <CardTitle className="text-base">Report content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Preliminary findings</p>
            <p className="whitespace-pre-wrap">{report.preliminaryFindings || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Specialist interpretation</p>
            <p className="whitespace-pre-wrap">{report.specialistInterpretation || "—"}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Recommendations</p>
            <p className="whitespace-pre-wrap">{report.recommendations || "—"}</p>
          </div>
        </CardContent>
      </Card>

      {report.versions.length > 0 && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-base">Version history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {report.versions.map((v) => (
              <div key={v.id} className="rounded-md border p-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-lg text-xs">Version {v.version}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatClinicDateTime(v.createdAt)}
                    {v.reason ? ` · ${v.reason}` : ""}
                  </span>
                </div>
                {v.snapshot && (
                  <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {(v.snapshot as Record<string, unknown>).preliminaryFindings ? (
                      <p className="line-clamp-2">Findings: {String((v.snapshot as Record<string, unknown>).preliminaryFindings)}</p>
                    ) : null}
                    {(v.snapshot as Record<string, unknown>).specialistInterpretation ? (
                      <p className="line-clamp-2">Interpretation: {String((v.snapshot as Record<string, unknown>).specialistInterpretation)}</p>
                    ) : null}
                    {(v.snapshot as Record<string, unknown>).recommendations ? (
                      <p className="line-clamp-2">Recommendations: {String((v.snapshot as Record<string, unknown>).recommendations)}</p>
                    ) : null}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DiagnosticImagesPanel
        bookingId={report.booking.id}
        initialImages={images}
        canUpload={viewer === "owner"}
        canDownload
      />

      {viewer === "owner" ? (
        <>
          {report.status === "DRAFT" && <EditDraftReportForm reportId={report.id} />}
          <ReportActions reportId={report.id} status={report.status} />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">
          Read-only view — this report belongs to the diagnostic centre that issued it.
        </p>
      )}
    </div>
  );
}
