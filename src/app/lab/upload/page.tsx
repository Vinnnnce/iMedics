import { z } from "zod";
import { ResultEntryForm, type OrderPrefill } from "@/components/lab/result-entry-form";
import { prisma } from "@/lib/prisma";
import { requirePageRole } from "@/lib/guards";

export default async function LabUploadPage({ searchParams }: { searchParams: Promise<{ orderId?: string }> }) {
  await requirePageRole("LAB_SCIENTIST");

  let prefill: OrderPrefill | null = null;
  const orderId = z.string().uuid().safeParse((await searchParams).orderId);
  if (orderId.success) {
    const order = await prisma.labOrder.findFirst({
      where: { id: orderId.data, status: { in: ["ORDERED", "IN_PROGRESS"] } },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
        items: { include: { labTest: { select: { code: true, name: true, unit: true, refLow: true, refHigh: true } } } },
      },
    });
    if (order) {
      prefill = {
        orderId: order.id,
        patient: { id: order.patient.id, name: `${order.patient.firstName} ${order.patient.lastName}`, caseNumber: order.patient.caseNumber },
        tests: order.items.map((i) => i.labTest),
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Upload Results</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {prefill ? "Enter the results for this order." : "Enter results for a patient. Find them by case number."}
        </p>
      </div>
      <ResultEntryForm prefill={prefill} />
    </div>
  );
}
