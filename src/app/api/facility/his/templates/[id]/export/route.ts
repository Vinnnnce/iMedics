import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

// GET /api/facility/his/templates/[id]/export — the latest version as portable JSON
// (structure only; never patient data). Re-import with POST /templates { mode: "import" }.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const template = await prisma.clinicalDocumentTemplate.findFirst({
    where: { id: parseId((await params).id), facilityId: access.facility.id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!template) throw notFound("Template not found");
  await auditHis(access, "HIS_TEMPLATE_EXPORTED", "ClinicalDocumentTemplate", template.id, req);
  const body = {
    format: "medic1905.clinical-template",
    formatVersion: 1,
    name: template.name,
    groupCode: template.groupCode,
    sourceCode: template.sourceCode,
    description: template.description,
    version: template.versions[0]?.version,
    definition: template.versions[0]?.definition,
  };
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="template-${template.code.slice(0, 60)}.json"` },
  });
});
