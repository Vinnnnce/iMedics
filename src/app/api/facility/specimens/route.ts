import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind, MINIMUM_PATIENT_SELECT } from "@/lib/modules/access-matrix";
import { allocateAccessionNumber } from "@/lib/modules/accession";
import { conflict, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const listSchema = z.object({
  status: z
    .enum(["PENDING_COLLECTION", "COLLECTED", "RECEIVED", "REJECTED", "RECOLLECTION_REQUESTED", "PROCESSED"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/specimens — the laboratory's specimen work queue
// (Module 02, Category 02). Only orders this facility performs are visible.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await requireFacilityKind(access, ["LABORATORY"]);
  const { status, limit } = parseQuery(req, listSchema);

  const specimens = await prisma.specimen.findMany({
    where: { facilityId: access.facility.id, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      accessionNumber: true,
      specimenType: true,
      status: true,
      collectedAt: true,
      receivedAt: true,
      rejectionReason: true,
      createdAt: true,
      parentSpecimenId: true,
      labOrder: {
        select: {
          id: true,
          status: true,
          priority: true,
          panelType: true,
          patient: { select: MINIMUM_PATIENT_SELECT },
          items: { select: { labTest: { select: { code: true, name: true } } } },
        },
      },
    },
  });

  return NextResponse.json({ specimens });
});

const registerSchema = z.object({
  labOrderId: z.string().uuid(),
  specimenType: z.string().trim().max(100).optional(),
  collectedAt: z.coerce.date().optional(),
  // When provided, the previous (rejected) specimen this one replaces.
  parentSpecimenId: z.string().uuid().optional(),
});

// POST /api/facility/specimens — register and accession a specimen against an
// authorized laboratory order. Legacy unassigned orders are claimed atomically.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await requireFacilityKind(access, ["LABORATORY"]);
  const data = await parseBody(req, registerSchema);

  const order = await prisma.labOrder.findUnique({
    where: { id: data.labOrderId },
    select: { id: true, status: true, performingFacilityId: true },
  });
  if (!order) throw notFound("Laboratory order not found");

  if (order.performingFacilityId && order.performingFacilityId !== access.facility.id) {
    // Organization-level isolation: another lab's order is invisible to us.
    throw notFound("Laboratory order not found");
  }

  if (order.status === "CANCELLED") throw conflict("This order was cancelled");

  const specimen = await prisma.$transaction(async (tx) => {
    // Claim legacy doctor-placed orders exactly once (atomic guard).
    if (!order.performingFacilityId) {
      const claimed = await tx.labOrder.updateMany({
        where: { id: order.id, performingFacilityId: null },
        data: { performingFacilityId: access.facility.id, status: order.status === "ORDERED" ? "ACCEPTED" : order.status },
      });
      if (claimed.count === 0) throw conflict("This order was just claimed by another laboratory");
    }
    const accessionNumber = await allocateAccessionNumber(tx, access.facility.id);
    return tx.specimen.create({
      data: {
        labOrderId: order.id,
        facilityId: access.facility.id,
        accessionNumber,
        specimenType: data.specimenType ?? null,
        status: data.collectedAt ? "COLLECTED" : "PENDING_COLLECTION",
        ...(data.collectedAt ? { collectedAt: data.collectedAt, collectedById: user.id } : {}),
        parentSpecimenId: data.parentSpecimenId ?? null,
      },
      select: { id: true, accessionNumber: true, status: true },
    });
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "SPECIMEN_REGISTERED",
    resourceType: "Specimen",
    resourceId: specimen.id,
    details: { accessionNumber: specimen.accessionNumber, labOrderId: order.id },
    req,
  });

  return NextResponse.json({ success: true, specimen }, { status: 201 });
});
