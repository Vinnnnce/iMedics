import Link from "next/link";
import { PageHeader, StatCard, BarChart } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { getOverview } from "@/lib/admin/overview";
import { prisma } from "@/lib/prisma";
import { thirtyDaysAgo } from "@/lib/superadmin/windows";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "ANALYTICS");
  const o = await getOverview();
  const monthAgo = thirtyDaysAgo();
  const [appointments30d, consultations30d, labOrders30d, documents30d] = await Promise.all([
    prisma.appointment.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.consultation.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.labOrder.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.clinicalDocument.count({ where: { createdAt: { gte: monthAgo } } }),
  ]);

  return <>
    <PageHeader title="Analytics & Reports" description="Platform usage statistics and trends" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Appointments (30 days)" value={appointments30d.toLocaleString()} />
      <StatCard label="Consultations (30 days)" value={consultations30d.toLocaleString()} />
      <StatCard label="Laboratory orders (30 days)" value={labOrders30d.toLocaleString()} />
      <StatCard label="Clinical documents (30 days)" value={documents30d.toLocaleString()} />
    </section>
    <section className="grid gap-4 lg:grid-cols-3">
      <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.registrations} label="New registrations" /></CardContent></Card>
      <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.appointments} label="Appointments booked" /></CardContent></Card>
      <Card className="beeline-card"><CardContent className="p-4"><BarChart data={o.series.payments} label="Successful payments" /></CardContent></Card>
    </section>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      Operational reports live in the administration console — <Link href="/admin/reports" className="font-medium text-primary underline">open reports</Link> and <Link href="/admin/profile-reports" className="font-medium text-primary underline">profile reports</Link>. Analytics by default uses de-identified, aggregate data; patient-level exports require an approved data officer request.
    </CardContent></Card>
  </>;
}
