import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { verifyOpenPayment } from "@/lib/payments/service";

// POST /api/payments/[id]/verify — re-check an open payment with the gateway (used when the webhook is slow).
export const POST = withAuth<{ id: string }>(null, async (_req, { user, params }) => {
  const id = parseId((await params).id);
  const payment = await prisma.payment.findFirst({ where: { id, payerId: user.id } });
  if (!payment) throw notFound("Payment not found");
  const updated = await verifyOpenPayment(payment);
  return NextResponse.json({ status: updated.status });
});
