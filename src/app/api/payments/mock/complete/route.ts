import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { toMinorUnits } from "@/lib/money";
import { getPaymentProvider } from "@/lib/payments/provider";
import { applyProviderOutcome, findPaymentByReference } from "@/lib/payments/service";

const schema = z.object({ reference: z.string().min(1).max(100), outcome: z.enum(["success", "failed"]) });

// POST /api/payments/mock/complete — development only: stands in for the gateway's "pay" / "fail" buttons.
export const POST = withAuth(null, async (req, { user }) => {
  let isMock = false;
  try {
    isMock = getPaymentProvider().name === "MOCK";
  } catch {
    /* not configured */
  }
  if (!isMock || process.env.NODE_ENV === "production") throw notFound();

  const { reference, outcome } = await parseBody(req, schema);
  const payment = await findPaymentByReference(reference);
  if (!payment || payment.payerId !== user.id) throw notFound("Payment not found");

  await applyProviderOutcome(
    payment.providerReference,
    outcome === "success"
      ? { status: "success", amountMinor: toMinorUnits(payment.amount.toString()), currency: payment.currency, channel: "card" }
      : { status: "failed", reason: "Declined in the test checkout" },
  );
  const updated = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id }, select: { id: true, status: true } });
  return NextResponse.json(updated);
});
