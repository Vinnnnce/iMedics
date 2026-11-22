import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { notFound } from "@/lib/errors";
import { validNextStatuses } from "@/lib/investigations/service";

type Params = { id: string };

// GET /api/facility/investigations/items/[id] — full processing view for the performing facility,
// including previous released results of the same patient for comparison.
export const GET = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const item = await prisma.investigation_order_items.findFirst({
    where: { id, performingFacilityId: access.facility.id },
    include: {
      order: { include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } }, requestedBy: { select: { name: true } } } },
      catalogueItem: { select: { id: true, specimenType: true, preparation: true, indicationGuidance: true, analytes: { orderBy: { sortOrder: "asc" } } } },
      history: { orderBy: { createdAt: "asc" } },
      specimens: { orderBy: { createdAt: "asc" } },
      media: { orderBy: { createdAt: "asc" }, select: { id: true, fileName: true, mimeType: true, sizeBytes: true, description: true, dicomModality: true, studyInstanceUid: true, resultId: true, createdAt: true } },
      results: { orderBy: { version: "desc" }, include: { observations: { orderBy: { sortOrder: "asc" } }, alerts: { include: { events: { orderBy: { createdAt: "asc" } } } } } },
      referrals: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!item) throw notFound("Investigation not found");

  // Facility-specific analyte ranges override the platform defaults.
  const analytes = item.catalogueItem
    ? await prisma.investigation_Analytes.findMany({ where: { catalogueItemId: item.catalogueItem.id, OR: [{ facilityId: access.facility.id }, { facilityId: null }] }, orderBy: { sortOrder: "asc" } })
    : [];
  const merged = new Map<string, (typeof analytes)[number]>();
  for (const a of analytes) if (!merged.has(a.code) || a.facilityId) merged.set(a.code, a);

  const codes = [...merged.keys()];
  const previous = codes.length
    ? await prisma.investigation_observations.findMany({
        where: { analyteCode: { in: codes }, result: { status: "RELEASED", item: { id: { not: id }, order: { patientId: item.order.patientId } } } },
        orderBy: { result: { releasedAt: "desc" } }, take: 40,
        select: { analyteCode: true, valueNumeric: true, valueText: true, unit: true, flag: true, result: { select: { releasedAt: true } } },
      })
    : [];

  const { catalogueItem, ...rest } = item;
  return NextResponse.json({
    item: { ...rest, catalogue: catalogueItem ? { ...catalogueItem, analytes: undefined } : null },
    analytes: [...merged.values()],
    previous,
    nextStatuses: validNextStatuses(item.domain, item.status),
    permissions: access.permissions,
  });
});
