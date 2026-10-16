import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";

// GET /api/admin/refunds — the refund queue: pending requests first, then recent decisions.
export const GET = withAuth(["ADMIN"], async (req) => {
  const status = new URL(req.url).searchParams.get("status");
  const refunds = await prisma.refund.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" | "PROCESSING" | "PROCESSED" | "FAILED" } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      status: true,
      reason: true,
      amount: true,
      currency: true,
      autoApproved: true,
      createdAt: true,
      decidedAt: true,
      processedAt: true,
      failureReason: true,
      requestedBy: { select: { name: true, email: true } },
      payment: { select: { id: true, kind: true, description: true, payer: { select: { name: true } } } },
    },
  });
  return NextResponse.json({
    refunds: refunds.map((refund) => ({
      ...refund,
      amount: Number(refund.amount),
      requestedBy: refund.requestedBy.name,
      requestedByEmail: refund.requestedBy.email,
      payment: { ...refund.payment, payerName: refund.payment.payer.name },
    })),
  });
});
