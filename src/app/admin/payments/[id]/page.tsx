import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/ui";
import { RefundButton } from "@/components/admin/refund-button";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { PAYMENT_METHODS } from "@/lib/payments/config";
import { getPaymentDetail } from "@/lib/admin/payments";
import { formatClinicDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  CREATED: "Payment created", CHECKOUT_STARTED: "Checkout started", SUCCEEDED: "Payment succeeded", FAILED: "Payment failed",
  AMOUNT_MISMATCH: "Gateway amount did not match (rejected)", REFUND_REQUESTED: "Refund requested", REFUND_ACCEPTED: "Refund accepted by gateway",
  REFUND_REQUEST_FAILED: "Refund request failed (will retry)", REFUNDED: "Refund completed", CANCELLED: "Cancelled", EXPIRED: "Expired unpaid",
};

export default async function AdminPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const parsed = z.string().uuid().safeParse((await params).id);
  if (!parsed.success) notFound();
  const p = await getPaymentDetail(parsed.data);
  if (!p) notFound();
  const amount = formatMoney(p.amount, p.currency);

  const rows: [string, React.ReactNode][] = [
    ["Amount", amount],
    ["For", p.description],
    ["Payer", <Link key="a" className="underline" href={`/admin/users/${p.payer.id}`}>{p.payer.name}</Link>],
    ["Payee", <Link key="b" className="underline" href={`/admin/users/${p.payee.id}`}>{p.payee.name}</Link>],
    ["Method", p.method ? PAYMENT_METHODS[p.method].label : "—"],
    ["Gateway", p.provider],
    ["Reference", <code key="c" className="text-xs">{p.providerReference}</code>],
    ["Receipt", p.receiptNumber ?? "—"],
    ["Created", formatClinicDateTime(p.createdAt)],
    ["Paid", p.paidAt ? formatClinicDateTime(p.paidAt) : "—"],
    ["Refunded", p.refundedAt ? formatClinicDateTime(p.refundedAt) : "—"],
  ];

  return (
    <>
      <Link href="/admin/payments" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All payments</Link>
      <PageHeader title={amount} description={p.description} actions={<><PaymentStatusBadge status={p.status} />{p.status === "SUCCESSFUL" && <RefundButton paymentId={p.id} amountLabel={amount} />}</>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b border-border pb-2 last:border-0"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
              ))}
              {p.failureReason && <p className="text-destructive">{p.failureReason}</p>}
            </dl>
          </CardContent>
        </Card>
        <Card className="beeline-card">
          <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {p.events.map((e) => (
              <div key={e.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="font-medium">{EVENT_LABEL[e.type] ?? e.type}</p>
                <p className="text-xs text-muted-foreground">{formatClinicDateTime(e.createdAt)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
