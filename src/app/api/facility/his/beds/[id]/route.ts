import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";

/**
 * PATCH /api/facility/his/beds/[id] — bed lifecycle transitions.
 *
 * Statuses: AVAILABLE → RESERVED (hold for an admission) → OCCUPIED
 * (admission placed) → CLEANING (after discharge) → AVAILABLE.
 * MAINTENANCE and ISOLATION are manual blocks with reasons.
 */

const schema = z.object({
  action: z.enum([
    "RESERVE", "OCCUPY", "RELEASE", "MARK_CLEANED", "BLOCK_MAINTENANCE", "BLOCK_ISOLATION", "UNBLOCK",
  ]),
  admissionId: z.string().uuid().optional(),
  reason: z.string().trim().max(200).optional(),
});

export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const body = await parseBody(req, schema);

  const bed = await prisma.bed.findFirst({
    where: { id, facilityId: access.facility.id },
    include: { currentAdmission: { select: { id: true, status: true, patientId: true } } },
  });
  if (!bed) throw notFound("Bed not found");

  const now = new Date();

  switch (body.action) {
    case "RESERVE": {
      if (!body.admissionId) throw badRequest("admissionId is required to reserve a bed");
      if (bed.status !== "AVAILABLE") throw conflict(`Bed is ${bed.status}, not AVAILABLE`);
      const admission = await prisma.admission.findFirst({
        where: { id: body.admissionId, facilityId: access.facility.id, status: "ACTIVE" },
        select: { id: true },
      });
      if (!admission) throw notFound("Active admission not found");
      await prisma.bed.update({
        where: { id },
        data: { status: "RESERVED", reservedForAdmissionId: admission.id, reservedUntil: new Date(now.getTime() + 2 * 3_600_000) },
      });
      break;
    }
    case "OCCUPY": {
      if (!body.admissionId) throw badRequest("admissionId is required to occupy a bed");
      const admission = await prisma.admission.findFirst({
        where: { id: body.admissionId, facilityId: access.facility.id, status: "ACTIVE" },
        select: { id: true, currentBedId: true, currentWardId: true },
      });
      if (!admission) throw notFound("Active admission not found");
      if (bed.status === "OCCUPIED") throw conflict("Bed is already occupied");
      if (bed.status !== "RESERVED" && bed.status !== "AVAILABLE") throw conflict(`Bed is ${bed.status}`);

      await prisma.$transaction(async (tx) => {
        // Free the admission's previous bed, if any.
        if (admission.currentBedId) {
          await tx.bed.update({
            where: { id: admission.currentBedId },
            data: { status: "CLEANING", currentAdmissionId: null, cleanedAt: null },
          });
        }
        const fromWard = admission.currentWardId
          ? (await tx.ward.findUnique({ where: { id: admission.currentWardId }, select: { name: true } }))?.name
          : null;
        const toWard = (await tx.ward.findUnique({ where: { id: bed.wardId }, select: { name: true } }))?.name ?? "";
        await tx.bed.update({
          where: { id },
          data: {
            status: "OCCUPIED",
            currentAdmissionId: admission.id,
            reservedForAdmissionId: null,
            reservedUntil: null,
          },
        });
        await tx.admission.update({
          where: { id: admission.id },
          data: { currentWardId: bed.wardId, currentBedId: id, ward: toWard, bed: bed.label },
        });
        await tx.wardTransfer.create({
          data: {
            admissionId: admission.id,
            fromWard,
            toWard,
            fromBedId: admission.currentBedId,
            toBedId: id,
            actorId: user.id,
            transferredAt: now,
            reason: body.reason ?? "Bed assignment",
          },
        });
      });
      break;
    }
    case "RELEASE": {
      // Discharge: free the bed, send it to cleaning.
      const currentAdmission = bed.currentAdmission;
      if (bed.status !== "OCCUPIED" || !currentAdmission) throw conflict("Bed is not occupied");
      await prisma.$transaction(async (tx) => {
        await tx.admission.updateMany({
          where: { id: currentAdmission.id },
          data: { currentBedId: null, currentWardId: null },
        });
        await tx.bed.update({
          where: { id },
          data: { status: "CLEANING", currentAdmissionId: null, cleanedAt: null },
        });
      });
      break;
    }
    case "MARK_CLEANED": {
      if (bed.status !== "CLEANING") throw conflict("Bed is not in CLEANING state");
      await prisma.bed.update({ where: { id }, data: { status: "AVAILABLE", cleanedAt: now } });
      break;
    }
    case "BLOCK_MAINTENANCE": {
      if (bed.status === "OCCUPIED") throw conflict("Bed is occupied");
      await prisma.bed.update({
        where: { id },
        data: { status: "MAINTENANCE", notes: body.reason ?? "Maintenance" },
      });
      break;
    }
    case "BLOCK_ISOLATION": {
      if (bed.status === "OCCUPIED") throw conflict("Bed is occupied");
      await prisma.bed.update({
        where: { id },
        data: { status: "ISOLATION", isolationReason: body.reason ?? "Infection control" },
      });
      break;
    }
    case "UNBLOCK": {
      if (bed.status !== "MAINTENANCE" && bed.status !== "ISOLATION") throw conflict("Bed is not blocked");
      await prisma.bed.update({
        where: { id },
        data: { status: "AVAILABLE", isolationReason: null, notes: null },
      });
      break;
    }
  }

  const updated = await prisma.bed.findUniqueOrThrow({
    where: { id },
    select: { id: true, label: true, status: true },
  });
  await auditHis(access, "BED_STATUS_CHANGED", "Bed", id, req, {
    details: { action: body.action, admissionId: body.admissionId ?? null },
  });
  return NextResponse.json({ bed: updated });
});
