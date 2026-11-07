import Link from "next/link";
import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser, resolveFacilityPermissions } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";
import { documentVisibility } from "@/lib/his/visibility";
import { STATUS_LABEL } from "@/lib/his/workflow";
import { FacilityDocumentsTable } from "@/components/lab/facility-documents-table";
import { FacilityTemplateManager } from "@/components/lab/facility-template-manager";
import { listFacilityDocuments } from "@/lib/facility-documents";

/**
 * Case reports for the facility: the clinical documents it issued, grouped by
 * patient case. The former Documents (issued/shared patient documents) and
 * Document Templates features moved inside this section as tabs.
 */

const TABS = [
  { key: "reports", label: "Case reports" },
  { key: "documents", label: "Documents" },
  { key: "templates", label: "Templates" },
] as const;

export default async function FacilityCaseReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as "reports" | "documents" | "templates") : "reports";

  // Effective permissions: facility owners (linked via a LabStaffProfile) act
  // as OWNER; invited staff get the union of their active memberships.
  const { permissions } = await resolveFacilityPermissions(user, profile.id);
  const can = (permission: string) => permissions.includes(permission as never);
  const canView = can("VIEW_PATIENT_DOCUMENTS");
  const canManageTemplates = can("MANAGE_DOCUMENT_TEMPLATES");
  const canReview = can("REVIEW_DOCUMENTS");

  if (!canView && !canManageTemplates) redirect("/lab/dashboard");

  const visibleTabs = TABS.filter((t) => t.key !== "templates" || canManageTemplates);
  const activeTab = visibleTabs.some((t) => t.key === tab) ? tab : "reports";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Case reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Clinical case reports your facility issued, with the patient documents and document templates they are built from.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Case report sections">
        {visibleTabs.map((t) => (
          <Link
            key={t.key}
            href={`/lab/case-reports${t.key === "reports" ? "" : `?tab=${t.key}`}`}
            className={`rounded-lg border px-3 py-1.5 text-sm ${activeTab === t.key ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            aria-current={activeTab === t.key ? "page" : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === "reports" && <ReportsTab facilityId={profile.id} userId={user.id} canReview={canReview} />}
      {activeTab === "documents" && <DocumentsTab facilityId={profile.id} />}
      {activeTab === "templates" && canManageTemplates && <TemplatesTab facilityId={profile.id} />}
    </div>
  );
}

/** Case-centric worklist of the facility's clinical documents, grouped by patient case. */
async function ReportsTab({ facilityId, userId, canReview }: { facilityId: string; userId: string; canReview: boolean }) {
  const documents = await prisma.clinicalDocument.findMany({
    where: { facilityId, AND: [documentVisibility(userId, canReview)] },
    orderBy: { updatedAt: "desc" },
    take: 200,
    select: {
      id: true,
      documentNumber: true,
      title: true,
      status: true,
      updatedAt: true,
      releasedToPatientAt: true,
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
    },
  });

  // Group by patient so each case's reports sit together.
  const byPatient = new Map<string, typeof documents>();
  for (const document of documents) {
    const key = document.patient.id;
    const list = byPatient.get(key) ?? [];
    list.push(document);
    byPatient.set(key, list);
  }

  if (documents.length === 0) {
    return <p className="text-sm text-muted-foreground" data-testid="text-no-case-reports">No case reports have been issued yet.</p>;
  }

  return (
    <div className="space-y-6" data-testid="list-facility-case-reports">
      {[...byPatient.entries()].map(([patientId, docs]) => {
        const patient = docs[0].patient;
        return (
          <section key={patientId} aria-labelledby={`patient-${patientId}`} className="space-y-2">
            <h2 id={`patient-${patientId}`} className="text-sm font-semibold">
              {patient.firstName} {patient.lastName}
              <span className="ml-2 font-normal text-muted-foreground">{patient.caseNumber}</span>
            </h2>
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground">
                  <tr><th className="p-2">Report</th><th className="p-2">Status</th><th className="p-2">Updated</th></tr>
                </thead>
                <tbody>
                  {docs.map((d) => (
                    <tr key={d.id} className="border-t">
                      <td className="p-2">
                        <Link href={`/lab/clinical-documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link>
                        <div className="text-xs text-muted-foreground">{d.documentNumber}</div>
                      </td>
                      <td className="p-2">
                        {STATUS_LABEL[d.status]}
                        {d.releasedToPatientAt ? <div className="text-xs text-emerald-700">released to patient</div> : null}
                      </td>
                      <td className="p-2 text-xs">{formatClinicDateTime(d.updatedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** The former /lab/documents page: issued and shared patient documents. */
async function DocumentsTab({ facilityId }: { facilityId: string }) {
  const { documents, nextCursor } = await listFacilityDocuments({ facilityId });
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Documents your facility issued, and documents patients have chosen to share with you. Downloads are audited.
      </p>
      <FacilityDocumentsTable initialDocuments={documents} initialCursor={nextCursor} />
    </div>
  );
}

/** The former /lab/document-templates page: the facility's document templates. */
async function TemplatesTab({ facilityId }: { facilityId: string }) {
  const templates = await prisma.facilityDocumentTemplate.findMany({
    where: { facilityId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true, name: true, kind: true, content: true, updatedAt: true,
      createdBy: { select: { name: true } },
    },
  });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Customise the structure of the medical documents your facility issues —
        lab reports, referral forms, case notes, imaging and diagnostic reports,
        discharge summaries, epicrises, admission and progress notes, and transfer
        summaries. Templates hold structure only (field prompts); never patient data.
      </p>
      <FacilityTemplateManager
        templates={templates.map((t) => ({
          id: t.id,
          name: t.name,
          kind: t.kind,
          content: t.content,
          updatedAt: t.updatedAt.toISOString(),
          createdBy: t.createdBy.name,
        }))}
      />
    </div>
  );
}
