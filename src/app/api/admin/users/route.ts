import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { queueNotification } from "@/lib/notifications/service";
import { provisionSubaccountForUser } from "@/lib/subaccounts";
import { writeAudit } from "@/lib/audit";
import type { AccountType, Role } from "@prisma/client";
import { requireSuperAdmin, confirmSensitive } from "@/lib/platform/access";
import { controlAudit } from "@/lib/organization/security";

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  accountType: true,
  createdAt: true,
  doctorProfile: { select: { verificationStatus: true } },
  labStaffProfile: { select: { verificationStatus: true } },
} as const;

// GET /api/admin/users — list accounts (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const rows = await prisma.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const users = rows.map(({ doctorProfile, labStaffProfile, ...user }) => ({
    ...user,
    verificationStatus: doctorProfile?.verificationStatus ?? labStaffProfile?.verificationStatus ?? null,
  }));
  return NextResponse.json({ users });
});

function roleForAccountType(accountType: AccountType | null): Role | null {
  switch (accountType) {
    case "DOCTOR":
      return "DOCTOR";
    case "LABORATORY":
    case "DIAGNOSTIC_CENTRE":
    case "HOSPITAL":
    case "PHARMACY":
      return "LAB_SCIENTIST";
    default:
      return null;
  }
}

const updateUserSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["PENDING", "ACTIVE", "SUSPENDED", "BANNED"]).optional(),
    role: z.enum(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"]).optional(),
    reason: z.string().trim().min(15).max(2000),
    confirmation: z.string(),
  })
  .refine((v) => v.status !== undefined || v.role !== undefined, {
    message: "Provide status and/or role",
  });

// PATCH /api/admin/users — change an account's status and/or role (admin only).
// Account activation is not professional verification. Use the evidence-review
// workflow before granting professional roles.
export const PATCH = withAuth(["ADMIN"], async (req, { user: admin }) => {
  await requireSuperAdmin(admin);
  const input = await parseBody(req, updateUserSchema);
  confirmSensitive(input, "CONFIRM ACCOUNT CHANGE");
  const { id, status, role, reason } = input;

  if (id === admin.id) {
    throw badRequest("You cannot change your own role or status");
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('medic1905-admin-accounts'))::text`;
    const target = await tx.user.findUniqueOrThrow({
      where: { id, deletedAt: null },
      select: {
        role: true, status: true, accountType: true,
        doctorProfile: { select: { id: true, verificationStatus: true } }, labStaffProfile: { select: { id: true, verificationStatus: true } },
      },
    });

    // An already verified application may be activated; never verify by status change.
    const approvedRole =
      !role && status === "ACTIVE" && target.status === "PENDING"
        ? roleForAccountType(target.accountType)
        : null;
    const newRole = role ?? approvedRole ?? undefined;
    if (newRole === "DOCTOR" && target.doctorProfile?.verificationStatus !== "VERIFIED") throw badRequest("Review medical evidence before granting the doctor role");
    if (newRole === "LAB_SCIENTIST" && target.labStaffProfile?.verificationStatus !== "VERIFIED") throw badRequest("Review facility evidence before granting the provider role");
    if (target.role === "ADMIN" && ((newRole && newRole !== "ADMIN") || (status && status !== "ACTIVE"))) {
      if (!await tx.user.count({ where: { role: "ADMIN", status: "ACTIVE", deletedAt: null, id: { not: id } } })) throw badRequest("The last active administrator cannot be removed");
      await tx.superAdminGrant.updateMany({ where: { userId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    const isProfessional = newRole === "DOCTOR" || newRole === "LAB_SCIENTIST";
    if (newRole === "DOCTOR" && !target.doctorProfile) throw badRequest("A doctor profile is required before granting this role");
    if (newRole === "LAB_SCIENTIST" && !target.labStaffProfile) throw badRequest("A facility profile is required before granting this role");

    const user = await tx.user.update({
      where: { id },
      data: {
        ...(newRole ? { role: newRole } : {}),
        ...(status ? { status } : isProfessional ? { status: "ACTIVE" } : {}),
        ...(status ? { statusReason: status === "ACTIVE" ? null : reason, statusChangedAt: new Date() } : {}),
      },
      select: userSelect,
    });

    // A role/status change must roll back if its audit record cannot be persisted.
    await tx.auditLog.create({ data: {
      userId: admin.id, actorRole: admin.role, action: "ADMIN_UPDATE_USER",
      resourceType: "User", resourceId: id,
      details: { previousRole: target.role, previousStatus: target.status, role: user.role, status: user.status },
    } });
    await controlAudit(tx, admin.id, null, "ADMIN_ACCOUNT_CHANGED", id, { previousRole: target.role, previousStatus: target.status, role: user.role, status: user.status, reason });
    return { user, becameProfessional: isProfessional };
  });

  if (updated.user.status === "ACTIVE") await queueNotification(id, { kind: "ACCOUNT_UPDATED" });

  // Verifying a provider is the trigger for gateway subaccount creation: their earnings can now
  // be settled directly. If their bank details are missing, provisioning retries later.
  if (updated.becameProfessional) {
    try {
      const subaccountStatus = await provisionSubaccountForUser(id);
      await writeAudit({
        userId: admin.id,
        actorRole: admin.role,
        action: "SUBACCOUNT_PROVISIONED",
        resourceType: "ProviderSubaccount",
        resourceId: id,
        details: { status: subaccountStatus },
      });
    } catch (error) {
      console.error(`Subaccount provisioning failed for user ${id}:`, error);
    }
  }

  const { doctorProfile, labStaffProfile, ...rest } = updated.user;
  return NextResponse.json({
    success: true,
    user: {
      ...rest,
      verificationStatus: doctorProfile?.verificationStatus ?? labStaffProfile?.verificationStatus ?? null,
    },
  });
});
