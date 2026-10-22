import { requireFacilityPortalPage } from "@/lib/guards";

// The facility portal is open to any active facility staff member (hospital,
// laboratory or diagnostic centre), matching the dashboard guard — the module
// pages apply their own kind-based guards.
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  await requireFacilityPortalPage();
  return children;
}
