import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { auditInvestigation } from "@/lib/investigations/service";

const schema = z.object({ categoryIds: z.array(z.string().uuid()).min(1).max(30), enable: z.boolean().default(true) });

// POST — switch a whole department's standard catalogue on (or off) for this facility in one step.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_SERVICES", req);
  const { categoryIds, enable } = await parseBody(req, schema);
  if (enable) {
    const items = await prisma.investigation_catalogue_items.findMany({ where: { categoryId: { in: categoryIds }, isActive: true, source: "SYSTEM" }, select: { id: true } });
    await prisma.facility_investigations.createMany({ data: items.map((i) => ({ facility_id: access.facility.id, catalogue_item_id: i.id })), skipDuplicates: true });
    await prisma.facility_investigations.updateMany({ where: { facility_id: access.facility.id, catalogue_item_id: { in: items.map((i) => i.id) } }, data: { is_active: true } });
    await auditInvestigation(user, "FACILITY_INVESTIGATIONS_ENABLED", access.facility.id, { facilityId: access.facility.id, details: { count: items.length } });
    return NextResponse.json({ success: true, count: items.length });
  }
  const { count } = await prisma.facility_investigations.updateMany({ where: { facility_id: access.facility.id, item: { category_id: { in: categoryIds } } }, data: { is_active: false } });
  await auditInvestigation(user, "FACILITY_INVESTIGATIONS_DISABLED", access.facility.id, { facilityId: access.facility.id, details: { count } });
  return NextResponse.json({ success: true, count });
});
