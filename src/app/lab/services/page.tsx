import { BulkImportForm } from "@/components/lab/bulk-import-form";
import { FacilityProfileForm } from "@/components/lab/facility-profile-form";
import { ServicesManager } from "@/components/lab/services-manager";
import { Card, CardContent } from "@/components/ui/card";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { serializeService, serviceSelect } from "@/lib/facility-services";
import { directoryForAccountType } from "@/lib/public-facilities";

export default async function LabServicesPage() {
  const user = await requireFacilityPortalPage();
  const profile = await resolveFacilityForPortalUser(user);

  if (profile.verificationStatus !== "VERIFIED") {
    return (
      <Card className="beeline-card mx-auto max-w-md">
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          You can publish services and prices once an administrator has verified your facility.
        </CardContent>
      </Card>
    );
  }

  const services = await prisma.facilityService.findMany({
    where: { facilityId: profile.id },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    select: serviceSelect,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Services and prices</h1>
        <p className="mt-1 text-sm text-muted-foreground">Patients see these prices before they book. Changes apply to new bookings only.</p>
      </div>
      <FacilityProfileForm initial={profile} publicDirectory={directoryForAccountType(user.accountType) ?? "laboratories"} />
      <BulkImportForm />
      <ServicesManager services={services.map((s) => serializeService(s))} />
    </div>
  );
}
