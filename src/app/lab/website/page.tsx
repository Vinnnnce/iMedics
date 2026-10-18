import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { WebsiteBuilder } from "@/components/website/builder";

export default async function FacilityWebsitePage() {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-0">
      <WebsiteBuilder
        facility={{
          name: facility.laboratoryName ?? "Facility",
          phone: facility.phone,
          email: facility.email,
          address: facility.addressLine,
          city: facility.city,
          state: facility.state,
          operatingHours: facility.operatingHours,
        }}
      />
    </div>
  );
}
