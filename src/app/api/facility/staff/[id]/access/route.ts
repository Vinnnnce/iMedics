import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { FACILITY_PERMISSIONS, type FacilityPermission } from "@/lib/facility-staff";
import { auth } from "@clerk/nextjs/server";

const STAFF_ACCESS_LEVELS = ["LIMITED", "STANDARD", "EXTENDED", "FULL", "CUSTOM"] as const;

const bodySchema = z.object({
  accessLevel: z.enum(STAFF_ACCESS_LEVELS).optional(),
  customCategory: z.string().trim().max(120).nullish(),
  departmentIds: z.array(z.string().uuid()).max(50).optional(),
  permissionOverrides: z
    .object({
      add: z.array(z.string()).max(50),
      remove: z.array(z.string()).max(50),
    })
    .optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

/** Update a staff member's access configuration (MANAGE_STAFF only). */
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req);
  const staffId = (await ctx.params).id;

  const membership = await prisma.facilityStaff.findFirst({
    where: { id: staffId, facilityId: access.facility.id },
    select: { id: true, facilityRole: true, userId: true },
  });
  if (!membership) throw notFound("Staff member not found");

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message ?? "Invalid request");
  const data = parsed.data;

  // Permission overrides may only reference known permissions.
  if (data.permissionOverrides) {
    for (const p of [...data.permissionOverrides.add, ...data.permissionOverrides.remove]) {
      if (!(FACILITY_PERMISSIONS as readonly string[]).includes(p)) {
        throw badRequest(`Unknown permission: ${p}`);
      }
    }
  }

  // Guard: cannot change the facility owner's access level away from FULL.
  const isOwner = membership.facilityRole === "OWNER";
  if (isOwner && data.accessLevel && data.accessLevel !== "FULL") {
    throw forbidden("The facility owner must keep full facility access");
  }

  const updated = await prisma.facilityStaff.update({
    where: { id: staffId },
    data: {
      ...(data.accessLevel ? { accessLevel: data.accessLevel } : {}),
      ...(data.customCategory !== undefined ? { customCategory: data.customCategory ?? null } : {}),
      ...(data.departmentIds ? { departmentIds: data.departmentIds } : {}),
      ...(data.permissionOverrides ? { permissionOverrides: data.permissionOverrides as object } : {}),
    },
    select: { id: true, accessLevel: true, customCategory: true, departmentIds: true, permissionOverrides: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      facilityId: access.facility.id,
      action: "STAFF_ACCESS_UPDATED",
      resourceType: "FACILITY_STAFF",
      resourceId: staffId,
      details: { changes: JSON.parse(JSON.stringify(data)) },
      outcome: "SUCCESS",
    },
  });

  return NextResponse.json({ staff: updated });
}

/** Read a staff member's access configuration. */
export async function GET(req: NextRequest, ctx: RouteContext) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req);
  const staffId = (await ctx.params).id;

  const membership = await prisma.facilityStaff.findFirst({
    where: { id: staffId, facilityId: access.facility.id },
    select: {
      id: true,
      accessLevel: true,
      customCategory: true,
      departmentIds: true,
      permissionOverrides: true,
      facilityRole: true,
      patientAccessGrants: {
        where: { revokedAt: null },
        select: { id: true, patientId: true, scope: true, expiresAt: true, justification: true },
      },
    },
  });
  if (!membership) throw notFound("Staff member not found");

  return NextResponse.json({ staff: membership });
}

/** Patient access grants for a staff member (list + grant + revoke). */
export async function POST(req: NextRequest, ctx: RouteContext) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const access = await requireFacilityAccess(user, "MANAGE_STAFF", req);
  const staffId = (await ctx.params).id;

  const membership = await prisma.facilityStaff.findFirst({
    where: { id: staffId, facilityId: access.facility.id },
    select: { id: true },
  });
  if (!membership) throw notFound("Staff member not found");

  const body = (await req.json()) as {
    action?: "GRANT" | "REVOKE";
    patientId?: string;
    scope?: "CARE_TEAM" | "DEPARTMENT" | "TEMPORARY";
    justification?: string;
    expiresInHours?: number;
  };

  if (body.action === "GRANT") {
    if (!body.patientId) throw badRequest("patientId is required");
    const patient = await prisma.patient.findFirst({
      where: { id: body.patientId, deletedAt: null },
      select: { id: true },
    });
    if (!patient) throw notFound("Patient not found");
    const scope = body.scope ?? "CARE_TEAM";
    const expiresAt =
      scope === "TEMPORARY" && body.expiresInHours
        ? new Date(Date.now() + body.expiresInHours * 3_600_000)
        : null;
    const grant = await prisma.staffPatientAccess.upsert({
      where: { staffId_patientId: { staffId, patientId: body.patientId } },
      create: {
        facilityId: access.facility.id,
        staffId,
        patientId: body.patientId,
        scope,
        justification: body.justification?.slice(0, 500),
        expiresAt,
        grantedById: user.id,
        revokedAt: null,
        revokedById: null,
      },
      update: {
        scope,
        justification: body.justification?.slice(0, 500),
        expiresAt,
        revokedAt: null,
        revokedById: null,
        grantedById: user.id,
        grantedAt: new Date(),
      },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        facilityId: access.facility.id,
        action: "STAFF_PATIENT_ACCESS_GRANTED",
        resourceType: "PATIENT",
        resourceId: body.patientId,
        details: { staffId, scope, expiresAt: expiresAt?.toISOString() ?? null },
        outcome: "SUCCESS",
      },
    });
    return NextResponse.json({ grant });
  }

  if (body.action === "REVOKE") {
    if (!body.patientId) throw badRequest("patientId is required");
    await prisma.staffPatientAccess.updateMany({
      where: { staffId, patientId: body.patientId, revokedAt: null },
      data: { revokedAt: new Date(), revokedById: user.id },
    });
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        facilityId: access.facility.id,
        action: "STAFF_PATIENT_ACCESS_REVOKED",
        resourceType: "PATIENT",
        resourceId: body.patientId,
        details: { staffId },
        outcome: "SUCCESS",
      },
    });
    return NextResponse.json({ ok: true });
  }

  throw badRequest("action must be GRANT or REVOKE");
}
