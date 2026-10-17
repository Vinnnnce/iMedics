import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";

const DAY = 86_400_000;

export interface DailyPoint {
  day: string;
  value: number;
}

/** Counts per calendar day (UTC) for the last `days` days, with zero-filled gaps. */
async function dailySeries(table: "users" | "appointments" | "payments", days: number, where: Prisma.Sql = Prisma.empty): Promise<DailyPoint[]> {
  const column = Prisma.raw(table === "payments" ? "COALESCE(paid_at, created_at)" : "created_at");
  const from = new Date(Date.now() - (days - 1) * DAY);
  from.setUTCHours(0, 0, 0, 0);
  const rows = await prisma.$queryRaw<{ day: Date; n: bigint }[]>(Prisma.sql`
    SELECT date_trunc('day', ${column}) AS day, COUNT(*)::bigint AS n
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE ${column} >= ${from} ${where}
    GROUP BY 1`);
  const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), Number(r.n)]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(from.getTime() + i * DAY).toISOString().slice(0, 10);
    return { day, value: byDay.get(day) ?? 0 };
  });
}

export async function getOverview() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + DAY);
  const last30 = new Date(now.getTime() - 30 * DAY);
  const last7 = new Date(now.getTime() - 7 * DAY);
  const live = { deletedAt: null } as const;

  const [
    totalUsers, patients, doctors, facilities, admins,
    suspended, banned,
    pendingDoctors, pendingFacilities, oldestPending,
    newUsers7, newUsers30,
    appointmentsToday, appointmentsNext7, appointmentsOpen,
    consultations, finalizedConsultations, labResults,
    paymentGroups, volume30, failed7, refundsInProgress, stuckRefunds,
    activeNotices, activeAds,
    registrations, appointmentSeries, paymentSeries,
    recentActivity,
  ] = await Promise.all([
    prisma.user.count({ where: live }),
    prisma.user.count({ where: { ...live, role: "PATIENT" } }),
    prisma.user.count({ where: { ...live, role: "DOCTOR" } }),
    prisma.user.count({ where: { ...live, role: "LAB_SCIENTIST" } }),
    prisma.user.count({ where: { ...live, role: "ADMIN" } }),
    prisma.user.count({ where: { ...live, status: "SUSPENDED" } }),
    prisma.user.count({ where: { ...live, status: "BANNED" } }),
    prisma.doctorProfile.count({ where: { verificationStatus: "PENDING", user: live } }),
    prisma.labStaffProfile.count({ where: { verificationStatus: "PENDING", user: live } }),
    Promise.all([
      prisma.doctorProfile.findFirst({ where: { verificationStatus: "PENDING", user: live }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
      prisma.labStaffProfile.findFirst({ where: { verificationStatus: "PENDING", user: live }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]).then(([a, b]) => [a?.createdAt, b?.createdAt].filter((d): d is Date => Boolean(d)).sort((x, y) => x.getTime() - y.getTime())[0] ?? null),
    prisma.user.count({ where: { ...live, createdAt: { gte: last7 } } }),
    prisma.user.count({ where: { ...live, createdAt: { gte: last30 } } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: startOfToday, lt: endOfToday }, status: { in: ["BOOKED", "CONFIRMED", "IN_PROGRESS", "COMPLETED"] } } }),
    prisma.appointment.count({ where: { scheduledAt: { gte: now, lt: new Date(now.getTime() + 7 * DAY) }, status: { in: ["BOOKED", "CONFIRMED"] } } }),
    prisma.appointment.count({ where: { status: "BOOKED", scheduledAt: { gte: now } } }),
    prisma.consultation.count(),
    prisma.consultation.count({ where: { status: "FINALIZED" } }),
    prisma.labResult.count(),
    prisma.payment.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.payment.groupBy({ by: ["currency"], where: { status: { in: ["SUCCESSFUL", "REFUND_PENDING"] }, paidAt: { gte: last30 } }, _sum: { amount: true }, _count: { _all: true } }),
    prisma.payment.count({ where: { status: "FAILED", createdAt: { gte: last7 } } }),
    prisma.payment.count({ where: { status: "REFUND_PENDING" } }),
    prisma.payment.count({ where: { status: "REFUND_PENDING", updatedAt: { lt: new Date(now.getTime() - DAY) } } }),
    prisma.notice.count({ where: { active: true } }),
    prisma.ad.count({ where: { active: true } }),
    dailySeries("users", 30),
    dailySeries("appointments", 30),
    dailySeries("payments", 30, Prisma.sql`AND status IN ('SUCCESSFUL','REFUND_PENDING','REFUNDED')`),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "ADMIN_" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, resourceType: true, resourceId: true, user: { select: { name: true } } },
    }),
  ]);

  return {
    users: { total: totalUsers, patients, doctors, facilities, admins, suspended, banned, new7: newUsers7, new30: newUsers30 },
    verifications: {
      pending: pendingDoctors + pendingFacilities,
      pendingDoctors,
      pendingFacilities,
      oldestPending,
      oldestPendingDays: oldestPending ? Math.floor((now.getTime() - oldestPending.getTime()) / DAY) : 0,
    },
    appointments: { today: appointmentsToday, next7: appointmentsNext7, awaitingDoctor: appointmentsOpen },
    clinical: { consultations, finalizedConsultations, labResults },
    payments: {
      byStatus: Object.fromEntries(paymentGroups.map((g) => [g.status, g._count._all])) as Record<string, number>,
      volume30: volume30.map((v) => ({ currency: v.currency, amount: Number(v._sum.amount ?? 0), count: v._count._all })),
      failed7,
      refundsInProgress,
      stuckRefunds,
    },
    content: { activeNotices, activeAds },
    series: { registrations, appointments: appointmentSeries, payments: paymentSeries },
    recentActivity,
  };
}
export type Overview = Awaited<ReturnType<typeof getOverview>>;

/** Sidebar badge: how many applications are waiting. Cheap enough for every admin page. */
export async function countPendingVerifications(): Promise<number> {
  const [d, f] = await Promise.all([
    prisma.doctorProfile.count({ where: { verificationStatus: "PENDING", user: { deletedAt: null } } }),
    prisma.labStaffProfile.count({ where: { verificationStatus: "PENDING", user: { deletedAt: null } } }),
  ]);
  return d + f;
}
