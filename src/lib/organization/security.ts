import type { Prisma } from "@prisma/client";
import { badRequest, notFound } from "@/lib/errors";

/** Check all foreign identifiers against the selected tenant before any write. */
export async function validateOrganizationLinks(
  db: Prisma.TransactionClient,
  facilityId: string,
  input: { departmentId?: string | null; parentId?: string | null; leadStaffId?: string | null; deputyStaffId?: string | null; reportsToId?: string | null; branchId?: string | null },
) {
  for (const id of [input.departmentId, input.parentId].filter(Boolean) as string[]) {
    if (!await db.facilityDepartment.findFirst({ where: { id, facilityId }, select: { id: true } })) throw notFound("Department not found in this facility");
  }
  for (const id of [input.leadStaffId, input.deputyStaffId, input.reportsToId].filter(Boolean) as string[]) {
    if (!await db.facilityStaff.findFirst({ where: { id, facilityId, status: "ACTIVE" }, select: { id: true } })) throw notFound("Active staff member not found in this facility");
  }
  if (input.branchId && !await db.facilityBranch.findFirst({ where: { id: input.branchId, facilityId }, select: { id: true } })) throw notFound("Branch not found in this facility");
  if (input.leadStaffId && input.leadStaffId === input.deputyStaffId) throw badRequest("Head and deputy must be different staff members");
}

export function assertAcyclic(id: string, parentId: string | null, rows: { id: string; parentId: string | null }[]) {
  const seen = new Set([id]);
  let next = parentId;
  while (next) {
    if (seen.has(next)) throw badRequest("Reporting relationships cannot contain a cycle");
    seen.add(next);
    next = rows.find((r) => r.id === next)?.parentId ?? null;
  }
}

/** Audit failure aborts the same transaction as the protected mutation. */
export async function controlAudit(db: Prisma.TransactionClient, actorId: string, facilityId: string | null, action: string, resourceId: string, details: Prisma.InputJsonValue) {
  await db.controlAuditEvent.create({ data: { actorId, facilityId, action, resourceId, details } });
  await db.auditLog.create({ data: { userId: actorId, facilityId, action, resourceType: "OrganizationControl", resourceId: /^[0-9a-f-]{36}$/i.test(resourceId) ? resourceId : undefined, details } });
}
