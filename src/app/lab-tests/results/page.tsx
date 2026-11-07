import { redirectFromLegacyLabPage } from "@/lib/legacy-redirects";

/**
 * This route used to host static demo lab results. Real results live at
 * /patient/results for patients and /lab/investigations for lab staff.
 */
export default async function LegacyLabResultsRedirect() {
  await redirectFromLegacyLabPage();
}
