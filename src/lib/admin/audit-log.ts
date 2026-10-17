import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { optional, pageSchema } from "./params";
import { ACTION_GROUPS, ACTION_GROUP_KEYS } from "./audit-labels";

export const AUDIT_PAGE_SIZE = 40;

export const auditFilterSchema = z.object({
  q: optional(z.string().trim().max(100)),
  group: optional(z.enum(ACTION_GROUP_KEYS)),
  role: optional(z.enum(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"])),
  from: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  page: pageSchema,
});
export type AuditFilters = z.infer<typeof auditFilterSchema>;

function buildWhere(f: AuditFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.q) and.push({ OR: [{ action: { contains: f.q.replace(/\s+/g, "_"), mode: "insensitive" } }, { user: { name: { contains: f.q, mode: "insensitive" } } }, ...(/^[0-9a-f-]{36}$/i.test(f.q) ? [{ resourceId: f.q }, { userId: f.q }] : [])] });
  if (f.group) and.push({ OR: ACTION_GROUPS[f.group].prefixes.map((p) => ({ action: { startsWith: p } })) });
  if (f.role) and.push({ actorRole: f.role });
  if (f.from) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00.000Z`) } });
  if (f.to) and.push({ createdAt: { lt: new Date(new Date(`${f.to}T00:00:00.000Z`).getTime() + 86_400_000) } });
  return and.length ? { AND: and } : {};
}

export async function listAudit(filters: AuditFilters, options: { all?: boolean } = {}) {
  const where = buildWhere(filters);
  const paging: { skip?: number; take: number } = options.all ? { take: 5000 } : { skip: (filters.page - 1) * AUDIT_PAGE_SIZE, take: AUDIT_PAGE_SIZE };
  const [total, rows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: "desc" }, ...paging,
      select: { id: true, action: true, createdAt: true, actorRole: true, resourceType: true, resourceId: true, ipAddress: true, details: true, user: { select: { id: true, name: true } } },
    }),
  ]);
  return { total, pageCount: Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE)), rows };
}
