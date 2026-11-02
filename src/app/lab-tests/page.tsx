import { redirectFromLegacyLabPage } from "@/lib/legacy-redirects";

/**
 * This route used to host a static demo lab-test catalogue with hardcoded
 * data. The real lab sections are role-based: patients see their results at
 * /patient/results, doctors order tests at /doctor/lab-requests, and lab
 * staff work at /lab/investigations.
 */
export default async function LegacyLabTestsRedirect() {
  await redirectFromLegacyLabPage();
}
