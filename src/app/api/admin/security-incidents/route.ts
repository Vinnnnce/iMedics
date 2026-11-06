import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireAdminPermission } from "@/lib/superadmin/access";
import { controlAudit } from "@/lib/organization/security";
import { notFound, conflict } from "@/lib/errors";

/**
 * Security Centre API: incident records, privileged-grant oversight and
 * suspicious-activity tracking. Reports are honest — nothing is fabricated.
 */

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireAdminPermission(user, "SECURITY", "VIEW");
  const [incidents, grants, failedLoginsWindow] = await Promise.all([
    prisma.securityIncident.findMany({
      orderBy: { createdAt: "desc" }, take: 300,
      select: {
        id: true, kind: true, severity: true, title: true, description: true, status: true,
        createdAt: true, updatedAt: true, resolvedAt: true, resolution: true,
        reportedBy: { select: { name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    }),
    prisma.superAdminGrant.findMany({
      orderBy: { createdAt: "desc" },
      select: { userId: true, grantedBy: true, reason: true, createdAt: true, expiresAt: true, revokedAt: true, user: { select: { name: true, email: true } } },
    }),
    prisma.controlAuditEvent.count({ where: { occurredAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  return NextResponse.json({ incidents, grants, auditEvents7d: failedLoginsWindow });
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_INCIDENT"), kind: z.enum(["SUSPICIOUS_LOGIN", "PRIVILEGE_MISUSE", "DATA_EXPORT", "BREACH_INVESTIGATION", "POLICY_VIOLATION", "OTHER"]), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), title: z.string().trim().min(5).max(160), description: z.string().trim().min(15).max(4000), assignedToId: z.string().uuid().nullable().optional() }),
  z.object({ action: z.literal("UPDATE_INCIDENT"), id: z.string().uuid(), status: z.enum(["OPEN", "INVESTIGATING", "CONTAINED", "RESOLVED"]).optional(), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(), assignedToId: z.string().uuid().nullable().optional(), resolution: z.string().trim().max(4000).optional() }),
]);

export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  const body = await parseBody(req, schema);
  await requireAdminPermission(user, "SECURITY", body.action === "CREATE_INCIDENT" ? "CREATE" : "EDIT");
  return NextResponse.json({ result: await prisma.$transaction(async (tx) => {
    switch (body.action) {
      case "CREATE_INCIDENT": {
        const i = await tx.securityIncident.create({ data: { kind: body.kind, severity: body.severity, title: body.title, description: body.description, reportedById: user.id, assignedToId: body.assignedToId ?? null } });
        await controlAudit(tx, user.id, null, "SECURITY_INCIDENT_OPENED", i.id, { kind: i.kind, severity: i.severity, title: i.title });
        return i;
      }
      case "UPDATE_INCIDENT": {
        const before = await tx.securityIncident.findUnique({ where: { id: body.id } });
        if (!before) throw notFound("Incident not found");
        if (before.status === "RESOLVED") throw conflict("Resolved incidents are closed. Open a follow-up incident if needed.");
        if (body.status === "RESOLVED" && !(body.resolution ?? before.resolution)) throw conflict("A resolution summary is required before resolving an incident");
        const i = await tx.securityIncident.update({
          where: { id: body.id },
          data: { status: body.status, severity: body.severity, assignedToId: body.assignedToId, resolution: body.resolution, resolvedAt: body.status === "RESOLVED" ? new Date() : null },
        });
        await controlAudit(tx, user.id, null, "SECURITY_INCIDENT_UPDATED", i.id, { before: { status: before.status, severity: before.severity }, after: { status: i.status, severity: i.severity } });
        return i;
      }
    }
  }) }, { status: 201 });
});
