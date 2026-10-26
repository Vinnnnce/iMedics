import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const schema = z.object({
  action: z.enum(["submit", "approve", "reject", "publish", "retire", "new-version"]),
  note: z.string().max(500).optional(),
});

// POST /api/facility/his/templates/[id]/actions — template lifecycle:
// DRAFT → IN_REVIEW → APPROVED → PUBLISHED → RETIRED. Publishing a new
// version retires the previous one; documents keep pointing at the exact
// version they were written against, so signed records never change.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, null, req);
  const { action, note } = await parseBody(req, schema);
  const id = parseId((await params).id);
  const template = await prisma.clinicalDocumentTemplate.findFirst({
    where: { id, facilityId: access.facility.id },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!template) throw notFound("Template not found");
  const latest = template.versions[0];
  const need = (p: Parameters<typeof hasPermission>[1]) => {
    if (!hasPermission(access, p)) throw forbidden("Your role does not allow this action");
  };
  const now = new Date();

  switch (action) {
    case "submit":
      need("MANAGE_DOCUMENT_TEMPLATES");
      if (latest.status !== "DRAFT") throw conflict("Only a draft can be submitted for review");
      await prisma.clinicalDocumentTemplateVersion.update({ where: { id: latest.id }, data: { status: "IN_REVIEW", submittedAt: now, changeNote: note ?? latest.changeNote } });
      break;
    case "reject":
      need("APPROVE_DOCUMENTS");
      if (latest.status !== "IN_REVIEW" && latest.status !== "APPROVED") throw conflict("Nothing is awaiting approval");
      await prisma.clinicalDocumentTemplateVersion.update({ where: { id: latest.id }, data: { status: "DRAFT", approvedAt: null, approvedById: null } });
      break;
    case "approve": {
      need("APPROVE_DOCUMENTS");
      if (latest.status !== "IN_REVIEW") throw conflict("Only a version in review can be approved");
      const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { independentTemplateApproval: true } });
      if ((settings?.independentTemplateApproval ?? true) && latest.editedById === user.id) {
        throw forbidden("Your hospital requires approval by someone other than the last editor");
      }
      await prisma.clinicalDocumentTemplateVersion.update({ where: { id: latest.id }, data: { status: "APPROVED", approvedById: user.id, approvedAt: now } });
      break;
    }
    case "publish":
      need("MANAGE_DOCUMENT_TEMPLATES");
      if (latest.status !== "APPROVED") throw conflict("Only an approved version can be published");
      await prisma.$transaction([
        prisma.clinicalDocumentTemplateVersion.updateMany({ where: { templateId: template.id, status: "PUBLISHED" }, data: { status: "RETIRED", retiredAt: now } }),
        prisma.clinicalDocumentTemplateVersion.update({ where: { id: latest.id }, data: { status: "PUBLISHED", publishedById: user.id, publishedAt: now } }),
        prisma.clinicalDocumentTemplate.update({ where: { id: template.id }, data: { publishedVersion: latest.version, retiredAt: null } }),
      ]);
      break;
    case "retire":
      need("MANAGE_DOCUMENT_TEMPLATES");
      await prisma.$transaction([
        prisma.clinicalDocumentTemplateVersion.updateMany({ where: { templateId: template.id, status: "PUBLISHED" }, data: { status: "RETIRED", retiredAt: now } }),
        prisma.clinicalDocumentTemplate.update({ where: { id: template.id }, data: { retiredAt: now, publishedVersion: null } }),
      ]);
      break;
    case "new-version":
      need("MANAGE_DOCUMENT_TEMPLATES");
      if (["DRAFT", "IN_REVIEW", "APPROVED"].includes(latest.status)) throw conflict("A new version is already in progress");
      await prisma.clinicalDocumentTemplateVersion.create({
        data: { templateId: template.id, version: latest.version + 1, status: "DRAFT", definition: latest.definition ?? {}, editedById: user.id, changeNote: note ?? null },
      });
      break;
  }

  await auditHis(access, `HIS_TEMPLATE_${action.toUpperCase().replace("-", "_")}`, "ClinicalDocumentTemplate", template.id, req, { details: { version: latest.version } });
  return NextResponse.json({ ok: true });
});
