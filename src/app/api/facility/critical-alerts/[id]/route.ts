import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { notFound, conflict } from "@/lib/errors";
import { notifyUser } from "@/lib/notifications/service";

const ackSchema = z.object({
  note: z.string().trim().max(1000).optional(),
});

// POST /api/facility/critical-alerts/[id] — acknowledge a critical result
// (Module 01/02: critical findings must be acknowledged; escalation stops).
// Only the ordering hospital may acknowledge its own alerts.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REVIEW_DOCUMENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, ackSchema);

  const alert = await prisma.criticalResultAlert.findFirst({
    where: { id, orderingFacilityId: access.facility.id },
    select: { id: true, status: true, patientId: true, labResult: { select: { labOrder: { select: { performingFacilityId: true } } } } },
  });
  if (!alert) throw notFound("Critical alert not found");
  if (alert.status === "ACKNOWLEDGED" || alert.status === "RESOLVED") {
    throw conflict("This alert was already acknowledged");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const claimed = await tx.criticalResultAlert.updateMany({
      where: { id, orderingFacilityId: access.facility.id, status: { in: ["SENT", "ESCALATED"] }, acknowledgedAt: null },
      data: { status: "ACKNOWLEDGED", acknowledgedById: user.id, acknowledgedAt: new Date(), ...(data.note ? { note: data.note } : {}) },
    });
    if (claimed.count !== 1) throw conflict("This alert was already acknowledged or resolved");
    await tx.auditLog.create({ data: {
      userId: user.id, actorRole: user.role, facilityId: access.facility.id, patientId: alert.patientId,
      action: "CRITICAL_ALERT_ACKNOWLEDGED", resourceType: "CriticalResultAlert", resourceId: id,
      details: { noteRecorded: Boolean(data.note) },
      ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: req.headers.get("user-agent"),
    } });
    return tx.criticalResultAlert.findUniqueOrThrow({
      where: { id }, select: { id: true, status: true, acknowledgedAt: true },
    });
  });

  // Tell the laboratory the alert reached a responsible clinician.
  if (alert.labResult?.labOrder?.performingFacilityId) {
    const lab = await prisma.labStaffProfile.findUnique({
      where: { id: alert.labResult.labOrder.performingFacilityId },
      select: { user: { select: { id: true } } },
    });
    if (lab?.user?.id) {
      await notifyUser(lab.user.id, { kind: "CRITICAL_ALERT_ACKNOWLEDGED", alertId: id }).catch(() => undefined);
    }
  }

  return NextResponse.json({ success: true, alert: updated });
});
