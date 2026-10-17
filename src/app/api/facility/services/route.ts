import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { serializeService, serviceSchema, serviceSelect as select } from "@/lib/facility-services";
import { writeAudit } from "@/lib/audit";

// GET /api/facility/services — every service the facility offers (including inactive ones).
export const GET = withAuth(null, async (_req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_SERVICES", _req);
  const services = await prisma.facilityService.findMany({ where: { facilityId: facility.id }, orderBy: [{ isActive: "desc" }, { name: "asc" }], select });
  return NextResponse.json({ services: services.map(serializeService) });
});

// POST /api/facility/services — publish a new priced service.
export const POST = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_SERVICES", req);
  const data = await parseBody(req, serviceSchema);
  const service = await prisma.facilityService.create({ data: { ...data, facilityId: facility.id }, select });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "FACILITY_SERVICE_CREATED", resourceType: "FacilityService", resourceId: service.id, details: { price: data.price, currency: data.currency }, req });
  return NextResponse.json({ service: serializeService(service) }, { status: 201 });
});
