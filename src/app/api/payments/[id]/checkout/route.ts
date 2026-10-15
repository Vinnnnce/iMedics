import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { startCheckout } from "@/lib/payments/service";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ method: z.enum(["CARD", "BANK_TRANSFER", "USSD", "MOBILE_MONEY"]) });

// POST /api/payments/[id]/checkout — the payer picks a payment method and receives the gateway checkout link.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const { method } = await parseBody(req, schema);
  const { checkoutUrl } = await startCheckout(id, { id: user.id, email: user.email }, method);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "PAYMENT_CHECKOUT_STARTED", resourceType: "Payment", resourceId: id, details: { method }, req });
  return NextResponse.json({ checkoutUrl });
});
