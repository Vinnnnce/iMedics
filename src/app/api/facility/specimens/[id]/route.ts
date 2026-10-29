import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { assertSpecimenTransition } from "@/lib/modules/workflows";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const actionSchema = z.object({
  action: z.enum(["COLLECT", "RECEIVE", "REJECT", "REQUEST_RECOLLECTION", "PROCESS"]),
  reason: z.string().trim().max(1000).optional(),
  collectedAt: z.coerce.date().optional(),
});

const NEXT_STATUS = {
  COLLECT: "COLLECTED",
  RECEIVE: "RECEIVED",
  REJECT: "REJECTED",
  REQUEST_RECOLLECTION: "RECOLLECTION_REQUESTED",
  PROCESS: "PROCESSED",
} as const;

// PATCH /api/facility/specimens/[id] — specimen processing events with
// permission and reason checks (rejection always needs a documented reason).
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await requireFacilityKind(access, ["LABORATORY"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, actionSchema);

  // Facility-scoped lookup: specimens of other organizations 404 here.
  const specimen = await prisma.specimen.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true, labOrderId: true },
  });
  if (!specimen) throw notFound("Specimen not found");

  const to = NEXT_STATUS[data.action];
  assertSpecimenTransition(specimen.status, to, access.permissions, data.reason);

  const updated = await prisma.specimen.update({
    where: { id },
    data: {
      status: to,
      ...(data.action === "COLLECT" ? { collectedAt: data.collectedAt ?? new Date(), collectedById: user.id } : {}),
      ...(data.action === "RECEIVE" ? { receivedAt: new Date(), receivedById: user.id } : {}),
      ...(data.action === "REJECT" ? { rejectionReason: data.reason } : {}),
    },
    select: { id: true, accessionNumber: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: `SPECIMEN_${data.action}`,
    resourceType: "Specimen",
    resourceId: id,
    details: { to, reason: data.reason ?? null },
    req,
  });

  return NextResponse.json({ success: true, specimen: updated });
});
