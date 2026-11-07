import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  admissionId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  instructions: z.string().trim().max(1000).optional(),
  dueAt: z.string().datetime().optional(),
  assignedToId: z.string().uuid().optional(),
});

// GET /api/facility/his/nursing/tasks?patientId=&status=&mine= — care tasks.
// Without a patientId this returns the ward worklist (optionally just the caller's).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const params = new URL(req.url).searchParams;
  const patientId = params.get("patientId") ?? undefined;
  const status = params.get("status") ?? undefined;
  const mine = params.get("mine") === "1";
  if (patientId) await assertPatientLinked(access.facility.id, patientId);
  const tasks = await prisma.nursingTask.findMany({
    where: {
      facilityId: access.facility.id,
      ...(patientId ? { patientId } : {}),
      ...(status ? { status } : {}),
      ...(mine ? { assignedToId: user.id } : {}),
    },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
  });
  return NextResponse.json({ tasks });
});

// POST /api/facility/his/nursing/tasks — create a care task (starts as DUE).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  await assertPatientLinked(access.facility.id, body.patientId);
  const dueAt = body.dueAt ? new Date(body.dueAt) : null;
  if (dueAt && Number.isNaN(dueAt.getTime())) {
    return NextResponse.json({ error: "The due date is not valid" }, { status: 400 });
  }
  const task = await prisma.nursingTask.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      encounterId: body.encounterId ?? null,
      admissionId: body.admissionId ?? null,
      title: body.title,
      status: "DUE",
      instructions: body.instructions ?? null,
      dueAt,
      assignedToId: body.assignedToId ?? null,
      createdById: user.id,
    },
  });
  await auditHis(access, "HIS_NURSING_TASK_CREATED", "NursingTask", task.id, req, {
    patientId: body.patientId,
    details: { title: body.title, assignedToId: body.assignedToId ?? null },
  });
  return NextResponse.json({ task }, { status: 201 });
});
