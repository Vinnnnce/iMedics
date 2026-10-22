import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { assertAdmissionTransfer } from "@/lib/modules/workflows";
import { badRequest, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const transferSchema = z
  .object({
    // Internal ward transfer (mutually exclusive with toFacilityId).
    toWard: z.string().trim().min(1).max(100).optional(),
    reason: z.string().trim().max(1000).optional(),
    // Interfacility transfer (Module 01, Category 05).
    toFacilityId: z.string().uuid().optional(),
    summary: z.string().trim().max(10000).optional(),
  })
  .refine((v) => Boolean(v.toWard) !== Boolean(v.toFacilityId), {
    message: "Provide either an internal ward transfer or an interfacility transfer",
  });

// POST /api/facility/admissions/[id]/transfers — internal or interfacility transfer.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
  await requireFacilityKind(access, ["HOSPITAL"]);
  const id = parseId((await params).id);
  const data = await parseBody(req, transferSchema);

  const admission = await prisma.admission.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, status: true, ward: true },
  });
  if (!admission) throw notFound("Admission not found");

  // Internal ward transfer: the episode stays ACTIVE, history is preserved.
  if (data.toWard) {
    assertAdmissionTransfer(admission.status, data.reason ?? "Ward transfer");
    const transfer = await prisma.$transaction(async (tx) => {
      const t = await tx.wardTransfer.create({
        data: {
          admissionId: id,
          fromWard: admission.ward,
          toWard: data.toWard!,
          reason: data.reason ?? null,
          actorId: user.id,
          transferredAt: new Date(),
        },
        select: { id: true },
      });
      await tx.admission.update({ where: { id }, data: { ward: data.toWard } });
      return t;
    });

    await writeAudit({
      userId: user.id,
      actorRole: user.role,
      action: "ADMISSION_WARD_TRANSFER",
      resourceType: "Admission",
      resourceId: id,
      details: { toWard: data.toWard, reason: data.reason ?? null },
      req,
    });

    return NextResponse.json({ success: true, transfer }, { status: 201 });
  }

  // Interfacility transfer: closes the episode here with a transfer summary.
  assertAdmissionTransfer(admission.status, data.summary ?? "Interfacility transfer");
  const target = await prisma.labStaffProfile.findFirst({
    where: { id: data.toFacilityId!, verificationStatus: "VERIFIED" },
    select: { id: true, laboratoryName: true },
  });
  if (!target) throw badRequest("The receiving facility was not found or is not verified");

  const updated = await prisma.admission.update({
    where: { id },
    data: {
      status: "TRANSFERRED",
      transferredToFacilityId: target.id,
      transferSummary: data.summary ?? null,
    },
    select: { id: true, status: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMISSION_INTERFACILITY_TRANSFER",
    resourceType: "Admission",
    resourceId: id,
    details: { toFacilityId: target.id },
    req,
  });

  return NextResponse.json({ success: true, admission: updated });
});
