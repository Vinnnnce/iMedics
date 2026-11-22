import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { OrderDetail } from "@/components/investigations/order-detail";
import { requirePageRole } from "@/lib/guards";

interface Props { params: Promise<{ id: string }> }

export default async function InvestigationOrderPage({ params }: Props) {
  await requirePageRole("DOCTOR");
  const { id } = await params;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link href="/doctor/lab-requests" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" aria-hidden />Results &amp; Reports</Link>
      <OrderDetail orderId={id} />
    </div>
  );
}
