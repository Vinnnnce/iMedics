import { Suspense } from "react";
import { requireHisPage } from "@/lib/his/page";
import { AnalyticsShell } from "@/components/analytics/shell";

// Navigation only: every API and dashboard re-checks permissions on the server.
export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  await requireHisPage(null, ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"]);
  return <Suspense><AnalyticsShell>{children}</AnalyticsShell></Suspense>;
}
