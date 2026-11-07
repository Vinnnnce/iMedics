import { redirectFromLegacyLabPage } from "@/lib/legacy-redirects";

/**
 * This route used to host a static demo lab order form. Real test ordering
 * lives at /doctor/lab-requests (doctors) and /lab/investigations (lab staff);
 * patients track results at /patient/results.
 */
export default async function LegacyLabOrderRedirect() {
  await redirectFromLegacyLabPage();
}
