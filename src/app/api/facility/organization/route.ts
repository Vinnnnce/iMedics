import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess, effectivePermissions } from "@/lib/facility-auth";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { assertAcyclic, validateOrganizationLinks, controlAudit } from "@/lib/organization/security";
import { PROFESSIONAL_CATEGORIES, DEPARTMENT_SUGGESTIONS } from "@/lib/organization/catalogue";

export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const facilityId = access.facility.id;
  const [departments, staff, positions, history, audit] = await Promise.all([
    prisma.facilityDepartment.findMany({ where: { facilityId }, orderBy: { name: "asc" }, include: { _count: { select: { staff: true, services: true } } } }),
    prisma.facilityStaff.findMany({ where: { facilityId }, orderBy: { fullName: "asc" }, select: {
      id: true, fullName: true, email: true, status: true, facilityRole: true, departmentId: true, reportsToId: true, professionalTitle: true, specialty: true, customCategory: true, employmentType: true,
      accessLevel: true, accessStartsAt: true, accessExpiresAt: true, departmentIds: true, permissionOverrides: true, invitationState: true, inviteExpiresAt: true,
      credentials: { select: { id: true, type: true, authority: true, verificationStatus: true, expiryDate: true } },
    } }),
    prisma.organizationPosition.findMany({ where: { facilityId }, orderBy: [{ rank: "asc" }, { title: "asc" }], include: { appointments: { where: { staff: { status: "ACTIVE" }, effectiveAt: { lte: new Date() }, OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] }, include: { staff: { select: { fullName: true, status: true } } } } } }),
    prisma.staffAppointment.findMany({ where: { facilityId }, orderBy: { createdAt: "desc" }, take: 100, include: { staff: { select: { fullName: true } }, position: { select: { title: true } } } }),
    prisma.controlAuditEvent.findMany({ where: { facilityId }, orderBy: { sequence: "desc" }, take: 50 }),
  ]);
  return NextResponse.json({ facility: { id: facilityId, name: access.facility.laboratoryName }, departments,
    staff: staff.map((s) => ({ ...s, permissions: effectivePermissions(s), invitationState: s.status === "INVITED" && s.inviteExpiresAt && s.inviteExpiresAt < new Date() ? "EXPIRED" : s.invitationState })),
    positions, history, audit: audit.map((e) => ({ ...e, sequence: String(e.sequence) })), categories: PROFESSIONAL_CATEGORIES, departmentSuggestions: DEPARTMENT_SUGGESTIONS });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("POSITION"), id: z.string().uuid().optional(), title: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(120), rank: z.number().int().min(0).max(999), departmentId: z.string().uuid().nullable(), parentId: z.string().uuid().nullable(), active: z.boolean().default(true) }),
  z.object({ action: z.literal("APPOINT"), positionId: z.string().uuid(), staffId: z.string().uuid(), kind: z.enum(["SUBSTANTIVE", "ACTING", "DEPUTY"]), effectiveAt: z.coerce.date(), endsAt: z.coerce.date().nullable(), reason: z.string().trim().min(15).max(1000) }),
  z.object({ action: z.literal("END_APPOINTMENT"), id: z.string().uuid(), reason: z.string().trim().min(15).max(1000) }),
]);
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });
  const body = await parseBody(req, schema);
  const facilityId = access.facility.id;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${facilityId}))::text`;
    if (body.action === "POSITION") {
      await validateOrganizationLinks(tx, facilityId, { departmentId: body.departmentId });
      if (body.parentId && !await tx.organizationPosition.findFirst({ where: { id: body.parentId, facilityId } })) throw notFound("Parent position not found");
      if (body.id && !await tx.organizationPosition.findFirst({ where: { id: body.id, facilityId } })) throw notFound("Position not found");
      const rows = await tx.organizationPosition.findMany({ where: { facilityId }, select: { id: true, parentId: true } });
      assertAcyclic(body.id ?? "new", body.parentId, rows);
      const { action: _, id, ...data } = body;
      void _;
      const position = id ? await tx.organizationPosition.update({ where: { id }, data }) : await tx.organizationPosition.create({ data: { ...data, facilityId } });
      await controlAudit(tx, user.id, facilityId, "ORGANIZATION_POSITION_SAVED", position.id, { title: data.title, rank: data.rank });
      return position;
    }
    if (body.action === "END_APPOINTMENT") {
      const row = await tx.staffAppointment.findFirst({ where: { id: body.id, facilityId } });
      if (!row) throw notFound("Appointment not found");
      const endsAt = new Date();
      if (row.effectiveAt > endsAt) throw badRequest("Future appointments must be ended at or after their effective date");
      await tx.staffAppointment.update({ where: { id: row.id }, data: { endsAt } });
      await controlAudit(tx, user.id, facilityId, "STAFF_APPOINTMENT_ENDED", row.id, { reason: body.reason });
      return { id: row.id };
    }
    if (body.endsAt && body.endsAt <= body.effectiveAt) throw badRequest("Appointment end must follow start");
    const staff = await tx.facilityStaff.findFirst({ where: { id: body.staffId, facilityId, status: "ACTIVE" } });
    const position = await tx.organizationPosition.findFirst({ where: { id: body.positionId, facilityId, active: true } });
    if (!staff || !position) throw notFound("Active staff member or position not found");
    const overlapping = await tx.staffAppointment.findFirst({ where: {
      facilityId, positionId: body.positionId, kind: body.kind,
      ...(body.endsAt ? { effectiveAt: { lt: body.endsAt } } : {}),
      OR: [{ endsAt: null }, { endsAt: { gt: body.effectiveAt } }],
    } });
    if (overlapping) throw conflict("An appointment already occupies this position during that period. End it before appointing a replacement.");
    const { action: _, ...data } = body;
    void _;
    const appointment = await tx.staffAppointment.create({ data: { ...data, facilityId, createdById: user.id } });
    await controlAudit(tx, user.id, facilityId, "STAFF_APPOINTED", appointment.id, { positionId: position.id, staffId: staff.id, reason: body.reason });
    return appointment;
  });
  return NextResponse.json({ result }, { status: 201 });
});
