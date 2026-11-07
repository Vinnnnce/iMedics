import { requireFacilityPortalPage } from "@/lib/guards";
import { requireWebsiteAccess } from "@/lib/website/access";
import { WebsiteBuilder } from "@/components/website/builder";

export default async function FacilityWebsitePage({ searchParams }: { searchParams: Promise<{ facilityId?: string }> }) {
  const user = await requireFacilityPortalPage();
  const { facilityId } = await searchParams;
  const { facility } = await requireWebsiteAccess(user, new Request(`https://local/lab/website${facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : ""}`));

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-0">
      <WebsiteBuilder
        key={facility.id}
        facility={{
          id: facility.id,
          slug: facility.slug,
          directory: facility.kind === "HOSPITAL" ? "hospitals" : facility.kind === "DIAGNOSTIC_CENTRE" ? "diagnostic-centres" : "laboratories",
          isPublic: facility.isPublished && facility.verificationStatus === "VERIFIED",
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
