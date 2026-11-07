/**
 * Deliberate operator-only grant procedure. Not an HTTP endpoint or sign-up flow.
 * Does not promote ordinary users and never logs database credentials.
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
const args = new Map(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i), a.slice(i + 1)]; }));
const id = args.get("--user-id") ?? "";
const actor = args.get("--operator")?.trim() ?? "";
const reason = args.get("--reason")?.trim() ?? "";
const revoke = args.get("--revoke") === "true";
const hours = Number(args.get("--hours") ?? 24);
if (!/^[0-9a-f-]{36}$/i.test(id) || actor.length < 3 || actor.length > 120 || reason.length < 15 || reason.length > 2000 || !Number.isInteger(hours) || hours < 1 || hours > 168 || args.get("--confirmation") !== (revoke ? "REVOKE SUPER ADMIN" : "PROVISION SUPER ADMIN")) {
  throw new Error("Require --user-id=UUID --operator=LABEL --reason=15+characters --hours=1..168 --confirmation='PROVISION SUPER ADMIN' (or --revoke=true --confirmation='REVOKE SUPER ADMIN').");
}
const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) throw new Error("A securely provisioned database connection is required.");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id } });
    if (!user || user.role !== "ADMIN" || user.status !== "ACTIVE" || user.deletedAt) throw new Error("The target must already be an active platform ADMIN.");
    const data = { grantedBy: actor, reason, expiresAt: new Date(Date.now() + hours * 3600000), revokedAt: revoke ? new Date() : null };
    if (revoke) await tx.superAdminGrant.update({ where: { userId: id }, data: { revokedAt: new Date(), reason, grantedBy: actor } });
    else await tx.superAdminGrant.upsert({ where: { userId: id }, create: { userId: id, ...data }, update: data });
    await tx.controlAuditEvent.create({ data: { actorId: id, action: revoke ? "OPERATOR_SUPER_ADMIN_REVOKED" : "OPERATOR_SUPER_ADMIN_GRANTED", resourceId: id, details: { operator: actor, reason, hours, attribution: "Database operator; actorId identifies the affected existing ADMIN, not an authenticated web session." } } });
  });
  console.log(revoke ? "Privileged grant revoked and audited." : "Time-limited privileged grant provisioned and audited. Fresh Clerk MFA is still required.");
} finally { await db.$disconnect(); }
