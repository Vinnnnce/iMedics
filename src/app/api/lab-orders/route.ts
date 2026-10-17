import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { findAccessiblePatient, getVerifiedLabProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { facilityPatientWhere } from "@/lib/facility-access";
import { createCareCaseInTx, derivedStatusForLabOrder } from "@/lib/cases";

const createSchema = z.object({
  patientId: z.string().uuid(),
  panelType: z.string().trim().max(100).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "STAT"]).default("ROUTINE"),
  clinicalNotes: z.string().trim().max(2000).optional(),
  testCodes: z.array(z.string().trim().min(1).max(50)).min(1).max(50),
});

// POST /api/lab-orders — a doctor requests lab tests for a patient in their care.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);
  await findAccessiblePatient(user, data.patientId, { write: true });

  const codes = [...new Set(data.testCodes)];
  const tests = await prisma.labTest.findMany({ where: { code: { in: codes }, isActive: true }, select: { id: true } });
  if (tests.length !== codes.length) throw badRequest("One or more of the requested tests do not exist");

  const order = await prisma.$transaction(async (tx) => {
    // Each lab order opens a unified care-episode case so results, files and
    // payments can be grouped with the ordering episode.
    const doctorProfile = await tx.doctorProfile.findUnique({ where: { userId: user.id }, select: { id: true, specialty: true } });
    const careCase = await createCareCaseInTx(tx, {
      type: "LABORATORY",
      patientId: data.patientId,
      primaryDoctorId: doctorProfile?.id ?? null,
      specialty: doctorProfile?.specialty ?? null,
      presentingComplaint: data.clinicalNotes || null,
      status: derivedStatusForLabOrder("ORDERED"),
      actorId: user.id,
      note: `Lab order placed (${tests.length} test${tests.length === 1 ? "" : "s"})`,
    });
    return tx.labOrder.create({
      data: {
        patientId: data.patientId,
        orderedById: user.id,
        caseId: careCase.id,
        panelType: data.panelType || null,
        priority: data.priority,
        clinicalNotes: data.clinicalNotes || null,
        items: { create: tests.map((t) => ({ labTestId: t.id })) },
      },
    });
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "LAB_ORDER_CREATED",
    resourceType: "LabOrder",
    resourceId: order.id,
    details: { tests: tests.length, priority: data.priority },
    req,
  });

  return NextResponse.json({ success: true, id: order.id }, { status: 201 });
});

const listSchema = z.object({
  status: z.enum(["ORDERED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
  patientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/lab-orders
//  - doctors: the orders they placed
//  - lab staff: the open queue (ordered / in progress) unless a status is given
//  - patients: their own orders
export const GET = withAuth(["DOCTOR", "LAB_SCIENTIST", "PATIENT"], async (req, { user }) => {
  const { status, patientId, limit } = parseQuery(req, listSchema);

  let where: Prisma.LabOrderWhereInput;
  if (user.role === "DOCTOR") {
    where = { orderedById: user.id, ...(status ? { status } : {}), ...(patientId ? { patientId } : {}) };
  } else if (user.role === "LAB_SCIENTIST") {
    await getVerifiedLabProfile(user);
    where = { patient: await facilityPatientWhere(user), status: status ?? { in: ["ORDERED", "IN_PROGRESS"] }, ...(patientId ? { patientId } : {}) };
  } else {
    where = { patient: { userId: user.id }, ...(status ? { status } : {}) };
  }

  const orders = await prisma.labOrder.findMany({
    where,
    orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: {
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } },
      orderedBy: { select: { name: true } },
      items: { include: { labTest: { select: { code: true, name: true, category: true } } } },
      results: { select: { id: true, status: true } },
    },
  });

  return NextResponse.json({
    orders: orders.map(({ patient, orderedBy, items, ...order }) => ({
      ...order,
      patient: {
        id: patient.id,
        name: `${patient.firstName} ${patient.lastName}`,
        caseNumber: patient.caseNumber,
        gender: patient.gender.toLowerCase(),
        dateOfBirth: patient.dateOfBirth,
      },
      orderedBy: orderedBy.name,
      tests: items.map((i) => i.labTest),
    })),
  });
});
