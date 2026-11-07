import { RegistrationWorkspace } from "@/components/his/registration-workspace";
import { requireHisPage } from "@/lib/his/page";

/**
 * Registration & admission workspace — the front desk for patient intake.
 * Facility-scoped server component; the workspace client component handles
 * the guided workflow and dashboard.
 */
export default async function RegistrationPage() {
  await requireHisPage("MANAGE_ENCOUNTERS", ["HOSPITAL"]);
  return (
    <div className="mx-auto max-w-6xl space-y-4 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Registration & admission</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patient intake workspace: identification with duplicate prevention, demographics,
          clinical history, vitals, admission details, insurance, consent and documents.
        </p>
      </div>
      <RegistrationWorkspace />
    </div>
  );
}
