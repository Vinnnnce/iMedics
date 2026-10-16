import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { assertPaymentsAvailable, startCheckout } from "@/lib/payments/service";
import { prepareSubscriptionPurchase } from "@/lib/subscriptions";
import { writeAudit } from "@/lib/audit";

const purchaseSchema = z.object({
  planCode: z.string().min(1),
  method: z.enum(["CARD", "BANK_TRANSFER", "USSD", "MOBILE_MONEY"]),
});

// POST /api/subscriptions/me/purchase — pick a plan and get a gateway checkout link for the charge.
// The plan only activates when the verified webhook records the successful payment.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  assertPaymentsAvailable();
  const { planCode, method } = await parseBody(req, purchaseSchema);

  const { paymentId } = await prepareSubscriptionPurchase(user.id, planCode);
  const { checkoutUrl } = await startCheckout(paymentId, { id: user.id, email: user.email }, method);
  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "SUBSCRIPTION_PURCHASE_STARTED",
    resourceType: "Payment",
    resourceId: paymentId,
    details: { planCode, method },
    req,
  });
  return NextResponse.json({ checkoutUrl });
});
