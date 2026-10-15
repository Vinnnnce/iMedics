import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PaymentStatusBadge } from "@/components/shared/payment-status-badge";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";
import { paymentSelect, serializePayment } from "@/lib/payments/shape";
import { formatMoney } from "@/lib/money";
import { formatClinicDateTime } from "@/lib/format";

export default async function PaymentsPage() {
  const user = await requirePageRole("PATIENT", "DOCTOR", "LAB_SCIENTIST");
  const rows = await prisma.payment.findMany({
    where: { OR: [{ payerId: user.id }, { payeeId: user.id }] },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: paymentSelect,
  });
  // Providers only see payments that were actually made; unpaid attempts are the patient's business.
  const payments = rows.map((p) => serializePayment(p, user.id)).filter((p) => p.direction === "PAID" || !["PENDING", "FAILED", "CANCELLED"].includes(p.status));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your receipts and transaction history</p>
      </div>
      {payments.length === 0 && <p className="text-sm text-muted-foreground">No payments yet.</p>}
      {payments.map((p) => (
        <Link key={p.id} href={`/payments/${p.id}`} className="block">
          <Card className="beeline-card transition-colors hover:bg-muted/40">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-foreground/10">
                <Receipt className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.description}</p>
                <p className="text-xs text-muted-foreground">
                  {p.direction === "PAID" ? `To ${p.payeeName}` : `From ${p.payerName}`} · {formatClinicDateTime(p.createdAt)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold">
                  {p.direction === "RECEIVED" ? "+" : ""}
                  {formatMoney(p.amount, p.currency)}
                </span>
                <PaymentStatusBadge status={p.status} />
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
