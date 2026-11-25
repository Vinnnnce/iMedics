import { Suspense } from "react";
import { requireHisPage } from "@/lib/his/page";
import { DrilldownTable } from "@/components/analytics/drilldown-table";

export default async function DrilldownPage() {
  const { can } = await requireHisPage("VIEW_ANALYTICS", ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  return <Suspense><DrilldownTable canIdentify={can("VIEW_PATIENT_DOCUMENTS")} /></Suspense>;
}
