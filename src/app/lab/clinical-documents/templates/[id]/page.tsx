import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplateEditor } from "@/components/his/template-editor";
import { requireHisPage } from "@/lib/his/page";
import { groupTitle } from "@/lib/his/catalogue";
import { parseDefinition } from "@/lib/his/template-schema";
import { prisma } from "@/lib/prisma";

export default async function TemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { facility, can } = await requireHisPage("MANAGE_DOCUMENT_TEMPLATES");
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const template = await prisma.clinicalDocumentTemplate.findFirst({ where: { id, facilityId: facility.id }, include: { versions: { orderBy: { version: "desc" } } } });
  if (!template) notFound();
  const latest = template.versions[0];
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 md:px-0">
      <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground"><Link href="/lab/clinical-documents" className="hover:underline">Medical documents</Link> / Templates / {template.name}</nav>
      <div>
        <h1 className="text-2xl font-bold">{template.name}</h1>
        <p className="text-sm text-muted-foreground">Group {template.groupCode} · {groupTitle(template.groupCode)}{template.sourceCode ? ` · based on system template ${template.sourceCode}` : " · custom"}{template.retiredAt ? " · RETIRED" : ""}</p>
      </div>
      <TemplateEditor
        templateId={template.id}
        name={template.name}
        status={latest.status}
        version={latest.version}
        definition={parseDefinition(latest.definition)}
        editable={latest.status === "DRAFT" && !template.retiredAt}
        canApprove={can("APPROVE_DOCUMENTS")}
        canManage={can("MANAGE_DOCUMENT_TEMPLATES")}
        history={template.versions.map((v) => ({ version: v.version, status: v.status, changeNote: v.changeNote, publishedAt: v.publishedAt?.toISOString() ?? null }))}
      />
    </div>
  );
}
