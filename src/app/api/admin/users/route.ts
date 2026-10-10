import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import type { AccountType, Role } from "@prisma/client";

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
  })
  .refine((v) => v.status !== undefined || v.role !== undefined, {
    message: "Provide status and/or role",
  });

// PATCH /api/admin/users — change an account's status and/or role (admin only).
// Granting DOCTOR / LAB_SCIENTIST (directly, or by activating a pending professional
// account) is the verification step: it marks the matching profile as VERIFIED.
export const PATCH = withAuth(["ADMIN"], async (req, { user: admin }) => {
  const { id, status, role } = await parseBody(req, updateUserSchema);

  if (id === admin.id) {
    throw badRequest("You cannot change your own role or status");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const target = await tx.user.findUniqueOrThrow({
      where: { id },
      select: { status: true, accountType: true },
    });

    // Activating a pending professional account is the approval step: it grants
    // the role they registered for, and marks their profile as verified.
    const approvedRole =
      !role && status === "ACTIVE" && target.status === "PENDING"
        ? roleForAccountType(target.accountType)
        : null;
    const newRole = role ?? approvedRole ?? undefined;
    const isProfessional = newRole === "DOCTOR" || newRole === "LAB_SCIENTIST";

    const user = await tx.user.update({
      where: { id },
      data: {
        ...(newRole ? { role: newRole } : {}),
        ...(status ? { status } : isProfessional ? { status: "ACTIVE" } : {}),
      },
      select: userSelect,
    });

    const verification = {
      verificationStatus: "VERIFIED" as const,
      verifiedAt: new Date(),
      verifiedById: admin.id,
    };
    if (newRole === "DOCTOR") {
      await tx.doctorProfile.updateMany({ where: { userId: id }, data: verification });
    } else if (newRole === "LAB_SCIENTIST") {
      await tx.labStaffProfile.updateMany({ where: { userId: id }, data: verification });
    }
    return user;
  });

  await writeAudit({
    userId: admin.id,
    actorRole: admin.role,
    action: "ADMIN_UPDATE_USER",
    resourceType: "User",
    resourceId: id,
    details: { status: status ?? null, role: role ?? null },
    req,
  });

  const { doctorProfile, labStaffProfile, ...rest } = updated;
  return NextResponse.json({
    success: true,
    user: {
      ...rest,
      verificationStatus: doctorProfile?.verificationStatus ?? labStaffProfile?.verificationStatus ?? null,
    },
  });
});
