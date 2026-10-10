import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

// GET /api/admin/stats — platform metrics (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday);
  endOfToday.setDate(endOfToday.getDate() + 1);

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    bannedUsers,
    pendingUsers,
    doctors,
    patients,
    labStaff,
    totalConsultations,
    finalizedConsultations,
    appointmentsToday,
    labResults,
    activeNotices,
    activeAds,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
    prisma.user.count({ where: { deletedAt: null, status: "SUSPENDED" } }),
    prisma.user.count({ where: { deletedAt: null, status: "BANNED" } }),
    prisma.user.count({ where: { deletedAt: null, status: "PENDING" } }),
    prisma.user.count({ where: { deletedAt: null, role: "DOCTOR" } }),
    prisma.user.count({ where: { deletedAt: null, role: "PATIENT" } }),
    prisma.user.count({ where: { deletedAt: null, role: "LAB_SCIENTIST" } }),
    prisma.consultation.count(),
    prisma.consultation.count({ where: { status: "FINALIZED" } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: startOfToday, lt: endOfToday } } }),
    prisma.labResult.count(),
    prisma.notice.count({ where: { active: true } }),
    prisma.ad.count({ where: { active: true } }),
  ]);

  return NextResponse.json({
    users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers, pending: pendingUsers },
    roles: { doctors, patients, labStaff },
    consultations: { total: totalConsultations, finalized: finalizedConsultations },
    appointmentsToday,
    labResults,
    activeNotices,
    activeAds,
  });
});
