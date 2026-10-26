import Link from "next/link";
import { CatalogueBrowser } from "@/components/his/catalogue-browser";
import { CustomTemplateButton } from "@/components/his/custom-template-button";
import { requireHisPage } from "@/lib/his/page";
import { CATALOGUE_GROUPS, catalogue, groupAllowedForKind, groupTitle } from "@/lib/his/catalogue";
import { STATUS_LABEL } from "@/lib/his/workflow";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

const STATUSES = Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[];

// Central Medical Documents module: worklist, hospital template library and the system catalogue.
export default async function ClinicalDocumentsPage({ searchParams }: { searchParams: Promise<{ status?: string; group?: string; q?: string }> }) {
  const sp = await searchParams;
  const { user, facility, kind, can } = await requireHisPage(null);
  const status = STATUSES.find((s) => s === sp.status);
  const q = sp.q?.trim().slice(0, 100);
  const [documents, templates] = await Promise.all([
    can("VIEW_PATIENT_DOCUMENTS")
      ? prisma.clinicalDocument.findMany({
          where: {
            facilityId: facility.id,
            ...(status ? { status } : {}),
            ...(sp.group ? { groupCode: sp.group.slice(0, 10) } : {}),
            ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" as const } }, { documentNumber: { contains: q.toUpperCase() } }, { patient: { caseNumber: q.toUpperCase() } }] } : {}),
          },
          orderBy: { updatedAt: "desc" },
          take: 100,
          select: { id: true, documentNumber: true, title: true, groupCode: true, status: true, updatedAt: true, authorId: true, releasedToPatientAt: true, patient: { select: { firstName: true, lastName: true, caseNumber: true } } },
        })
      : Promise.resolve([]),
    prisma.clinicalDocumentTemplate.findMany({ where: { facilityId: facility.id }, orderBy: [{ groupCode: "asc" }, { name: "asc" }], select: { id: true, name: true, groupCode: true, sourceCode: true, publishedVersion: true, retiredAt: true, versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, status: true } } } }),
  ]);
  const adopted = new Map(templates.filter((t) => t.sourceCode).map((t) => [t.sourceCode!, t.id]));
  const groups = CATALOGUE_GROUPS.filter((g) => groupAllowedForKind(g.code, kind)).map((g) => ({ code: g.code, title: g.title, items: catalogue().filter((e) => e.groupCode === g.code).map((e) => ({ code: e.code, name: e.name, adoptedId: adopted.get(e.code) ?? null })) }));

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 md:px-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Medical documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">Author, review, sign and finalize clinical documents from your hospital&apos;s own versioned templates.</p>
        </div>
        {can("AUTHOR_DOCUMENTS") && <Link href="/lab/clinical-documents/new" className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground" data-testid="link-new-document">New document</Link>}
      </div>

      {can("VIEW_PATIENT_DOCUMENTS") && (
        <section aria-labelledby="worklist-h" className="space-y-3">
          <h2 id="worklist-h" className="text-lg font-semibold">Worklist</h2>
          <form className="flex flex-wrap gap-2 text-sm" method="get">
            <select name="status" defaultValue={status ?? ""} className="h-9 rounded-lg border px-2" aria-label="Status"><option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
            <select name="group" defaultValue={sp.group ?? ""} className="h-9 rounded-lg border px-2" aria-label="Group"><option value="">All groups</option>{[...CATALOGUE_GROUPS.map((g) => g.code), "CUSTOM"].map((g) => <option key={g} value={g}>{g} · {groupTitle(g)}</option>)}</select>
            <input name="q" defaultValue={q ?? ""} placeholder="Title, document no. or case no." className="h-9 rounded-lg border px-2" aria-label="Search" />
            <button className="h-9 rounded-lg border px-3">Filter</button>
          </form>
          {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents match.</p> : (
            <div className="overflow-x-auto rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-2">Document</th><th className="p-2">Patient</th><th className="p-2">Status</th><th className="p-2">Updated</th></tr></thead>
                <tbody>{documents.map((d) => (
                  <tr key={d.id} className="border-t">
                    <td className="p-2"><Link href={`/lab/clinical-documents/${d.id}`} className="font-medium hover:underline">{d.title}</Link><div className="text-xs text-muted-foreground">{d.documentNumber} · group {d.groupCode}{d.authorId === user.id ? " · mine" : ""}</div></td>
                    <td className="p-2">{d.patient.firstName} {d.patient.lastName}<div className="text-xs text-muted-foreground">{d.patient.caseNumber}</div></td>
                    <td className="p-2">{STATUS_LABEL[d.status]}{d.releasedToPatientAt ? <div className="text-xs text-emerald-700">released</div> : null}</td>
                    <td className="p-2 text-xs">{formatClinicDateTime(d.updatedAt)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {can("MANAGE_DOCUMENT_TEMPLATES") && (
        <section aria-labelledby="lib-h" className="space-y-3">
          <div className="flex items-center justify-between"><h2 id="lib-h" className="text-lg font-semibold">Hospital template library</h2><CustomTemplateButton groups={[...groups.map((g) => g.code), "CUSTOM"]} /></div>
          {templates.length === 0 ? <p className="text-sm text-muted-foreground">No templates yet — adopt one from the catalogue below.</p> : (
            <ul className="divide-y rounded-xl border bg-card text-sm">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 p-2">
                  <Link href={`/lab/clinical-documents/templates/${t.id}`} className="hover:underline">{t.groupCode} · {t.name}</Link>
                  <span className="text-xs text-muted-foreground">{t.retiredAt ? "Retired" : t.publishedVersion ? `Published v${t.publishedVersion}` : "Not published"} · latest v{t.versions[0]?.version} {t.versions[0]?.status}</span>
                </li>
              ))}
            </ul>
          )}
          <h3 className="pt-2 text-sm font-semibold">System catalogue (read-only defaults)</h3>
          <CatalogueBrowser groups={groups} canManage={can("MANAGE_DOCUMENT_TEMPLATES")} />
        </section>
      )}
    </div>
  );
}
