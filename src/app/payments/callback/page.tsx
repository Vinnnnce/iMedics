import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/guards";
import { findPaymentByReference, verifyOpenPayment } from "@/lib/payments/service";

// The payment gateway sends the patient back here. We confirm the result with the gateway ourselves, so the
// page is correct even if the webhook has not arrived yet, and never trusts anything in the URL.
export default async function PaymentCallbackPage({ searchParams }: { searchParams: Promise<{ reference?: string; trxref?: string }> }) {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST");
  const { reference, trxref } = await searchParams;
  const ref = reference || trxref;
  if (!ref) redirect("/payments");

  const payment = await findPaymentByReference(ref);
  if (!payment || payment.payerId !== user.id) redirect("/payments");

  try {
    await verifyOpenPayment(payment);
  } catch (error) {
    console.error("Payment verification failed:", error);
  }
  redirect(`/payments/${payment.id}`);
}
