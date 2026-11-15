import { PageHeader, StatCard } from "@/components/admin/ui";
import { FacilityPlansManager } from "@/components/admin/facility-plans-manager";
import { FacilityTrialsTable } from "@/components/admin/facility-trials-table";
import { billingConfigured, resolveAccessState } from "@/lib/facility-subscriptions";
import { requirePageRole } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminFacilitySubscriptionsPage() {
  await requirePageRole("ADMIN");
  const [plans, subscriptions, configured] = await Promise.all([
    prisma.subscriptionPlan.findMany({ where: { audience: "FACILITY" }, orderBy: { sortOrder: "asc" } }),
    prisma.facilitySubscription.findMany({
      orderBy: { trialEndsAt: "asc" }, take: 300,
      include: { plan: { select: { name: true } }, facility: { select: { id: true, laboratoryName: true, kind: true } } },
    }),
    billingConfigured(),
  ]);
  const now = new Date();
  const rows = subscriptions.map((s) => {
    const state = resolveAccessState(s, configured, now);
    return {
      facilityId: s.facility.id, name: s.facility.laboratoryName ?? "Unnamed facility", kind: s.facility.kind ?? "FACILITY", status: s.status, phase: state.phase,
      endsAt: state.endsAt?.toISOString() ?? null, daysLeft: state.daysLeft, planName: s.plan?.name ?? null,
    };
  });
  const count = (fn: (r: (typeof rows)[number]) => boolean) => rows.filter(fn).length;

  return (
    <>
      <PageHeader title="Facility plans and trials" description="Set prices for facility plans and keep an eye on who is near the end of their free trial." />
      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="On trial" value={count((r) => r.phase === "TRIAL")} />
        <StatCard label="Trial ends within 14 days" value={count((r) => r.phase === "TRIAL" && (r.daysLeft ?? 99) <= 14)} tone="warning" />
        <StatCard label="Ended (grace or read-only)" value={count((r) => r.phase === "GRACE" || r.phase === "READ_ONLY")} tone="danger" />
        <StatCard label="Paying" value={count((r) => r.phase === "PAID")} />
      </div>
      <FacilityPlansManager
        restrictionsOn={configured}
        plans={plans.map((p) => ({ code: p.code, name: p.name, monthlyPrice: Number(p.monthlyPrice), currency: p.currency, sortOrder: p.sortOrder, active: p.active, pricingConfirmed: (p.features as { pricingConfirmed?: unknown } | null)?.pricingConfirmed === true }))}
      />
      <section aria-labelledby="trials-title" className="space-y-3">
        <h2 id="trials-title" className="text-lg font-semibold">Facilities</h2>
        <FacilityTrialsTable rows={rows} />
      </section>
    </>
  );
}
