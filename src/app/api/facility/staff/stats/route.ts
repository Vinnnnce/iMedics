import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";

/**
 * GET /api/facility/staff/stats — workforce dashboard metrics.
 * All values are computed from live facility data (no sample numbers).
 */
export const GET = withAuth(null, async (req, { user }) => {
  const { facility } = await requireFacilityAccess(user, "MANAGE_STAFF", req, { requireVerified: false });

  const [byStatus, byRole, byDepartment, pendingInvites, awaitingVerification, byAccessLevel] =
    await Promise.all([
      prisma.facilityStaff.groupBy({
        by: ["status"],
        where: { facilityId: facility.id },
        _count: { _all: true },
      }),
      prisma.facilityStaff.groupBy({
        by: ["facilityRole"],
        where: { facilityId: facility.id, status: { not: "TERMINATED" } },
        _count: { _all: true },
      }),
      prisma.facilityStaff.groupBy({
        by: ["departmentId"],
        where: { facilityId: facility.id, status: { not: "TERMINATED" } },
        _count: { _all: true },
      }),
      prisma.facilityStaff.count({
        where: { facilityId: facility.id, status: "INVITED" },
      }),
      prisma.facilityStaff.count({
        where: {
          facilityId: facility.id,
          status: "ACTIVE",
          credentials: { some: { verificationStatus: { not: "VERIFIED" } } },
        },
      }),
      prisma.facilityStaff.groupBy({
        by: ["accessLevel"],
        where: { facilityId: facility.id, status: { not: "TERMINATED" } },
        _count: { _all: true },
      }),
    ]);

  const departments = await prisma.facilityDepartment.findMany({
    where: { facilityId: facility.id },
    select: { id: true, name: true },
  });
  const departmentNames = new Map(departments.map((d) => [d.id, d.name]));

  const statusCounts = Object.fromEntries(byStatus.map((r) => [r.status, r._count._all]));
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  // Recent account changes (audit trail, latest 10).
  const recentChanges = await prisma.auditLog.findMany({
    where: {
      facilityId: facility.id,
      action: { in: ["FACILITY_STAFF_INVITED", "FACILITY_STAFF_ACTIVATED", "FACILITY_STAFF_DEACTIVATED", "STAFF_ACCESS_UPDATED", "FACILITY_STAFF_ROLE_UPDATED", "FACILITY_STAFF_TERMINATED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true, action: true, createdAt: true, resourceId: true,
      user: { select: { name: true } },
    },
  });

  return NextResponse.json({
    total,
    active: statusCounts.ACTIVE ?? 0,
    inactive: (statusCounts.SUSPENDED ?? 0) + (statusCounts.ON_LEAVE ?? 0),
    invited: statusCounts.INVITED ?? 0,
    terminated: statusCounts.TERMINATED ?? 0,
    pendingInvites,
    awaitingVerification,
    byRole: byRole.map((r) => ({ role: r.facilityRole, count: r._count._all })),
    byAccessLevel: byAccessLevel.map((r) => ({ accessLevel: r.accessLevel, count: r._count._all })),
    byDepartment: byDepartment.map((r) => ({
      departmentId: r.departmentId,
      department: r.departmentId ? departmentNames.get(r.departmentId) ?? "Unknown" : "Unassigned",
      count: r._count._all,
    })),
    recentChanges,
  });
});
