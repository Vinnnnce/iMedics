import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { optional, pageSchema } from "./params";

export const APPLICATION_PAGE_SIZE = 20;

export const applicationFilterSchema = z.object({
  status: z.enum(["PENDING", "REJECTED", "VERIFIED", "ALL"]).catch("PENDING"),
  type: optional(z.enum(["DOCTOR", "FACILITY"])),
  q: optional(z.string().trim().max(100)),
  page: pageSchema,
});
export type ApplicationFilters = z.infer<typeof applicationFilterSchema>;

export async function listApplications(f: ApplicationFilters) {
  const statusWhere = f.status === "ALL" ? {} : { verificationStatus: f.status };
  const search: Prisma.UserWhereInput = f.q
    ? { OR: [{ name: { contains: f.q, mode: "insensitive" } }, { email: { contains: f.q, mode: "insensitive" } }, { phone: { contains: f.q } }] }
    : {};
  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...search,
    OR: [
      ...(f.type === "FACILITY" ? [] : [{ doctorProfile: { is: statusWhere } }]),
      ...(f.type === "DOCTOR" ? [] : [{ labStaffProfile: { is: statusWhere } }]),
    ],
  };
  // Waiting applications oldest first (fair queue); decided ones newest first.
  const orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: f.status === "PENDING" ? "asc" : "desc" };

  const [total, users, counts] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy,
      skip: (f.page - 1) * APPLICATION_PAGE_SIZE,
      take: APPLICATION_PAGE_SIZE,
      select: {
        id: true, name: true, email: true, createdAt: true, accountType: true,
        doctorProfile: { select: { verificationStatus: true, specialty: true, updatedAt: true } },
        labStaffProfile: { select: { verificationStatus: true, laboratoryName: true, updatedAt: true } },
        _count: { select: { verificationDocuments: true } },
      },
    }),
    Promise.all([
      prisma.doctorProfile.groupBy({ by: ["verificationStatus"], where: { user: { deletedAt: null } }, _count: { _all: true } }),
      prisma.labStaffProfile.groupBy({ by: ["verificationStatus"], where: { user: { deletedAt: null } }, _count: { _all: true } }),
    ]),
  ]);

  const tabCounts: Record<string, number> = { PENDING: 0, REJECTED: 0, VERIFIED: 0 };
  for (const g of [...counts[0], ...counts[1]]) tabCounts[g.verificationStatus] += g._count._all;

  return {
    total,
    pageCount: Math.max(1, Math.ceil(total / APPLICATION_PAGE_SIZE)),
    tabCounts: { PENDING: tabCounts.PENDING, REJECTED: tabCounts.REJECTED, VERIFIED: tabCounts.VERIFIED, ALL: tabCounts.PENDING + tabCounts.REJECTED + tabCounts.VERIFIED },
    rows: users.map((u) => {
      const profile = u.doctorProfile ?? u.labStaffProfile;
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        type: u.doctorProfile ? ("DOCTOR" as const) : ("FACILITY" as const),
        accountType: u.accountType,
        headline: u.doctorProfile?.specialty ?? u.labStaffProfile?.laboratoryName ?? null,
        status: profile?.verificationStatus ?? "PENDING",
        submittedAt: u.createdAt,
        documents: u._count.verificationDocuments,
      };
    }),
  };
}
