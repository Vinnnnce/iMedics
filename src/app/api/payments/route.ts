import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { paymentSelect, serializePayment } from "@/lib/payments/shape";

const querySchema = z.object({
  status: z.enum(["PENDING", "SUCCESSFUL", "FAILED", "REFUND_PENDING", "REFUNDED", "CANCELLED"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/payments — payments the caller made or received, newest first.
export const GET = withAuth(null, async (req, { user }) => {
  const { status, limit } = parseQuery(req, querySchema);
  const payments = await prisma.payment.findMany({
    where: { OR: [{ payerId: user.id }, { payeeId: user.id }], ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: paymentSelect,
  });
  return NextResponse.json({ payments: payments.map((p) => serializePayment(p, user.id)) });
});
