import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { getPaymentProvider } from "@/lib/payments/provider";
import { findPaymentByReference } from "@/lib/payments/service";
import { MockCheckout } from "@/components/shared/mock-checkout";
import { formatMoney } from "@/lib/money";

// Development-only stand-in for the gateway's hosted checkout page.
export default async function MockCheckoutPage({ searchParams }: { searchParams: Promise<{ reference?: string }> }) {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST");
  let isMock = false;
  try {
    isMock = getPaymentProvider().name === "MOCK";
  } catch {
    /* not configured */
  }
  if (!isMock || process.env.NODE_ENV === "production") notFound();

  const { reference } = await searchParams;
  const payment = reference ? await findPaymentByReference(reference) : null;
  if (!payment || payment.payerId !== user.id) notFound();

  return <MockCheckout reference={payment.providerReference} paymentId={payment.id} total={formatMoney(payment.amount.toString(), payment.currency)} />;
}
