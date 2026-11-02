import { redirectFromLegacyDiagnosticsPage } from "@/lib/legacy-redirects";

/**
 * This route used to host a static demo diagnostics overview. The real
 * diagnostic sections are role-based: patients see their records at
 * /patient/diagnostics, doctors at /doctor/diagnostics, and diagnostic
 * staff at /lab/examinations.
 */
export default async function LegacyDiagnosticsRedirect() {
  await redirectFromLegacyDiagnosticsPage();
}
