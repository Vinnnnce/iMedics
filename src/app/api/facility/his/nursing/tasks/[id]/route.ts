import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { validateTaskTransition } from "@/lib/his/nursing";

const patchSchema = z.object({
  status: z.enum(["DUE", "IN_PROGRESS", "COMPLETED", "DEFERRED", "ESCALATED"]),
  assignedToId: z.string().uuid().optional(),
});

// PATCH /api/facility/his/nursing/tasks/[id] — move a task through its lifecycle.
// Only the guarded transitions are accepted; completing stamps the time.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "RECORD_NURSING", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const task = await prisma.nursingTask.findFirst({ where: { id, facilityId: access.facility.id } });
  if (!task) throw notFound("Care task not found");

  const status = validateTaskTransition(task.status, body.status);
  if (status === "COMPLETED" && !body.assignedToId && task.assignedToId && task.assignedToId !== user.id) {
    throw conflict("This task is assigned to another staff member");
  }
  const now = new Date();
  const updated = await prisma.nursingTask.update({
    where: { id },
    data: {
      status,
      completedAt: status === "COMPLETED" ? now : null,
      ...(body.assignedToId !== undefined ? { assignedToId: body.assignedToId } : {}),
    },
  });
  await auditHis(access, "HIS_NURSING_TASK_UPDATED", "NursingTask", id, req, {
    patientId: task.patientId,
    details: { from: task.status, to: status },
  });
  return NextResponse.json({ task: updated });
});
