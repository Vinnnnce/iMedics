import { requireFacilityPortalPage } from "@/lib/guards";

// The facility portal is open to facility staff whose account role is PATIENT
// or LAB_SCIENTIST (matching the dashboard guard) — the module pages apply
// their own kind-based guards. Doctors use the doctor portal instead.
export default async function LabLayout({ children }: { children: React.ReactNode }) {
  await requireFacilityPortalPage();
  return children;
}
