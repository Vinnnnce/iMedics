import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { providerEarningsSummary } from "@/lib/reports";
import { PAID_STATUSES } from "@/lib/payments/config";

const querySchema = z.object({
  months: z.coerce.number().int().min(1).max(24).default(6),
});

// GET /api/earnings — a provider's earnings and transaction history. Earnings are the provider's
// share of settled charges (net of Medic1905's commission), with refunds subtracted.
export const GET = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req, { user }) => {
  const { months } = parseQuery(req, querySchema);
  const since = new Date(Date.now() - months * 30 * 86_400_000);

  // History: the most recent charges (bounded, for display).
  const payments = await prisma.payment.findMany({
    where: {
      payeeId: user.id,
      createdAt: { gte: since },
      status: { in: [...PAID_STATUSES, "FAILED", "CANCELLED"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      description: true,
      amount: true,
      commissionAmount: true,
      providerAmount: true,
      currency: true,
      status: true,
      receiptNumber: true,
      paidAt: true,
      refundedAt: true,
      createdAt: true,
      appointmentId: true,
      facilityBookingId: true,
      payer: { select: { name: true } },
    },
  });

  // Headline totals and monthly breakdown aggregate the FULL requested period in SQL (see
  // providerEarningsSummary) — they are never derived from the bounded history query above.
  const summary = await providerEarningsSummary(user.id, since);

  return NextResponse.json({
    ...summary,
    transactions: payments.map((payment) => ({
      id: payment.id,
      kind: payment.kind,
      description: payment.description,
      amount: Number(payment.amount),
      commission: payment.commissionAmount === null ? null : Number(payment.commissionAmount),
      earnings: payment.providerAmount === null ? null : Number(payment.providerAmount),
      currency: payment.currency,
      status: payment.status,
      receiptNumber: payment.receiptNumber,
      paidAt: payment.paidAt,
      refundedAt: payment.refundedAt,
      createdAt: payment.createdAt,
      payerName: payment.payer.name,
    })),
  });
});
