import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

const createSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  toUserId: z.string().uuid().optional(),
  summary: z.string().trim().min(1).max(2000),
  openTaskIds: z.array(z.string().uuid()).optional(),
});

// GET /api/facility/his/nursing/handover?patientId= — handover notes for a patient.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const patientId = new URL(req.url).searchParams.get("patientId") ?? "";
  if (!patientId) return NextResponse.json({ handovers: [] });
  await assertPatientLinked(access.facility.id, patientId);
  const handovers = await prisma.nursingHandover.findMany({
    where: { facilityId: access.facility.id, patientId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } } },
  });
  return NextResponse.json({ handovers });
});

// POST /api/facility/his/nursing/handover — record a shift handover with the
// outstanding tasks captured at the moment of handover (referenced by id).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  await assertPatientLinked(access.facility.id, body.patientId);

  // Only this facility's open tasks for this patient may be attached.
  const openTasks = body.openTaskIds?.length
    ? await prisma.nursingTask.findMany({
        where: { facilityId: access.facility.id, patientId: body.patientId, status: { in: ["DUE", "IN_PROGRESS", "ESCALATED"] } },
        select: { id: true },
      })
    : [];
  const openIds = body.openTaskIds?.filter((taskId) => openTasks.some((t) => t.id === taskId)) ?? [];

  const handover = await prisma.nursingHandover.create({
    data: {
      facilityId: access.facility.id,
      patientId: body.patientId,
      encounterId: body.encounterId ?? null,
      fromUserId: user.id,
      toUserId: body.toUserId ?? null,
      summary: body.summary,
      openTaskIds: openIds,
    },
  });
  await auditHis(access, "HIS_NURSING_HANDOVER_RECORDED", "NursingHandover", handover.id, req, {
    patientId: body.patientId,
    details: { toUserId: body.toUserId ?? null, openTasks: openIds.length },
  });
  return NextResponse.json({ handover }, { status: 201 });
});
