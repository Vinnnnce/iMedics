import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { badRequest, notFound, conflict } from "@/lib/errors";

/**
 * Super Admin team management: departments, teams, memberships, reporting
 * lines, responsibilities, bounded access windows, suspension and transfers.
 * Every mutation is permission-gated (TEAM section) and written to the
 * tamper-evident control audit trail in the same transaction.
 */

const memberSelect = {
  id: true, userId: true, title: true, responsibilities: true, status: true,
  startsAt: true, endsAt: true, createdAt: true,
  user: { select: { id: true, name: true, email: true, role: true, status: true } },
  department: { select: { id: true, name: true } },
  team: { select: { id: true, name: true } },
  reportsTo: { select: { id: true, title: true, user: { select: { name: true, email: true } } } },
  roleAssignments: {
    where: { revokedAt: null },
    select: { id: true, reason: true, expiresAt: true, createdAt: true, role: { select: { id: true, key: true, name: true } } },
  },
} satisfies Prisma.AdminMembershipSelect;

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "TEAM", "VIEW");
  const [departments, teams, memberships, roles] = await Promise.all([
    prisma.adminDepartment.findMany({ orderBy: [{ rank: "asc" }, { name: "asc" }], select: { id: true, name: true, description: true, parentId: true, rank: true, active: true, _count: { select: { memberships: true, teams: true } } } }),
    prisma.adminTeam.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, description: true, departmentId: true, active: true, leaderMembershipId: true, _count: { select: { memberships: true } } } }),
    prisma.adminMembership.findMany({ orderBy: { createdAt: "desc" }, take: 500, select: memberSelect }).then((ms) => ms.map((m) => ({ ...m, accessExpired: m.endsAt ? m.endsAt <= new Date() : false }))),
    prisma.adminRole.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, key: true, name: true } }),
  ]);
  return NextResponse.json({ departments, teams, memberships, roles });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_DEPARTMENT"), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).default(""), parentId: z.string().uuid().nullable().optional(), rank: z.number().int().min(0).max(1000).default(0) }),
  z.object({ action: z.literal("UPDATE_DEPARTMENT"), id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(500).optional(), parentId: z.string().uuid().nullable().optional(), rank: z.number().int().min(0).max(1000).optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("CREATE_TEAM"), name: z.string().trim().min(2).max(120), description: z.string().trim().max(500).default(""), departmentId: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal("UPDATE_TEAM"), id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(500).optional(), departmentId: z.string().uuid().nullable().optional(), leaderMembershipId: z.string().uuid().nullable().optional(), active: z.boolean().optional() }),
  z.object({
    action: z.literal("ADD_MEMBER"), email: z.string().trim().toLowerCase().email(),
    title: z.string().trim().min(2).max(120), responsibilities: z.string().trim().max(2000).default(""),
    departmentId: z.string().uuid().nullable().optional(), teamId: z.string().uuid().nullable().optional(),
    reportsToId: z.string().uuid().nullable().optional(), endsAt: z.coerce.date().nullable().optional(),
  }),
  z.object({
    action: z.literal("UPDATE_MEMBER"), id: z.string().uuid(),
    title: z.string().trim().min(2).max(120).optional(), responsibilities: z.string().trim().max(2000).optional(),
    departmentId: z.string().uuid().nullable().optional(), teamId: z.string().uuid().nullable().optional(),
    reportsToId: z.string().uuid().nullable().optional(), endsAt: z.coerce.date().nullable().optional(),
  }),
  z.object({ action: z.literal("SET_MEMBER_STATUS"), id: z.string().uuid(), status: z.enum(["ACTIVE", "SUSPENDED", "ENDED"]), reason: z.string().trim().min(15).max(2000) }),
  z.object({ action: z.literal("TRANSFER"), fromMembershipId: z.string().uuid(), toMembershipId: z.string().uuid(), note: z.string().trim().min(15).max(2000) }),
]);

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  const verb = body.action === "ADD_MEMBER" || body.action.startsWith("CREATE") ? "CREATE"
    : body.action === "TRANSFER" || body.action === "SET_MEMBER_STATUS" ? "MANAGE" : "EDIT";
  await requireAdminPermission(user, "TEAM", verb);
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "CREATE_DEPARTMENT": {
        if (body.parentId && !(await tx.adminDepartment.findUnique({ where: { id: body.parentId } }))) throw notFound("Parent department not found");
        const d = await tx.adminDepartment.create({ data: { name: body.name, description: body.description, parentId: body.parentId ?? null, rank: body.rank } });
        await controlAudit(tx, user.id, null, "ADMIN_DEPARTMENT_CREATED", d.id, { name: d.name, parentId: d.parentId });
        return d;
      }
      case "UPDATE_DEPARTMENT": {
        const before = await tx.adminDepartment.findUnique({ where: { id: body.id } });
        if (!before) throw notFound("Department not found");
        if (body.parentId === body.id) throw badRequest("A department cannot report to itself");
        const d = await tx.adminDepartment.update({ where: { id: body.id }, data: { name: body.name, description: body.description, parentId: body.parentId, rank: body.rank, active: body.active } });
        await controlAudit(tx, user.id, null, "ADMIN_DEPARTMENT_UPDATED", d.id, { before: { name: before.name, active: before.active }, after: { name: d.name, active: d.active } });
        return d;
      }
      case "CREATE_TEAM": {
        if (body.departmentId && !(await tx.adminDepartment.findUnique({ where: { id: body.departmentId } }))) throw notFound("Department not found");
        const t = await tx.adminTeam.create({ data: { name: body.name, description: body.description, departmentId: body.departmentId ?? null } });
        await controlAudit(tx, user.id, null, "ADMIN_TEAM_CREATED", t.id, { name: t.name, departmentId: t.departmentId });
        return t;
      }
      case "UPDATE_TEAM": {
        const before = await tx.adminTeam.findUnique({ where: { id: body.id } });
        if (!before) throw notFound("Team not found");
        if (body.leaderMembershipId && !(await tx.adminMembership.findUnique({ where: { id: body.leaderMembershipId } }))) throw notFound("Leader membership not found");
        const t = await tx.adminTeam.update({ where: { id: body.id }, data: { name: body.name, description: body.description, departmentId: body.departmentId, leaderMembershipId: body.leaderMembershipId, active: body.active } });
        await controlAudit(tx, user.id, null, "ADMIN_TEAM_UPDATED", t.id, { before: { name: before.name, leaderMembershipId: before.leaderMembershipId }, after: { name: t.name, leaderMembershipId: t.leaderMembershipId } });
        return t;
      }
      case "ADD_MEMBER": {
        const target = await tx.user.findUnique({ where: { email: body.email }, select: { id: true, role: true, status: true } });
        if (!target) throw notFound("No Medic1905 account uses this email. Ask the person to register first, then add them to the team.");
        if (target.role !== "ADMIN") throw badRequest("The user must hold the platform ADMIN role before joining the administrative team.");
        if (target.status !== "ACTIVE") throw badRequest("The user's account is not active.");
        if (body.endsAt && body.endsAt <= new Date()) throw badRequest("Access expiry must be in the future.");
        if (body.reportsToId && !(await tx.adminMembership.findUnique({ where: { id: body.reportsToId } }))) throw notFound("Reporting manager membership not found");
        const existing = await tx.adminMembership.findFirst({ where: { userId: target.id, status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }] } });
        if (existing) throw conflict("This person already has an active administrative membership. Update or end it first.");
        const m = await tx.adminMembership.create({ data: { userId: target.id, title: body.title, responsibilities: body.responsibilities, departmentId: body.departmentId ?? null, teamId: body.teamId ?? null, reportsToId: body.reportsToId ?? null, endsAt: body.endsAt ?? null, createdById: user.id } });
        await controlAudit(tx, user.id, null, "ADMIN_MEMBER_ADDED", m.id, { email: body.email, title: m.title, endsAt: m.endsAt, departmentId: m.departmentId, teamId: m.teamId });
        return m;
      }
      case "UPDATE_MEMBER": {
        const before = await tx.adminMembership.findUnique({ where: { id: body.id } });
        if (!before) throw notFound("Membership not found");
        if (body.reportsToId === body.id) throw badRequest("A member cannot report to themselves");
        if (body.endsAt && body.endsAt <= before.startsAt) throw badRequest("Access expiry must be after the membership start");
        const m = await tx.adminMembership.update({ where: { id: body.id }, data: { title: body.title, responsibilities: body.responsibilities, departmentId: body.departmentId, teamId: body.teamId, reportsToId: body.reportsToId, endsAt: body.endsAt } });
        await controlAudit(tx, user.id, null, "ADMIN_MEMBER_UPDATED", m.id, { before: { title: before.title, reportsToId: before.reportsToId, endsAt: before.endsAt }, after: { title: m.title, reportsToId: m.reportsToId, endsAt: m.endsAt } });
        return m;
      }
      case "SET_MEMBER_STATUS": {
        const m = await tx.adminMembership.findUnique({ where: { id: body.id } });
        if (!m) throw notFound("Membership not found");
        if (m.status === body.status) throw conflict(`Membership is already ${body.status}`);
        const updated = await tx.adminMembership.update({ where: { id: body.id }, data: { status: body.status } });
        if (body.status !== "ACTIVE") {
          await tx.adminRoleAssignment.updateMany({ where: { userId: m.userId, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        await controlAudit(tx, user.id, null, "ADMIN_MEMBER_STATUS_CHANGED", m.id, { before: m.status, after: body.status, reason: body.reason });
        return updated;
      }
      case "TRANSFER": {
        const from = await tx.adminMembership.findUnique({ where: { id: body.fromMembershipId } });
        const to = await tx.adminMembership.findUnique({ where: { id: body.toMembershipId } });
        if (!from || !to) throw notFound("Membership not found");
        if (from.id === to.id) throw badRequest("Cannot transfer responsibilities to the same membership");
        // Move open role assignments and direct reports to the receiving member.
        await tx.adminRoleAssignment.updateMany({ where: { membershipId: from.id, revokedAt: null }, data: { membershipId: to.id } });
        await tx.adminMembership.updateMany({ where: { reportsToId: from.id }, data: { reportsToId: to.id } });
        await controlAudit(tx, user.id, null, "ADMIN_RESPONSIBILITIES_TRANSFERRED", from.id, { fromTitle: from.title, toId: to.id, toTitle: to.title, note: body.note });
        return { transferred: true };
      }
    }
  }) }, { status: 201 });
});
