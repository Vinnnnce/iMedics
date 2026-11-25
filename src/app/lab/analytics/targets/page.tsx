import { requireHisPage } from "@/lib/his/page";
import { TargetsEditor } from "@/components/analytics/targets-editor";

export default async function TargetsPage() {
  const { can } = await requireHisPage("VIEW_ANALYTICS", ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  return <TargetsEditor canManage={can("MANAGE_HOSPITAL_SETTINGS")} />;
}
