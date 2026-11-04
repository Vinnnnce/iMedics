import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { REGULATED_PERMISSIONS } from "@/lib/organization/privileges";
import { controlAudit } from "@/lib/organization/security";
import { notFound, forbidden } from "@/lib/errors";

const schema = z.object({ permission: z.string().refine((p) => REGULATED_PERMISSIONS.includes(p as typeof REGULATED_PERMISSIONS[number])),
  credentialId: z.string().uuid(), expiresAt: z.coerce.date(), reason: z.string().trim().min(15).max(1000), confirmation: z.literal("GRANT CLINICAL PRIVILEGE") });
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req);
  const staffId = parseId((await params).id);
  if (!await prisma.facilityStaff.findFirst({ where: { id: staffId, facilityId: access.facility.id } })) throw notFound("Staff not found");
  return NextResponse.json({ privileges: await prisma.clinicalPrivilege.findMany({ where: { staffId }, orderBy: { startsAt: "desc" } }) });
});
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req);
  // Granting regulated privileges requires the facility's accountable owner, not HR role delegation.
  if (access.facilityRole !== "OWNER") throw forbidden("Facility owner authorization required");
  const staffId = parseId((await params).id);
  const body = await parseBody(req, schema);
  if (body.expiresAt <= new Date() || body.expiresAt.getTime() > Date.now() + 366 * 86400000) throw forbidden("Privilege must expire within one year");
  const privilege = await prisma.$transaction(async (tx) => {
    const credential = await tx.staffCredential.findFirst({ where: { id: body.credentialId, staffId, verificationStatus: "VERIFIED", renewalStatus: { not: "LAPSED" }, staff: { facilityId: access.facility.id, status: "ACTIVE" }, OR: [{ expiryDate: null }, { expiryDate: { gte: body.expiresAt } }] } });
    if (!credential) throw forbidden("A verified credential valid for the entire privilege period is required");
    const { confirmation: _, ...data } = body;
    const row = await tx.clinicalPrivilege.create({ data: { ...data, staffId, grantedById: user.id } });
    await controlAudit(tx, user.id, access.facility.id, "CLINICAL_PRIVILEGE_GRANTED", row.id, { permission: body.permission, staffId, reason: body.reason });
    return row;
  });
  return NextResponse.json({ privilege }, { status: 201 });
});
export const DELETE = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_CREDENTIALS", req);
  if (access.facilityRole !== "OWNER") throw forbidden("Facility owner authorization required");
  const staffId = parseId((await params).id);
  const body = await parseBody(req, z.object({ id: z.string().uuid(), reason: z.string().trim().min(15).max(1000) }));
  await prisma.$transaction(async (tx) => {
    const changed = await tx.clinicalPrivilege.updateMany({ where: { id: body.id, staffId, staff: { facilityId: access.facility.id }, revokedAt: null }, data: { revokedAt: new Date() } });
    if (!changed.count) throw notFound("Privilege not found");
    await controlAudit(tx, user.id, access.facility.id, "CLINICAL_PRIVILEGE_REVOKED", body.id, { staffId, reason: body.reason });
  });
  return NextResponse.json({ ok: true });
});
