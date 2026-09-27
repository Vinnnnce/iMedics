import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdminRequest, unauthorized } from "@/lib/admin-guard";

// GET /api/admin/stats — real platform metrics from the database
export async function GET(req: NextRequest) {
  if (!isAdminRequest(req)) return unauthorized();
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      bannedUsers,
      doctors,
      patients,
      labStaff,
      totalConsultations,
      finalizedConsultations,
      todayAppointments,
      labResults,
      activeNotices,
      activeAds,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { status: "active" } }),
      prisma.user.count({ where: { status: "suspended" } }),
      prisma.user.count({ where: { status: "banned" } }),
      prisma.user.count({ where: { role: "DOCTOR" } }),
      prisma.user.count({ where: { role: "PATIENT" } }),
      prisma.user.count({ where: { role: "LAB_SCIENTIST" } }),
      prisma.consultation.count(),
      prisma.consultation.count({ where: { status: "finalized" } }),
      prisma.appointment.count({
        where: {
          createdAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
      prisma.labResult.count(),
      prisma.notice.count({ where: { active: true } }),
      prisma.ad.count({ where: { active: true } }),
    ]);

    return Response.json({
      users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, banned: bannedUsers },
      roles: { doctors, patients, labStaff },
      consultations: { total: totalConsultations, finalized: finalizedConsultations },
      appointmentsToday: todayAppointments,
      labResults,
      activeNotices,
      activeAds,
    });
  } catch (error) {
    console.error("Admin stats error:", error);
    return Response.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
