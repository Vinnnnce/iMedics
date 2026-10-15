import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { paymentSelect, serializePayment } from "@/lib/payments/shape";

// GET /api/payments/[id] — one payment (and its receipt details) the caller is a party to.
export const GET = withAuth<{ id: string }>(null, async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const payment = await prisma.payment.findFirst({
    where: { id, OR: [{ payerId: user.id }, { payeeId: user.id }] },
    select: paymentSelect,
  });
  if (!payment) throw notFound("Payment not found");
  return NextResponse.json({ payment: serializePayment(payment, user.id) });
});
