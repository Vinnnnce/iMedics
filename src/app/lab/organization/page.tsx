import { OrganizationManager } from "@/components/lab/organization-manager";
import { requireFacilityPortalPage } from "@/lib/guards";
import { prisma } from "@/lib/prisma";

export default async function OrganizationPage() {
  const user = await requireFacilityPortalPage();
  // No tenant records are passed through the page. The selected facility is checked independently by the API.
  const memberships = await prisma.facilityStaff.findMany({ where: { userId: user.id, status: "ACTIVE" }, select: { facility: { select: { id: true, laboratoryName: true } } } });
  return <OrganizationManager facilities={memberships.map((m) => ({ id: m.facility.id, name: m.facility.laboratoryName ?? "Facility" }))} />;
}
