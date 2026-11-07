import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission, getAdminAccess } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { isValidPermissionKey } from "@/lib/superadmin/permissions";
import { badRequest, notFound, conflict, forbidden } from "@/lib/errors";

/**
 * Role & Permission Builder API. Roles carry only administrative permission
 * keys — they never confer clinical privileges (no prescribing, result
 * approval or clinical signing). Privileged role assignments additionally
 * require an approved ASSIGN_PRIVILEGED_ROLE approval request unless the
 * actor is the Super Admin.
 */

/** Roles that can restructure power themselves are privileged. */
const PRIVILEGED_KEYS = [":MANAGE", "SETTINGS:CONFIGURE", "APPROVALS:APPROVE", "APPROVALS:REJECT"] as const;
function isPrivilegedRole(permissions: string[]) {
  return permissions.some((p) => PRIVILEGED_KEYS.some((suffix) => p.endsWith(suffix)));
}

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "ROLES", "VIEW");
  const [roles, assignments, overrides] = await Promise.all([
    prisma.adminRole.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true, key: true, name: true, description: true, departmentId: true, system: true, active: true, createdAt: true,
        department: { select: { name: true } },
        permissions: { select: { permissionKey: true } },
        _count: { select: { assignments: { where: { revokedAt: null } } } },
      },
    }),
    prisma.adminRoleAssignment.findMany({
      orderBy: { createdAt: "desc" }, take: 500,
      where: { revokedAt: null },
      select: { id: true, reason: true, expiresAt: true, createdAt: true, user: { select: { id: true, name: true, email: true } }, role: { select: { id: true, key: true, name: true } }, assignedBy: { select: { name: true } } },
    }),
    prisma.adminPermissionOverride.findMany({
      orderBy: { createdAt: "desc" }, take: 200,
      select: { id: true, permissionKey: true, effect: true, reason: true, expiresAt: true, createdAt: true, user: { select: { name: true, email: true } }, createdBy: { select: { name: true } } },
    }),
  ]);
  return NextResponse.json({ roles: roles.map((r) => ({ ...r, permissions: r.permissions.map((p) => p.permissionKey) })), assignments, overrides });
});

const keyList = z.array(z.string().trim().regex(/^[A-Z_]+:[A-Z_]+$/, "Permission keys look like SECTION:VERB")).max(600);

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_ROLE"), key: z.string().trim().regex(/^[A-Z][A-Z0-9_]{1,60}$/), name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).default(""), departmentId: z.string().uuid().nullable().optional(), permissions: keyList }),
  z.object({ action: z.literal("UPDATE_ROLE"), id: z.string().uuid(), name: z.string().trim().min(2).max(120).optional(), description: z.string().trim().max(1000).optional(), departmentId: z.string().uuid().nullable().optional(), permissions: keyList.optional(), active: z.boolean().optional() }),
  z.object({ action: z.literal("DELETE_ROLE"), id: z.string().uuid() }),
  z.object({ action: z.literal("ASSIGN_ROLE"), userId: z.string().uuid(), roleId: z.string().uuid(), reason: z.string().trim().min(15).max(2000), expiresAt: z.coerce.date().nullable().optional(), approvedRequestId: z.string().uuid().optional() }),
  z.object({ action: z.literal("REVOKE_ROLE"), assignmentId: z.string().uuid(), reason: z.string().trim().min(15).max(2000) }),
  z.object({ action: z.literal("CREATE_OVERRIDE"), userId: z.string().uuid(), permissionKey: z.string().trim(), effect: z.enum(["GRANT", "DENY"]), reason: z.string().trim().min(15).max(2000), expiresAt: z.coerce.date().nullable().optional() }),
  z.object({ action: z.literal("DELETE_OVERRIDE"), id: z.string().uuid(), reason: z.string().trim().min(15).max(2000) }),
]);

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  const verb = body.action.startsWith("CREATE") ? "CREATE" : body.action.startsWith("DELETE") ? "DELETE" : body.action === "ASSIGN_ROLE" ? "ASSIGN" : body.action === "REVOKE_ROLE" ? "MANAGE" : "EDIT";
  await requireAdminPermission(user, "ROLES", verb);
  const requestedPermissions = "permissions" in body ? body.permissions : undefined;
  if (requestedPermissions && !requestedPermissions.every(isValidPermissionKey)) throw badRequest("Unknown permission key. Permission keys look like SECTION:VERB from the platform catalog.");
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "CREATE_ROLE": {
        if (await tx.adminRole.findUnique({ where: { key: body.key } })) throw conflict("A role with this key already exists");
        const role = await tx.adminRole.create({ data: { key: body.key, name: body.name, description: body.description, departmentId: body.departmentId ?? null } });
        if (body.permissions.length) {
          await tx.adminRolePermission.createMany({ data: [...new Set(body.permissions)].map((permissionKey) => ({ roleId: role.id, permissionKey })) });
        }
        await controlAudit(tx, user.id, null, "ADMIN_ROLE_CREATED", role.id, { key: role.key, name: role.name, permissions: body.permissions });
        return role;
      }
      case "UPDATE_ROLE": {
        const before = await tx.adminRole.findUnique({ where: { id: body.id }, include: { permissions: true } });
        if (!before) throw notFound("Role not found");
        if (before.system && body.active === false && before.key === "SUPER_ADMIN") throw badRequest("The Super Admin role cannot be deactivated");
        const role = await tx.adminRole.update({ where: { id: body.id }, data: { name: body.name, description: body.description, departmentId: body.departmentId, active: body.active } });
        if (body.permissions) {
          const next = new Set(body.permissions);
          const beforeKeys = new Set(before.permissions.map((p) => p.permissionKey));
          await tx.adminRolePermission.deleteMany({ where: { roleId: role.id, permissionKey: { notIn: [...next] } } });
          await tx.adminRolePermission.createMany({ data: [...next].filter((k) => !beforeKeys.has(k)).map((permissionKey) => ({ roleId: role.id, permissionKey })) });
          await controlAudit(tx, user.id, null, "ADMIN_ROLE_PERMISSIONS_CHANGED", role.id, { before: [...beforeKeys].sort(), after: [...next].sort() });
        }
        await controlAudit(tx, user.id, null, "ADMIN_ROLE_UPDATED", role.id, { before: { name: before.name, active: before.active }, after: { name: role.name, active: role.active } });
        return role;
      }
      case "DELETE_ROLE": {
        const role = await tx.adminRole.findUnique({ where: { id: body.id }, include: { _count: { select: { assignments: { where: { revokedAt: null } } } } } });
        if (!role) throw notFound("Role not found");
        if (role.system) throw badRequest("System roles ship with the platform and cannot be deleted. Deactivate the role instead.");
        if (role._count.assignments > 0) throw conflict("The role still has active assignments. Revoke them first.");
        await tx.adminRole.delete({ where: { id: body.id } });
        await controlAudit(tx, user.id, null, "ADMIN_ROLE_DELETED", body.id, { key: role.key, name: role.name });
        return { deleted: true };
      }
      case "ASSIGN_ROLE": {
        const [target, role] = await Promise.all([
          tx.user.findUnique({ where: { id: body.userId }, select: { id: true, role: true, status: true } }),
          tx.adminRole.findUnique({ where: { id: body.roleId }, include: { permissions: { select: { permissionKey: true } } } }),
        ]);
        if (!target) throw notFound("User not found");
        if (!role || !role.active) throw notFound("Role not found or inactive");
        if (target.status !== "ACTIVE") throw badRequest("The user's account is not active");
        if (await tx.adminRoleAssignment.findFirst({ where: { userId: body.userId, roleId: body.roleId, revokedAt: null } })) throw conflict("This role is already assigned to the user");
        const privileged = isPrivilegedRole(role.permissions.map((p) => p.permissionKey));
        if (privileged) {
          const access = await getAdminAccess(user);
          const approved = body.approvedRequestId
            ? await tx.approvalRequest.findUnique({ where: { id: body.approvedRequestId }, include: { workflow: true } })
            : null;
          const valid = approved && approved.workflow.actionKey === "ASSIGN_PRIVILEGED_ROLE" && approved.status === "APPROVED"
            && (approved.payload as { userId?: string; roleKey?: string })?.userId === body.userId
            && (approved.payload as { roleKey?: string })?.roleKey === role.key;
          if (!access?.superAdmin && !valid) {
            throw forbidden("Assigning a privileged role requires Super Admin action or an approved ASSIGN_PRIVILEGED_ROLE approval request.");
          }
        }
        const assignment = await tx.adminRoleAssignment.create({ data: { userId: body.userId, roleId: body.roleId, reason: body.reason, expiresAt: body.expiresAt ?? null, assignedById: user.id } });
        await controlAudit(tx, user.id, null, "ADMIN_ROLE_ASSIGNED", assignment.id, { userId: body.userId, roleKey: role.key, reason: body.reason, expiresAt: assignment.expiresAt, privileged, approvedRequestId: body.approvedRequestId ?? null });
        return assignment;
      }
      case "REVOKE_ROLE": {
        const assignment = await tx.adminRoleAssignment.findUnique({ where: { id: body.assignmentId }, include: { role: true } });
        if (!assignment) throw notFound("Assignment not found");
        if (assignment.revokedAt) throw conflict("Assignment already revoked");
        await tx.adminRoleAssignment.update({ where: { id: assignment.id }, data: { revokedAt: new Date() } });
        await controlAudit(tx, user.id, null, "ADMIN_ROLE_REVOKED", assignment.id, { userId: assignment.userId, roleKey: assignment.role.key, reason: body.reason });
        return { revoked: true };
      }
      case "CREATE_OVERRIDE": {
        if (!isValidPermissionKey(body.permissionKey)) throw badRequest("Unknown permission key");
        const target = await tx.user.findUnique({ where: { id: body.userId }, select: { id: true } });
        if (!target) throw notFound("User not found");
        const override = await tx.adminPermissionOverride.create({ data: { userId: body.userId, permissionKey: body.permissionKey, effect: body.effect, reason: body.reason, expiresAt: body.expiresAt ?? null, createdById: user.id } });
        await controlAudit(tx, user.id, null, "ADMIN_PERMISSION_OVERRIDE_CREATED", override.id, { userId: body.userId, permissionKey: body.permissionKey, effect: body.effect, expiresAt: override.expiresAt, reason: body.reason });
        return override;
      }
      case "DELETE_OVERRIDE": {
        const override = await tx.adminPermissionOverride.findUnique({ where: { id: body.id } });
        if (!override) throw notFound("Override not found");
        await tx.adminPermissionOverride.delete({ where: { id: body.id } });
        await controlAudit(tx, user.id, null, "ADMIN_PERMISSION_OVERRIDE_REMOVED", body.id, { userId: override.userId, permissionKey: override.permissionKey, effect: override.effect, reason: body.reason });
        return { deleted: true };
      }
    }
  }) }, { status: 201 });
});
