import type { Role, UserStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { badRequest, conflict, notFound } from "../errors";
import { queueNotification } from "../notifications/service";
import { writeAudit } from "../audit";

type Admin = { id: string; role: "ADMIN" };

/** At least one active administrator must always remain, or nobody could manage the platform. */
async function otherActiveAdmins(excludingId: string): Promise<number> {
  return prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { not: excludingId } } });
}

/**
 * Suspend, ban or restore an account. Restricting needs a written reason, which is kept on the account, in the
 * audit log, and sent to the user. Applications still awaiting review are handled in Verifications instead.
 */
export async function changeAccountStatus(admin: Admin, targetId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", reason: string | undefined, req?: Request) {
  if (targetId === admin.id) throw badRequest("You cannot change your own account status");
  const target = await prisma.user.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true, role: true, status: true } });
  if (!target) throw notFound("User not found");

  if (target.status === "PENDING") throw conflict("This account is waiting for verification. Review it under Verifications.");
  if (target.status === status) throw conflict(`This account is already ${status.toLowerCase()}`);
  if (status !== "ACTIVE" && (reason?.trim().length ?? 0) < 5) throw badRequest("Give a reason (at least 5 characters)");
  if (target.role === "ADMIN" && status !== "ACTIVE" && (await otherActiveAdmins(target.id)) === 0) {
    throw conflict("This is the last active administrator. Make someone else an administrator first.");
  }

  const restricting = status !== "ACTIVE";
  await prisma.user.update({
    where: { id: targetId },
    data: { status, statusReason: restricting ? reason!.trim() : null, statusChangedAt: new Date() },
  });

  queueNotification(targetId, restricting ? { kind: "ACCOUNT_SUSPENDED" } : { kind: "ACCOUNT_RESTORED" }, { anyStatus: true });
  await writeAudit({
    userId: admin.id, actorRole: "ADMIN", action: "ADMIN_CHANGED_STATUS", resourceType: "User", resourceId: targetId,
    details: { from: target.status, to: status, reason: reason?.trim() ?? null }, req,
  });
  return { status };
}

/** The role someone returns to when administrator access is removed: their verified professional role, else patient. */
async function roleWithoutAdmin(userId: string): Promise<Role> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { doctorProfile: { select: { verificationStatus: true } }, labStaffProfile: { select: { verificationStatus: true } } },
  });
  if (user?.doctorProfile?.verificationStatus === "VERIFIED") return "DOCTOR";
  if (user?.labStaffProfile?.verificationStatus === "VERIFIED") return "LAB_SCIENTIST";
  return "PATIENT";
}

/**
 * Grant or remove administrator access. Professional roles are only ever granted through verification, so this is
 * deliberately the only role change an admin can make by hand.
 */
export async function setAdministrator(admin: Admin, targetId: string, makeAdmin: boolean, req?: Request) {
  if (targetId === admin.id) throw badRequest("You cannot change your own administrator access");
  const target = await prisma.user.findFirst({ where: { id: targetId, deletedAt: null }, select: { id: true, role: true, status: true } });
  if (!target) throw notFound("User not found");

  if (makeAdmin) {
    if (target.role === "ADMIN") throw conflict("This user is already an administrator");
    if (target.status !== "ACTIVE") throw conflict("Only active accounts can become administrators");
    await prisma.user.update({ where: { id: targetId }, data: { role: "ADMIN" } });
  } else {
    if (target.role !== "ADMIN") throw conflict("This user is not an administrator");
    if ((await otherActiveAdmins(target.id)) === 0) throw conflict("This is the last active administrator");
    await prisma.user.update({ where: { id: targetId }, data: { role: await roleWithoutAdmin(targetId) } });
  }

  await writeAudit({
    userId: admin.id, actorRole: "ADMIN", action: "ADMIN_CHANGED_ROLE", resourceType: "User", resourceId: targetId,
    details: { administrator: makeAdmin }, req,
  });
  return { administrator: makeAdmin };
}

export type { UserStatus };
