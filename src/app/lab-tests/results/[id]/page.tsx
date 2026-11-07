import { redirectFromLegacyLabPage } from "@/lib/legacy-redirects";

/**
 * This route used to host a static demo lab result detail view. Real results
 * live at /patient/results for patients and /lab/investigations for lab staff.
 */
export default async function LegacyLabResultDetailRedirect() {
  await redirectFromLegacyLabPage();
}
