import { z } from "zod";
import { clerkClient } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { optional, pageSchema } from "./params";

export const PAGE_SIZE = 25;

export const userFilterSchema = z.object({
  q: optional(z.string().trim().max(100)),
  role: optional(z.enum(["PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"])),
  status: optional(z.enum(["PENDING", "ACTIVE", "SUSPENDED", "BANNED"])),
  type: optional(z.enum(["PATIENT", "DOCTOR", "LABORATORY", "DIAGNOSTIC_CENTRE", "HOSPITAL"])),
  verification: optional(z.enum(["PENDING", "VERIFIED", "REJECTED"])),
  sort: optional(z.enum(["newest", "oldest", "name", "active"])),
  page: pageSchema,
});
export type UserFilters = z.infer<typeof userFilterSchema>;

export function buildUserWhere(f: UserFilters): Prisma.UserWhereInput {
  const and: Prisma.UserWhereInput[] = [{ deletedAt: null }];
  if (f.q) {
    and.push({
      OR: [
        { name: { contains: f.q, mode: "insensitive" } },
        { email: { contains: f.q, mode: "insensitive" } },
        { phone: { contains: f.q } },
      ],
    });
  }
  if (f.role) and.push({ role: f.role });
  if (f.status) and.push({ status: f.status });
  if (f.type) and.push({ accountType: f.type });
  if (f.verification) {
    and.push({ OR: [{ doctorProfile: { verificationStatus: f.verification } }, { labStaffProfile: { verificationStatus: f.verification } }] });
  }
  return { AND: and };
}

const ORDER: Record<NonNullable<UserFilters["sort"]>, Prisma.UserOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  oldest: { createdAt: "asc" },
  name: { name: "asc" },
  active: { lastLoginAt: { sort: "desc", nulls: "last" } },
};

export const userRowSelect = {
  id: true,
  clerkId: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  accountType: true,
  createdAt: true,
  lastLoginAt: true,
  doctorProfile: { select: { verificationStatus: true, specialty: true } },
  labStaffProfile: { select: { verificationStatus: true, laboratoryName: true } },
} satisfies Prisma.UserSelect;

async function syncLastSignIns(rows: Array<{ id: string; clerkId: string; lastLoginAt: Date | null }>) {
  if (rows.length === 0) return new Map<string, Date>();

  const client = await clerkClient();
  const signIns = new Map<string, Date>();
  for (let start = 0; start < rows.length; start += 100) {
    const batch = rows.slice(start, start + 100);
    const { data } = await client.users.getUserList({
      userId: batch.map((row) => row.clerkId),
      limit: batch.length,
    });
    for (const user of data) {
      if (user.lastSignInAt !== null) signIns.set(user.id, new Date(user.lastSignInAt));
    }
  }

  const updates = rows.flatMap((row) => {
    const lastLoginAt = signIns.get(row.clerkId);
    return lastLoginAt && row.lastLoginAt?.getTime() !== lastLoginAt.getTime()
      ? [prisma.user.update({ where: { id: row.id }, data: { lastLoginAt } })]
      : [];
  });
  if (updates.length > 0) await prisma.$transaction(updates);

  return signIns;
}

export async function listUsers(filters: UserFilters, options: { all?: boolean } = {}) {
  const where = buildUserWhere(filters);
  const paging: { skip?: number; take: number } = options.all ? { take: 5000 } : { skip: (filters.page - 1) * PAGE_SIZE, take: PAGE_SIZE };
  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: ORDER[filters.sort ?? "newest"],
      select: userRowSelect,
      ...paging,
    }),
  ]);
  const signIns = await syncLastSignIns(rows);
  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    rows: rows.map(({ clerkId, doctorProfile, labStaffProfile, ...u }) => ({
      ...u,
      lastLoginAt: signIns.get(clerkId) ?? u.lastLoginAt,
      verificationStatus: doctorProfile?.verificationStatus ?? labStaffProfile?.verificationStatus ?? null,
      headline: doctorProfile?.specialty ?? labStaffProfile?.laboratoryName ?? null,
    })),
  };
}

/**
 * Everything an administrator may see about an account. This is deliberately account-level only: administrators
 * do not have access to patients' clinical records, so for patients we show identity, status and activity counts.
 */
export async function getUserDetail(id: string) {
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    select: {
      id: true, name: true, email: true, phone: true, role: true, status: true, accountType: true, language: true,
      onboardingComplete: true, termsAcceptedAt: true, termsVersion: true, lastLoginAt: true, createdAt: true,
      statusReason: true, statusChangedAt: true,
      doctorProfile: {
        select: {
          id: true, specialty: true, subSpecialty: true, affiliation: true, location: true, yearsOfExperience: true,
          verificationStatus: true, verifiedAt: true, acceptingPatients: true, ratingAvg: true, ratingCount: true,
          consultationFee: true, followUpFee: true, currency: true, verifiedBy: { select: { name: true } },
        },
      },
      labStaffProfile: {
        select: {
          id: true, laboratoryName: true, city: true, state: true, verificationStatus: true, verifiedAt: true,
          verifiedBy: { select: { name: true } }, _count: { select: { services: true } },
        },
      },
      patient: { select: { caseNumber: true, createdAt: true } },
    },
  });
  if (!user) return null;

  const [appointmentGroups, paid, received, reviews, documentCount, activity] = await Promise.all([
    prisma.appointment.groupBy({
      by: ["status"],
      _count: { _all: true },
      where: user.doctorProfile ? { doctorId: user.doctorProfile.id } : { patient: { userId: id } },
    }),
    prisma.payment.aggregate({ where: { payerId: id, status: { in: ["SUCCESSFUL", "REFUND_PENDING"] } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.aggregate({ where: { payeeId: id, status: { in: ["SUCCESSFUL", "REFUND_PENDING"] } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.verificationReview.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, select: { id: true, decision: true, reason: true, createdAt: true, reviewer: { select: { name: true } } } }),
    prisma.verificationDocument.count({ where: { userId: id } }),
    prisma.auditLog.findMany({
      where: { OR: [{ userId: id }, { resourceType: "User", resourceId: id }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, action: true, createdAt: true, actorRole: true, ipAddress: true, user: { select: { name: true } }, userId: true },
    }),
  ]);

  return {
    user,
    appointments: Object.fromEntries(appointmentGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
    payments: { paidCount: paid._count._all, paidTotal: Number(paid._sum.amount ?? 0), receivedCount: received._count._all, receivedTotal: Number(received._sum.amount ?? 0) },
    reviews,
    documentCount,
    activity,
  };
}
export type UserDetail = NonNullable<Awaited<ReturnType<typeof getUserDetail>>>;
