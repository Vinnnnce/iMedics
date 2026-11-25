import { requireHisPage } from "@/lib/his/page";
import { ReportsCentre } from "@/components/analytics/reports-centre";

export default async function ReportsPage() {
  await requireHisPage("VIEW_ANALYTICS", ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  return <ReportsCentre />;
}
