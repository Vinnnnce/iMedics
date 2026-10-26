import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { catalogueEntry } from "@/lib/his/catalogue";
import { carryLocks, lockedViolations, parseDefinition } from "@/lib/his/template-schema";

const saveSchema = z.object({
  name: z.string().trim().min(2).max(200).optional(),
  description: z.string().max(2000).nullish(),
  departments: z.array(z.string().trim().min(1).max(120)).max(30).optional(),
  specialty: z.string().max(80).nullish(),
  changeNote: z.string().max(500).optional(),
  definition: z.unknown(),
});

async function loadTemplate(facilityId: string, id: string) {
  const template = await prisma.clinicalDocumentTemplate.findFirst({
    where: { id, facilityId },
    include: { versions: { orderBy: { version: "desc" } } },
  });
  if (!template) throw notFound("Template not found");
  return template;
}

// GET /api/facility/his/templates/[id] — a template with its full version history.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const template = await loadTemplate(access.facility.id, parseId((await params).id));
  return NextResponse.json({ template, source: template.sourceCode ? catalogueEntry(template.sourceCode) ?? null : null });
});

// PUT /api/facility/his/templates/[id] — save the current DRAFT version. Published
// versions are immutable; locked (legally required) content from the source
// catalogue template cannot be removed or made optional.
export const PUT = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  const template = await loadTemplate(access.facility.id, parseId((await params).id));
  const body = await parseBody(req, saveSchema);
  const draft = template.versions[0];
  if (!draft || draft.status !== "DRAFT") throw conflict("Only a draft version can be edited — create a new version first");
  if (template.retiredAt) throw conflict("This template is retired");

  const source = template.sourceCode ? catalogueEntry(template.sourceCode)?.definition ?? null : null;
  const definition = carryLocks(source, parseDefinition(body.definition));
  if (source) {
    const problems = lockedViolations(source, definition);
    if (problems.length) throw badRequest(problems.join("; "));
  }

  await prisma.$transaction([
    prisma.clinicalDocumentTemplateVersion.update({ where: { id: draft.id }, data: { definition, editedById: user.id, changeNote: body.changeNote ?? draft.changeNote } }),
    prisma.clinicalDocumentTemplate.update({
      where: { id: template.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.departments ? { departments: body.departments } : {}),
        ...(body.specialty !== undefined ? { specialty: body.specialty } : {}),
      },
    }),
  ]);
  await auditHis(access, "HIS_TEMPLATE_DRAFT_SAVED", "ClinicalDocumentTemplate", template.id, req, { details: { version: draft.version } });
  return NextResponse.json({ ok: true, version: draft.version });
});
