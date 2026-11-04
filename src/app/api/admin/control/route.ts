import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireSuperAdmin, confirmSensitive } from "@/lib/platform/access";
import { MODULES, policyRulesSchema } from "@/lib/platform/policy";
import { controlAudit } from "@/lib/organization/security";
import { conflict, notFound, forbidden } from "@/lib/errors";

export const GET = withAuth(["ADMIN"], async (_req, { user }) => {
  await requireSuperAdmin(user);
  const now = new Date();
  const [policies, audit, facilityTypes, staff, departments, pendingCredentials, activeSubscriptions, expiredSubscriptions, ai, activeUsers, pendingUsers, grants] = await Promise.all([
    prisma.platformPolicy.findMany({ orderBy: [{ createdAt: "desc" }], take: 500 }),
    prisma.controlAuditEvent.findMany({ orderBy: { sequence: "desc" }, take: 100 }),
    prisma.labStaffProfile.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.facilityStaff.count({ where: { status: "ACTIVE" } }),
    prisma.facilityDepartment.count({ where: { active: true } }),
    prisma.staffCredential.count({ where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION"] } } }),
    prisma.doctorSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now } } }),
    prisma.doctorSubscription.count({ where: { currentPeriodEnd: { lte: now } } }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE", lastActiveAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
    prisma.user.count({ where: { deletedAt: null, status: "PENDING" } }),
    prisma.superAdminGrant.findMany({ select: { userId: true, grantedBy: true, createdAt: true, expiresAt: true, revokedAt: true, user: { select: { name: true, email: true } } } }),
  ]);
  const credentials = await prisma.staffCredential.findMany({
    where: { verificationStatus: { in: ["UNVERIFIED", "PENDING_VERIFICATION"] } }, take: 50, orderBy: { createdAt: "asc" },
    select: { id: true, type: true, number: true, authority: true, expiryDate: true, verificationStatus: true,
      staff: { select: { fullName: true, facility: { select: { laboratoryName: true } } } } },
  });
  return NextResponse.json({ policies, credentials, modules: MODULES, audit: audit.map((e) => ({ ...e, sequence: String(e.sequence) })),
    metrics: { facilityTypes, staff, departments, pendingCredentials, activeSubscriptions, expiredSubscriptions, aiRequests30d: ai, activeUsers30d: activeUsers, pendingUsers },
    security: { mfa: "verified", database: "connected", storage: "External storage telemetry not configured", clinicalAccess: "Not granted by platform administration" }, grants });
});

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("POLICY"), key: z.string().trim().regex(/^[a-zA-Z0-9_.:-]{2,100}$/),
    expectedRevision: z.number().int().min(0), kind: z.enum(["FEATURE", "DOCUMENT"]),
    resource: z.string().trim().min(1).max(120), mode: z.enum(["ENABLED", "DISABLED", "READ_ONLY", "RESTRICTED"]),
    rules: policyRulesSchema, confirmation: z.string(), reason: z.string().trim().min(15).max(2000),
  }),
  z.object({ action: z.literal("VERIFY_CREDENTIAL"), id: z.string().uuid(), decision: z.enum(["VERIFIED", "REJECTED"]), reason: z.string().trim().min(15).max(2000), confirmation: z.string() }),
]);
export const POST = withAuth(["ADMIN"], async (req, { user }) => {
  await requireSuperAdmin(user);
  const body = await parseBody(req, schema);
  confirmSensitive(body, body.action === "POLICY" ? "APPLY POLICY" : "REVIEW CREDENTIAL");
  if (body.action === "POLICY" && body.kind === "FEATURE" && !(MODULES as readonly string[]).includes(body.resource)) throw forbidden("Unknown module");
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('medic1905-platform-control'))::text`;
    if (body.action === "VERIFY_CREDENTIAL") {
      const credential = await tx.staffCredential.findUnique({ where: { id: body.id }, include: { staff: true } });
      if (!credential) throw notFound("Credential not found");
      if (credential.staff.userId === user.id) throw forbidden("Self-verification is not allowed");
      // A global reviewer is not a facility staff member: retain legacy staff verifier field, record global reviewer in audit.
      await tx.staffCredential.update({ where: { id: body.id }, data: { verificationStatus: body.decision, verifiedAt: new Date(), verifiedById: null } });
      await controlAudit(tx, user.id, credential.staff.facilityId, "ADMIN_CREDENTIAL_REVIEWED", body.id, { decision: body.decision, reason: body.reason });
      return { id: body.id };
    }
    const current = await tx.platformPolicy.findFirst({ where: { key: body.key }, orderBy: { revision: "desc" } });
    if ((current?.revision ?? 0) !== body.expectedRevision) throw conflict("Policy changed. Refresh and review the latest revision.");
    if (current && (current.resource !== body.resource || current.kind !== body.kind)) throw conflict("A policy key cannot be reused for a different resource");
    const policy = await tx.platformPolicy.create({ data: { key: body.key, revision: body.expectedRevision + 1, resource: body.resource, kind: body.kind, mode: body.mode, rules: body.rules, reason: body.reason, createdById: user.id } });
    await controlAudit(tx, user.id, null, "ADMIN_PLATFORM_POLICY_CHANGED", policy.id, { key: policy.key, revision: policy.revision, before: current ? { mode: current.mode, rules: current.rules } : {}, after: { mode: policy.mode, rules: policy.rules }, reason: body.reason });
    return policy;
  });
  return NextResponse.json({ result }, { status: 201 });
});
