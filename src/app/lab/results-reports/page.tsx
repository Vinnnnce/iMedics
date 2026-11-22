import { prisma } from "@/lib/prisma";
import { ResultsCentre } from "@/components/investigations/facility/results-centre";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { facilityAnalytics } from "@/lib/investigations/analytics";
import { requireModulePageWithPermission } from "@/lib/modules/page-guards";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityPermissions } from "@/lib/facility-auth";

// Results & Reports centre: laboratory sections and diagnostic departments, fed automatically from doctors' orders.
export default async function ResultsReportsPage() {
  const { facilityId, kind } = await requireModulePageWithPermission("PROCESS_ORDERS", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE");
  const user = await requireFacilityPortalPage();
  await ensureCatalogueSeeded();
  const [categories, analytics, perms] = await Promise.all([
    prisma.investigation_categories.findMany({ where: { isActive: true }, orderBy: [{ domain: "asc" }, { sortOrder: "asc" }], select: { domain: true, key: true, name: true } }),
    facilityAnalytics(facilityId),
    resolveFacilityPermissions(user, facilityId),
  ]);
  const domains = kind === "LABORATORY" ? (["LABORATORY"] as const) : kind === "DIAGNOSTIC_CENTRE" ? (["DIAGNOSTIC"] as const) : (["LABORATORY", "DIAGNOSTIC"] as const);
  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Results &amp; Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">Requests arrive sorted into the right department. Track specimens and examinations, enter results, verify, sign and release.</p>
      </div>
      <ResultsCentre domains={[...domains]} categories={categories} analytics={analytics} canManageCatalogue={perms.permissions.includes("MANAGE_SERVICES")} />
    </div>
  );
}
