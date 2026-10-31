import { CoverageManager } from "@/components/his/coverage-manager";
import { requireHisPage } from "@/lib/his/page";

export default async function InsurancePage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const sp = await searchParams;
  await requireHisPage("MANAGE_INSURANCE");
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Patient financial classification</h1>
        <p className="mt-1 text-sm text-muted-foreground">Insured, uninsured, pending verification, authorization required, rejected claims and self-pay patients.</p>
      </div>
      <CoverageManager initialFilter={["all", "insured", "uninsured", "pending", "authorization", "rejected", "selfpay"].includes(sp.filter ?? "") ? sp.filter! : "all"} />
    </div>
  );
}
