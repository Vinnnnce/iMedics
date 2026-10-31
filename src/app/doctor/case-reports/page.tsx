import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { CARE_CASE_STATUS_LABELS, CARE_CASE_TYPE_LABELS } from "@/lib/cases";
import { StatusChip } from "@/components/shared/status-chip";
import { DOCUMENT_CATEGORY_LABELS, type DocumentCategory } from "@/lib/documents";

/**
 * Case reports for the doctor: one section per care episode for their patients,
 * with the results each case produced. The former Patient Records page
 * (patient documents) moved inside this section as its "Documents" tab.
 */

const TABS = [
  { key: "reports", label: "Case reports" },
  { key: "documents", label: "Documents" },
] as const;

export default async function DoctorCaseReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requirePageRole("DOCTOR");
  const doctor = await getVerifiedDoctorProfile(user);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as "reports" | "documents") : "reports";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Case reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Results and reports for the care episodes of your patients.</p>
      </div>

      <nav className="flex gap-2" aria-label="Case report sections">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/doctor/case-reports${t.key === "reports" ? "" : `?tab=${t.key}`}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${tab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-current={tab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "reports" ? <CaseReports doctorId={doctor.id} /> : <DocumentsTab doctorId={doctor.id} userId={user.id} />}
    </div>
  );
}

async function CaseReports({ doctorId }: { doctorId: string }) {
  const cases = await prisma.careCase.findMany({
    where: {
      OR: [
        { primaryDoctorId: doctorId },
        { patient: { deletedAt: null, assignments: { some: { doctorId } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      caseNumber: true,
      type: true,
      status: true,
      createdAt: true,
      presentingComplaint: true,
      diagnosisSummary: true,
      patient: { select: { id: true, firstName: true, lastName: true } },
      labOrders: { select: { id: true, results: { where: { status: { not: "REJECTED" } }, select: { id: true } } } },
    },
  });

  if (cases.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-doctor-cases">No case reports yet.</p>;
  }

  return (
    <ul className="space-y-3" data-testid="list-doctor-case-reports">
      {cases.map((careCase) => {
        const resultCount = careCase.labOrders.reduce((sum, order) => sum + order.results.length, 0);
        return (
          <li key={careCase.id} className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Link href={`/doctor/case-reports/${careCase.id}`} className="font-semibold hover:underline">
                {careCase.caseNumber}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-lg">{CARE_CASE_TYPE_LABELS[careCase.type]}</Badge>
                <StatusChip tone={careCase.status === "CLOSED" || careCase.status === "ARCHIVED" ? "neutral" : "success"}>
                  {CARE_CASE_STATUS_LABELS[careCase.status]}
                </StatusChip>
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {careCase.patient.firstName} {careCase.patient.lastName} · opened {formatDate(careCase.createdAt)}
              {careCase.presentingComplaint ? ` · ${careCase.presentingComplaint}` : ""}
              {` · ${resultCount} result${resultCount === 1 ? "" : "s"}`}
            </p>
            {careCase.diagnosisSummary && <p className="mt-1 text-sm">{careCase.diagnosisSummary}</p>}
            <Link href={`/doctor/case-reports/${careCase.id}`} className="mt-2 inline-block text-sm text-primary hover:underline">
              Open case report →
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The former /doctor/records page: patient documents for assigned patients. */
async function DocumentsTab({ doctorId, userId }: { doctorId: string; userId: string }) {
  const [assignedPatients, shared] = await Promise.all([
    prisma.patient.findMany({ take: 500,
      where: { deletedAt: null, assignments: { some: { doctorId } } },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.documentShare.findMany({ take: 500,
      where: { sharedWithUserId: userId, revokedAt: null, document: { deletedAt: null } },
      include: { document: { include: { patient: true } } },
    }),
  ]);

  const documents = await prisma.patientDocument.findMany({
    where: { patientId: { in: assignedPatients.map((p) => p.id) }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { patient: true },
  });

  const patientName = (id: string) => {
    const p = assignedPatients.find((x) => x.id === id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : "Patient";
  };

  return (
    <div className="space-y-3">
      {documents.length === 0 && shared.length === 0 && (
        <p className="text-sm text-muted-foreground">No documents available yet.</p>
      )}
      {documents.map((doc) => (
        <Card key={doc.id} className="beeline-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">
                {patientName(doc.patientId)} · {DOCUMENT_CATEGORY_LABELS[doc.category as DocumentCategory] ?? doc.category}
                {doc.issuedOn ? ` · issued ${new Date(doc.issuedOn).toLocaleDateString()}` : ""}
              </p>
            </div>
            <Link href={`/api/patient/documents/${doc.id}?download=1`} className="text-sm underline" prefetch={false}>
              <Download className="inline h-4 w-4" aria-hidden="true" /> Download
            </Link>
          </CardContent>
        </Card>
      ))}
      {shared.map((share) => (
        <Card key={share.id} className="beeline-card">
          <CardContent className="flex flex-wrap items-center gap-3 p-4">
            <FileText className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-medium">{share.document.title}</p>
              <p className="text-xs text-muted-foreground">
                {share.document.patient.firstName} {share.document.patient.lastName} · shared with you
              </p>
            </div>
            <Badge variant="outline" className="rounded-lg">{share.role.toLowerCase()}</Badge>
            <Link href={`/api/patient/documents/${share.document.id}?download=1`} className="text-sm underline" prefetch={false}>
              <Download className="inline h-4 w-4" aria-hidden="true" /> Download
            </Link>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
