import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { requireFacilityAccess, effectivePermissions } from "@/lib/facility-auth";
import { FACILITY_PERMISSIONS } from "@/lib/facility-staff";
import { patientLinkedToFacility } from "@/lib/staff-access";
import { controlAudit } from "@/lib/organization/security";

const schema = z.object({
  accessLevel: z.enum(["NONE", "READ_ONLY", "LIMITED", "STANDARD", "EXTENDED", "DEPARTMENT", "FULL", "CUSTOM"]).optional(),
  customCategory: z.string().trim().max(120).nullish(),
  departmentIds: z.array(z.string().uuid()).max(50).optional(),
  accessStartsAt: z.coerce.date().nullish(), accessExpiresAt: z.coerce.date().nullish(),
  permissionOverrides: z.object({
    add: z.array(z.enum(FACILITY_PERMISSIONS)).max(50),
    remove: z.array(z.enum(FACILITY_PERMISSIONS)).max(50),
  }).optional(),
});
const grantSchema = z.object({
  action: z.enum(["GRANT", "REVOKE"]), patientId: z.string().uuid(),
  scope: z.enum(["CARE_TEAM", "DEPARTMENT", "TEMPORARY"]).default("CARE_TEAM"),
  justification: z.string().trim().min(15).max(500),
  expiresInHours: z.number().int().min(1).max(168).default(24),
});
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const staff = await prisma.facilityStaff.findFirst({ where: { id: parseId((await params).id), facilityId: access.facility.id },
    select: { id: true, facilityRole: true, accessLevel: true, customCategory: true, departmentIds: true, permissionOverrides: true, accessStartsAt: true, accessExpiresAt: true,
      patientAccessGrants: { where: { revokedAt: null }, select: { id: true, patientId: true, scope: true, expiresAt: true } } } });
  if (!staff) throw notFound("Staff member not found");
  return NextResponse.json({ staff, permissions: effectivePermissions(staff), catalogue: FACILITY_PERMISSIONS });
});
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const id = parseId((await params).id);
  const data = await parseBody(req, schema);
  const staff = await prisma.$transaction(async (tx) => {
    const current = await tx.facilityStaff.findFirst({ where: { id, facilityId: access.facility.id } });
    if (!current) throw notFound("Staff member not found");
    if (current.facilityRole === "OWNER") throw forbidden("Owner access is platform-managed");
    // Prevent delegated managers from granting powers they do not hold, including via a role change.
    for (const p of data.permissionOverrides?.add ?? []) if (access.facilityRole !== "OWNER" && !access.permissions.includes(p)) throw forbidden("You cannot delegate permissions you do not hold");
    if (data.departmentIds && await tx.facilityDepartment.count({ where: { id: { in: [...new Set(data.departmentIds)] }, facilityId: access.facility.id } }) !== new Set(data.departmentIds).size) throw forbidden("Departments must belong to this facility");
    const startsAt = data.accessStartsAt === undefined ? current.accessStartsAt : data.accessStartsAt;
    const expiresAt = data.accessExpiresAt === undefined ? current.accessExpiresAt : data.accessExpiresAt;
    if (startsAt && expiresAt && startsAt >= expiresAt) throw forbidden("Access expiry must follow its start");
    const updated = await tx.facilityStaff.update({ where: { id }, data });
    await controlAudit(tx, user.id, access.facility.id, "STAFF_ACCESS_UPDATED", id, { before: { accessLevel: current.accessLevel, overrides: current.permissionOverrides }, after: JSON.parse(JSON.stringify(data)) });
    return { id: updated.id, accessLevel: updated.accessLevel, permissions: effectivePermissions(updated) };
  });
  return NextResponse.json({ staff });
});
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req);
  const staffId = parseId((await params).id);
  const body = await parseBody(req, grantSchema);
  if (!await prisma.facilityStaff.findFirst({ where: { id: staffId, facilityId: access.facility.id, status: "ACTIVE" } })) throw notFound("Active staff member not found");
  if (!await patientLinkedToFacility(access.facility.id, body.patientId)) throw notFound("Patient not found at this facility");
  await prisma.$transaction(async (tx) => {
    if (body.action === "REVOKE") {
      await tx.staffPatientAccess.updateMany({ where: { facilityId: access.facility.id, staffId, patientId: body.patientId, revokedAt: null }, data: { revokedAt: new Date(), revokedById: user.id } });
    } else {
      const data = { scope: body.scope, expiresAt: body.scope === "TEMPORARY" ? new Date(Date.now() + body.expiresInHours * 3_600_000) : null, justification: body.justification, grantedById: user.id, grantedAt: new Date(), revokedAt: null, revokedById: null };
      await tx.staffPatientAccess.upsert({ where: { staffId_patientId: { staffId, patientId: body.patientId } }, create: { ...data, staffId, patientId: body.patientId, facilityId: access.facility.id }, update: data });
    }
    await controlAudit(tx, user.id, access.facility.id, `STAFF_PATIENT_ACCESS_${body.action}`, staffId, { patientId: body.patientId, reason: body.justification });
  });
  return NextResponse.json({ ok: true });
});
