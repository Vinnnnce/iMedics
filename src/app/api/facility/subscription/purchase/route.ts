import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { prepareFacilityPurchase } from "@/lib/facility-subscriptions";
import { assertPaymentsAvailable, startCheckout } from "@/lib/payments/service";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ planCode: z.string().min(1), method: z.enum(["CARD", "BANK_TRANSFER", "USSD", "MOBILE_MONEY"]) });

// POST /api/facility/subscription/purchase — choose a plan and get a gateway checkout link.
// Owner-level only. The plan applies when the verified payment succeeds, never from the browser redirect.
export const POST = withAuth(null, async (req, { user }) => {
  assertPaymentsAvailable();
  const { facility } = await requireFacilityAccess(user, "MANAGE_PAYOUTS", req);
  const { planCode, method } = await parseBody(req, schema);
  const { paymentId } = await prepareFacilityPurchase(user.id, facility.id, planCode);
  const { checkoutUrl } = await startCheckout(paymentId, { id: user.id, email: user.email }, method);
  await writeAudit({ userId: user.id, actorRole: user.role, action: "FACILITY_SUBSCRIPTION_PURCHASE_STARTED", resourceType: "Payment", resourceId: paymentId, details: { planCode, method, facilityId: facility.id }, req });
  return NextResponse.json({ checkoutUrl });
}, { rateLimit: RATE_LIMITS.payment });
