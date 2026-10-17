import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { requireFacilityAccess, assertSameFacility } from "@/lib/facility-auth";

const credentialSelect = {
  id: true, staffId: true, type: true, number: true, authority: true,
  issueDate: true, expiryDate: true, verificationStatus: true, verifiedAt: true,
  restrictions: true, renewalStatus: true, lastReminderStage: true,
  staff: { select: { id: true, fullName: true, facilityRole: true, status: true } },
} as const;

// GET /api/facility/credentials — credentials for the facility's staff,
// with computed expiry state for the 90/60/30/7-day reminder thresholds.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req, { requireVerified: false });
  const credentials = await prisma.staffCredential.findMany({
    where: { staff: { facilityId: access.facility.id } },
    orderBy: [{ expiryDate: "asc" }],
    select: credentialSelect,
  });
  return NextResponse.json({ credentials });
});

const createSchema = z.object({
  staffId: z.string().uuid(),
  type: z.enum([
    "MEDICAL_LICENCE", "NURSING_LICENCE", "LAB_SCIENTIST_REGISTRATION", "RADIOGRAPHER_LICENCE",
    "PROFESSIONAL_CERTIFICATION", "TRAINING_CERTIFICATE",
  ]),
  number: z.string().trim().min(1).max(80),
  authority: z.string().trim().min(1).max(160),
  issueDate: z.coerce.date().nullish(),
  expiryDate: z.coerce.date().nullish(),
  documentKey: z.string().trim().max(300).nullish(),
  restrictions: z.string().trim().max(500).nullish(),
});

// POST /api/facility/credentials — record a staff credential.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req, { requireVerified: false });
  const input = await parseBody(req, createSchema);

  const staff = await prisma.facilityStaff.findUnique({ where: { id: input.staffId }, select: { id: true, facilityId: true } });
  if (!staff) throw notFound("Staff member not found");
  assertSameFacility(staff.facilityId, access.facility.id, "Staff member");

  const credential = await prisma.staffCredential.create({
    data: {
      staffId: input.staffId,
      type: input.type,
      number: input.number,
      authority: input.authority,
      issueDate: input.issueDate ?? null,
      expiryDate: input.expiryDate ?? null,
      documentKey: input.documentKey ?? null,
      restrictions: input.restrictions ?? null,
    },
    select: credentialSelect,
  });

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "STAFF_CREDENTIAL_CREATED",
    resourceType: "StaffCredential", resourceId: credential.id,
    details: { type: input.type, staffId: input.staffId }, facilityId: access.facility.id, req,
  });

  return NextResponse.json({ credential }, { status: 201 });
});
