import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const patchSchema = z.object({
  number: z.string().trim().min(1).max(80).optional(),
  authority: z.string().trim().min(1).max(160).optional(),
  issueDate: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
  documentKey: z.string().trim().max(300).nullish(),
  restrictions: z.string().trim().max(500).nullish(),
  renewalStatus: z.enum(["CURRENT", "RENEWAL_DUE", "RENEWAL_IN_PROGRESS", "LAPSED"]).optional(),
});

const select = {
  id: true, staffId: true, type: true, number: true, authority: true,
  issueDate: true, expiryDate: true, verificationStatus: true, verifiedAt: true,
  restrictions: true, renewalStatus: true, lastReminderStage: true,
  staff: { select: { id: true, fullName: true, facilityRole: true, status: true } },
} as const;

// PATCH /api/facility/credentials/[id] — update a credential (numbers, dates,
// document). Verification status is platform-controlled and not editable here.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req, { requireVerified: false });
  const body = await parseBody(req, patchSchema);

  const credential = await prisma.staffCredential.findUnique({ where: { id }, select: { ...select, staff: { select: { facilityId: true } } } });
  if (!credential) throw notFound("Credential not found");
  assertSameFacility(credential.staff.facilityId, access.facility.id, "Credential");

  const updated = await prisma.staffCredential.update({
    where: { id },
    data: {
      ...(body.number !== undefined ? { number: body.number } : {}),
      ...(body.authority !== undefined ? { authority: body.authority } : {}),
      ...(body.issueDate !== undefined ? { issueDate: body.issueDate ?? null } : {}),
      ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate ?? null } : {}),
      ...(body.documentKey !== undefined ? { documentKey: body.documentKey ?? null } : {}),
      ...(body.restrictions !== undefined ? { restrictions: body.restrictions ?? null } : {}),
      ...(body.renewalStatus !== undefined ? { renewalStatus: body.renewalStatus } : {}),
    },
    select,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "STAFF_CREDENTIAL_UPDATED",
    resourceType: "StaffCredential", resourceId: id,
    details: { changes: Object.keys(body) }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ credential: updated });
});

// DELETE /api/facility/credentials/[id] — remove an incorrect credential record.
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req, { requireVerified: false });

  const credential = await prisma.staffCredential.findUnique({ where: { id }, select: { staff: { select: { facilityId: true } } } });
  if (!credential) throw notFound("Credential not found");
  assertSameFacility(credential.staff.facilityId, access.facility.id, "Credential");

  await prisma.staffCredential.delete({ where: { id } });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "STAFF_CREDENTIAL_DELETED",
    resourceType: "StaffCredential", resourceId: id,
    details: {}, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ ok: true });
});
