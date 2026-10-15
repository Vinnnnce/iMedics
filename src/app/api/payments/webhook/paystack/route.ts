import { NextResponse, type NextRequest } from "next/server";
import { getPaymentProvider } from "@/lib/payments/provider";
import { handleWebhookEvent } from "@/lib/payments/service";

// POST /api/payments/webhook/paystack — gateway notifications. Public, so authenticity rests on the HMAC signature.
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  let provider;
  try {
    provider = getPaymentProvider();
  } catch {
    return NextResponse.json({ error: "Payments are not configured" }, { status: 503 });
  }

  const { valid, event } = provider.parseWebhook(rawBody, req.headers.get("x-paystack-signature"));
  if (!valid) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  if (event) {
    try {
      await handleWebhookEvent(event);
    } catch (error) {
      console.error("Webhook handling failed:", error);
      // 500 makes the gateway retry later.
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  }
  return NextResponse.json({ received: true });
}
