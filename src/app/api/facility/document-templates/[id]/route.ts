import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { notFound, forbidden } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const renameSchema = z.object({
  name: z.string().trim().min(1, "A template needs a name").max(80),
});

async function requireFacilityTemplate(id: string, facilityId: string, userId: string) {
  const template = await prisma.facilityDocumentTemplate.findUnique({ where: { id } });
  if (!template) throw notFound("Template not found");
  if (template.facilityId !== facilityId) throw forbidden("That template belongs to another facility");
  // The caller must hold template rights in the template's facility (checked
  // by the route via requireFacilityAccess before this helper runs).
  void userId;
  return template;
}

// PUT /api/facility/document-templates/[id] — rename a facility template.
export const PUT = withAuth<{ id: string }>(["DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { facility } = await requireFacilityAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  await requireFacilityTemplate(id, facility.id, user.id);
  const data = await parseBody(req, renameSchema);

  const template = await prisma.facilityDocumentTemplate.update({
    where: { id },
    data: { name: data.name },
    select: {
      id: true, name: true, kind: true, content: true,
      createdAt: true, updatedAt: true, createdBy: { select: { name: true } },
    },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_DOCUMENT_TEMPLATE_RENAMED",
    resourceType: "FacilityDocumentTemplate",
    resourceId: id,
    req,
  });

  return NextResponse.json({ template });
});

// DELETE /api/facility/document-templates/[id] — delete a facility template.
export const DELETE = withAuth<{ id: string }>(["DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { facility } = await requireFacilityAccess(user, "MANAGE_DOCUMENT_TEMPLATES", req);
  await requireFacilityTemplate(id, facility.id, user.id);

  await prisma.facilityDocumentTemplate.delete({ where: { id } });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_DOCUMENT_TEMPLATE_DELETED",
    resourceType: "FacilityDocumentTemplate",
    resourceId: id,
    req,
  });

  return NextResponse.json({ success: true });
});
