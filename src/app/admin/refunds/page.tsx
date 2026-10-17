import { RefundQueue } from "@/components/admin/refund-queue";
import { requirePageRole } from "@/lib/guards";

export default async function AdminRefundsPage() {
  await requirePageRole("ADMIN");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Refunds</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patient refund requests wait here for approval. Policy-eligible cancellations (doctor cancellations, or patient
          cancellations more than 24 hours ahead) are refunded automatically.
        </p>
      </div>
      <RefundQueue />
    </div>
  );
}
