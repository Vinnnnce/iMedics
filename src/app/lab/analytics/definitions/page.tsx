import { requireHisPage } from "@/lib/his/page";
import { DefinitionsList } from "@/components/analytics/definitions-list";

export default async function DefinitionsPage() {
  await requireHisPage("VIEW_ANALYTICS", ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  return <DefinitionsList />;
}
