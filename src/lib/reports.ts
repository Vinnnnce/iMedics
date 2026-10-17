import { prisma } from "./prisma";

/**
 * Platform revenue: Medic1905's commission on provider charges, plus subscription revenue,
 * grouped by month and always per currency (amounts in different currencies are never added
 * together). Refunded charges contribute zero: revenue is what was retained, not what was
 * briefly collected, so no refunded amount is subtracted from (or added to) anything.
 */
export async function platformRevenueByMonth(months = 12) {
  const commission = await prisma.$queryRaw<
    Array<{ month: Date; currency: string; commission: string | null; charges: bigint }>
  >`
    SELECT date_trunc('month', "paid_at") AS month, currency,
           COALESCE(SUM("commission_amount"), 0) AS commission,
           COUNT(*) AS charges
    FROM payments
    WHERE status IN ('SUCCESSFUL', 'REFUND_PENDING') AND kind IN ('CONSULTATION', 'FACILITY_SERVICE')
    GROUP BY 1, 2 ORDER BY 1 DESC`;

  const subscriptions = await prisma.$queryRaw<
    Array<{ month: Date; currency: string; revenue: string | null; charges: bigint }>
  >`
    SELECT date_trunc('month', "paid_at") AS month, currency,
           COALESCE(SUM(amount), 0) AS revenue,
           COUNT(*) AS charges
    FROM payments
    WHERE status IN ('SUCCESSFUL', 'REFUND_PENDING') AND kind = 'SUBSCRIPTION'
    GROUP BY 1, 2 ORDER BY 1 DESC`;

  const refunded = await prisma.$queryRaw<
    Array<{ month: Date; currency: string; refunded: string | null; refunds: bigint }>
  >`
    SELECT date_trunc('month', "refunded_at") AS month, currency,
           COALESCE(SUM(amount), 0) AS refunded,
           COUNT(*) AS refunds
    FROM payments
    WHERE status = 'REFUNDED'
    GROUP BY 1, 2 ORDER BY 1 DESC`;

  const byMonth = new Map<
    string,
    { month: string; currency: string; commission: number; subscriptionRevenue: number; refunded: number }
  >();
  const merge = (
    key: Date | null,
    currency: string | null,
    patch: (entry: { commission: number; subscriptionRevenue: number; refunded: number }) => void,
  ) => {
    if (!key || !currency) return;
    const month = key.toISOString().slice(0, 7);
    const mapKey = `${month}|${currency}`;
    const entry = byMonth.get(mapKey) ?? { month, currency, commission: 0, subscriptionRevenue: 0, refunded: 0 };
    patch(entry);
    byMonth.set(mapKey, entry);
  };
  for (const row of commission) merge(row.month, row.currency, (entry) => { entry.commission += Number(row.commission); });
  for (const row of subscriptions) merge(row.month, row.currency, (entry) => { entry.subscriptionRevenue += Number(row.revenue); });
  for (const row of refunded) merge(row.month, row.currency, (entry) => { entry.refunded += Number(row.refunded); });

  // The window is the latest N months (all currencies within them), not the first N rows.
  const windowMonths = [...new Set([...byMonth.values()].map((row) => row.month))].sort((a, b) => (a < b ? 1 : -1)).slice(0, months);
  return [...byMonth.values()].filter((row) => windowMonths.includes(row.month));
}

/**
 * Provider earnings: each provider's settled share (net of commission) on provider charges only,
 * highest first, per currency. Platform-owned charges (subscriptions are paid to the platform
 * account) are not provider earnings.
 */
export async function providerEarnings(limit = 50) {
  const grouped = await prisma.$queryRaw<
    Array<{ payeeId: string; name: string; currency: string; earnings: string | null; charges: bigint }>
  >`
    SELECT p."payee_id" AS "payeeId", u.name AS name, p.currency,
           COALESCE(SUM(COALESCE(p."provider_amount", p.amount - COALESCE(p."commission_amount", 0), p.amount)), 0) AS earnings,
           COUNT(*) AS charges
    FROM payments p JOIN users u ON u.id = p."payee_id"
    WHERE p.status = 'SUCCESSFUL' AND p.kind IN ('CONSULTATION', 'FACILITY_SERVICE')
    GROUP BY 1, 2, 3
    ORDER BY earnings DESC
    LIMIT ${limit}`;
  return grouped.map((row) => ({
    payeeId: row.payeeId,
    name: row.name,
    currency: row.currency,
    earnings: Number(row.earnings),
    charges: Number(row.charges),
  }));
}

/**
 * A provider's earnings summary: headline totals and a monthly breakdown, aggregated over the
 * FULL period in SQL (never derived from a bounded history list), per currency (never mixed).
 * A refund reverses the provider's share (not the patient's whole charge, which includes the
 * platform's commission that was never the provider's to keep).
 */
export async function providerEarningsSummary(payeeId: string, since: Date) {
  interface EarningsRow {
    currency: string;
    gross: string | number | null;
    commission: string | number | null;
    provider_total: string | number | null;
    refunded: string | number | null;
  }
  const totalsRows = await prisma.$queryRaw<EarningsRow[]>`
    SELECT currency,
      COALESCE(SUM(amount), 0) AS gross,
      COALESCE(SUM(COALESCE(commission_amount, 0)), 0) AS commission,
      COALESCE(SUM(COALESCE(provider_amount, amount - COALESCE(commission_amount, 0), amount)), 0) AS provider_total,
      COALESCE(SUM(CASE WHEN status = 'REFUNDED'
        THEN COALESCE(provider_amount, amount - COALESCE(commission_amount, 0), amount) ELSE 0 END), 0) AS refunded
    FROM payments
    WHERE payee_id = ${payeeId}::uuid AND created_at >= ${since}
      AND status IN ('SUCCESSFUL', 'REFUND_PENDING', 'REFUNDED')
    GROUP BY currency`;
  const monthlyRows = await prisma.$queryRaw<(EarningsRow & { month: string })[]>`
    SELECT to_char(COALESCE(paid_at, created_at), 'YYYY-MM') AS month, currency,
      COALESCE(SUM(amount), 0) AS gross,
      COALESCE(SUM(COALESCE(commission_amount, 0)), 0) AS commission,
      COALESCE(SUM(COALESCE(provider_amount, amount - COALESCE(commission_amount, 0), amount)), 0) AS provider_total,
      COALESCE(SUM(CASE WHEN status = 'REFUNDED'
        THEN COALESCE(provider_amount, amount - COALESCE(commission_amount, 0), amount) ELSE 0 END), 0) AS refunded
    FROM payments
    WHERE payee_id = ${payeeId}::uuid AND created_at >= ${since}
      AND status IN ('SUCCESSFUL', 'REFUND_PENDING', 'REFUNDED')
    GROUP BY 1, 2 ORDER BY 1 DESC, 2`;
  const toSummary = (row: EarningsRow) => ({
    currency: row.currency,
    gross: Number(row.gross ?? 0),
    commission: Number(row.commission ?? 0),
    earnings: Number(row.provider_total ?? 0) - Number(row.refunded ?? 0),
    refunded: Number(row.refunded ?? 0),
  });
  return {
    totals: totalsRows.map(toSummary),
    monthly: monthlyRows.map((row) => ({ month: row.month, ...toSummary(row) })),
  };
}

/** Refund totals: requested, approved, processed and rejected counts and amounts, per currency. */
export async function refundSummary() {
  const [byStatus, processedRefunds] = await Promise.all([
    prisma.$queryRaw<Array<{ status: string; currency: string; amount: string | null; count: bigint }>>`
      SELECT r.status, p.currency, COALESCE(SUM(r.amount), 0) AS amount, COUNT(*) AS count
      FROM refunds r JOIN payments p ON p.id = r."payment_id"
      GROUP BY r.status, p.currency`,
    prisma.payment.groupBy({
      by: ["currency"],
      where: { status: "REFUNDED" },
      _sum: { amount: true },
      _count: { _all: true },
    }),
  ]);
  return {
    byStatus: byStatus.map((row) => ({
      status: row.status,
      currency: row.currency,
      count: Number(row.count),
      amount: Number(row.amount ?? 0),
    })),
    processedRefunds: processedRefunds.map((row) => ({
      currency: row.currency,
      count: row._count._all,
      amount: Number(row._sum.amount ?? 0),
    })),
  };
}

/** Subscription revenue and usage, by plan. */
export async function subscriptionUsageByPlan() {
  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      subscriptions: { where: { status: "ACTIVE" }, select: { consultationsUsed: true, doctorId: true } },
    },
  });
  return plans.map((plan) => {
    const active = plan.subscriptions.length;
    const used = plan.subscriptions.reduce((sum, s) => sum + s.consultationsUsed, 0);
    return {
      id: plan.id,
      code: plan.code,
      name: plan.name,
      monthlyPrice: Number(plan.monthlyPrice),
      currency: plan.currency,
      consultationAllowance: plan.consultationAllowance,
      activeSubscriptions: active,
      monthlyRevenue: Number(plan.monthlyPrice) * active,
      consultationsUsed: used,
      averageUsage: active > 0 ? Math.round((used / active) * 10) / 10 : 0,
    };
  });
}

/** The headline numbers for the admin reports screen, per currency (never mixed). */
export async function reportOverview() {
  const rows = await prisma.$queryRaw<
    Array<{
      currency: string;
      gross: string | null;
      commission: string | null;
      refunded: string | null;
      refundedCount: bigint;
      subsRevenue: string | null;
      subsCount: bigint;
    }>
  >`
    SELECT currency,
      COALESCE(SUM(CASE WHEN status = 'SUCCESSFUL' THEN amount END), 0) AS gross,
      COALESCE(SUM(CASE WHEN status = 'SUCCESSFUL' THEN "commission_amount" END), 0) AS commission,
      COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN amount END), 0) AS refunded,
      COUNT(CASE WHEN status = 'REFUNDED' THEN 1 END) AS "refundedCount",
      COALESCE(SUM(CASE WHEN status = 'SUCCESSFUL' AND kind = 'SUBSCRIPTION' THEN amount END), 0) AS "subsRevenue",
      COUNT(CASE WHEN status = 'SUCCESSFUL' AND kind = 'SUBSCRIPTION' THEN 1 END) AS "subsCount"
    FROM payments
    WHERE status IN ('SUCCESSFUL', 'REFUNDED')
    GROUP BY currency`;

  return rows.map((row) => ({
    currency: row.currency,
    grossVolume: Number(row.gross ?? 0),
    commissionRevenue: Number(row.commission ?? 0),
    refundedTotal: Number(row.refunded ?? 0),
    refundedCount: Number(row.refundedCount),
    subscriptionRevenue: Number(row.subsRevenue ?? 0),
    subscriptionCharges: Number(row.subsCount),
  }));
}
