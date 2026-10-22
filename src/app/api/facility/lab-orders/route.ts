import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind, MINIMUM_PATIENT_SELECT } from "@/lib/modules/access-matrix";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const listSchema = z.object({
  status: z
    .enum([
      "ORDERED", "ACCEPTED", "SPECIMEN_PENDING", "SPECIMEN_REJECTED", "IN_PROGRESS",
      "AWAITING_VERIFICATION", "FINALIZED", "SENT_TO_FACILITY", "AMENDED", "COMPLETED", "CANCELLED",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/facility/lab-orders — the laboratory's order work queue (Module 02,
// Category 01). Only orders this facility performs (or unassigned legacy
// doctor orders) are visible, with minimum patient data only.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await requireFacilityKind(access, ["LABORATORY"]);
  const { status, limit } = parseQuery(req, listSchema);

  const orders = await prisma.labOrder.findMany({
    where: {
      OR: [
        { performingFacilityId: access.facility.id },
        { performingFacilityId: null, status: { in: ["ORDERED"] } },
      ],
      ...(status ? { status } : {}),
    },
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      priority: true,
      panelType: true,
      clinicalNotes: true,
      createdAt: true,
      orderedById: true,
      patient: { select: MINIMUM_PATIENT_SELECT },
      items: { select: { labTest: { select: { code: true, name: true } } } },
      specimens: { select: { id: true, accessionNumber: true, status: true } },
    },
  });

  return NextResponse.json({ orders });
});

const createSchema = z.object({
  patientId: z.string().uuid(),
  testCodes: z.array(z.string().trim().min(1).max(50)).min(1).max(50),
  panelType: z.string().trim().max(100).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  clinicalNotes: z.string().trim().max(2000).optional(),
  // The laboratory that will process the order (Module 02, Category 01).
  performingFacilityId: z.string().uuid(),
});

// POST /api/facility/lab-orders — a hospital creates a laboratory investigation
// request routed to a specific laboratory (shared workflow step 2-3).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const data = await parseBody(req, createSchema);

  const patient = await prisma.patient.findFirst({
    where: { id: data.patientId, deletedAt: null },
    select: { id: true },
  });
  if (!patient) throw badRequest("Patient not found");

  const codes = [...new Set(data.testCodes)];
  const tests = await prisma.labTest.findMany({
    where: { code: { in: codes }, isActive: true },
    select: { id: true },
  });
  if (tests.length !== codes.length) throw badRequest("One or more of the requested tests do not exist");

  const lab = await prisma.labStaffProfile.findFirst({
    where: { id: data.performingFacilityId, verificationStatus: "VERIFIED" },
    select: { id: true, user: { select: { id: true } } },
  });
  if (!lab) throw badRequest("The selected laboratory was not found or is not verified");

  const order = await prisma.labOrder.create({
    data: {
      patientId: data.patientId,
      orderedById: user.id,
      requestingFacilityId: access.facility.id,
      performingFacilityId: lab.id,
      panelType: data.panelType || null,
      priority: data.priority,
      clinicalNotes: data.clinicalNotes || null,
      status: "ORDERED",
      items: { create: tests.map((t) => ({ labTestId: t.id })) },
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_ORDER_CREATED",
    resourceType: "LabOrder",
    resourceId: order.id,
    details: {
      requestingFacilityId: access.facility.id,
      performingFacilityId: lab.id,
      tests: tests.length,
      priority: data.priority,
    },
    req,
  });

  // Let the laboratory know a new request is in its queue (no clinical detail).
  if (lab.user?.id) {
    await notifyUser(lab.user.id, { kind: "INVESTIGATION_UPDATED", orderId: order.id }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, id: order.id, order }, { status: 201 });
});
