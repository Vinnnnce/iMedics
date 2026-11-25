import { redirect } from "next/navigation";
import { requireHisPage } from "@/lib/his/page";

export default async function AnalyticsIndex() {
  const { can } = await requireHisPage(null, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  redirect(can("VIEW_ANALYTICS") ? "/lab/analytics/overview" : "/lab/analytics/my-performance");
}
