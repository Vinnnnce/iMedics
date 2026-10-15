import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { CheckoutForm } from "@/components/shared/checkout-form";
import { PrintButton } from "@/components/shared/print-button";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { paymentSelect, serializePayment, isPayable } from "@/lib/payments/shape";
import { PAYMENT_METHODS } from "@/lib/payments/config";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";
import { z } from "zod";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST");
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();

  const row = await prisma.payment.findFirst({
    where: { id: parsed.data, OR: [{ payerId: user.id }, { payeeId: user.id }] },
    select: paymentSelect,
  });
  if (!row) notFound();
  const p = serializePayment(row, user.id);
  if (p.direction === "RECEIVED" && ["PENDING", "FAILED", "CANCELLED"].includes(p.status)) notFound();

  const rows: [string, string][] = [
    ["Description", p.description],
    [p.direction === "PAID" ? "Paid to" : "Paid by", p.direction === "PAID" ? p.payeeName : p.payerName],
    ["Amount", formatMoney(p.amount, p.currency)],
    ["Currency", p.currency],
    ["Method", p.method ? PAYMENT_METHODS[p.method].label : "—"],
    ["Created", formatClinicDateTime(p.createdAt)],
  ];
  if (p.paidAt) rows.push(["Paid on", formatClinicDateTime(p.paidAt)]);
  if (p.refundedAt) rows.push(["Refunded on", formatClinicDateTime(p.refundedAt)]);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-4 md:px-0">
      <Card className="beeline-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">{p.receiptNumber ? `Receipt ${p.receiptNumber}` : "Payment"}</CardTitle>
          <PaymentStatusBadge status={p.status} />
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="text-right font-medium">{value}</span>
            </div>
          ))}
          {p.status === "FAILED" && p.failureReason && <p className="text-destructive">{p.failureReason}</p>}
          {p.status === "REFUND_PENDING" && <p className="text-muted-foreground">Your refund is being processed and can take a few days to reach you.</p>}
          {p.receiptNumber && <PrintButton />}
        </CardContent>
      </Card>

      {p.direction === "PAID" && isPayable(p) && (
        <Card className="beeline-card">
          <CardHeader>
            <CardTitle className="text-lg">{p.status === "FAILED" ? "Try again" : "Complete your payment"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {p.expiresAt && (
              <p className="text-xs text-muted-foreground">Your booking is held until {formatClinicDateTime(p.expiresAt)}. After that the slot is released.</p>
            )}
            <CheckoutForm paymentId={p.id} amount={p.amount} currency={p.currency} />
          </CardContent>
        </Card>
      )}
      <Link href="/payments" className="block text-center text-sm text-muted-foreground underline">
        All payments
      </Link>
    </div>
  );
}
