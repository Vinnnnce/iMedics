import Link from "next/link";
import { ArrowRight, ShieldPlus } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

export default async function SuperAdminOverviewPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "OVERVIEW");
  const now = new Date();
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const live = { deletedAt: null } as const;

  const [
    patients, doctors, admins, activeUsers, inactiveUsers, recentRegistrations,
    hospitals, laboratories, diagnosticCentres, pharmacies, pendingFacilities,
    pendingDoctors, healthcareProfessionals,
    teamMembers, grants,
    activeSubscriptions, expiredSubscriptions, trialSubscriptions,
    revenueMonth, revenueYear,
    appointments, consultations, labOrders, aiRequests30d,
    openIncidents, criticalIncidents,
    recentAdminActivity,
  ] = await Promise.all([
    prisma.user.count({ where: { ...live, role: "PATIENT" } }),
    prisma.user.count({ where: { ...live, role: "DOCTOR" } }),
    prisma.user.count({ where: { ...live, role: "ADMIN" } }),
    prisma.user.count({ where: { ...live, status: "ACTIVE" } }),
    prisma.user.count({ where: { deletedAt: null, status: { in: ["SUSPENDED", "BANNED", "PENDING"] } } }),
    prisma.user.findMany({ where: live, orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    prisma.labStaffProfile.count({ where: { kind: "HOSPITAL", verificationStatus: "VERIFIED" } }),
    prisma.labStaffProfile.count({ where: { kind: "LABORATORY", verificationStatus: "VERIFIED" } }),
    prisma.labStaffProfile.count({ where: { kind: "DIAGNOSTIC_CENTRE", verificationStatus: "VERIFIED" } }),
    prisma.labStaffProfile.count({ where: { kind: "PHARMACY", verificationStatus: "VERIFIED" } }),
    prisma.labStaffProfile.count({ where: { verificationStatus: "PENDING" } }),
    prisma.doctorProfile.count({ where: { verificationStatus: "PENDING", user: live } }),
    prisma.facilityStaff.count({ where: { status: "ACTIVE" } }),
    prisma.adminMembership.count({ where: { status: "ACTIVE", OR: [{ endsAt: null }, { endsAt: { gt: now } }] } }),
    prisma.superAdminGrant.count({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
    prisma.doctorSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now } } }),
    prisma.doctorSubscription.count({ where: { currentPeriodEnd: { lte: now } } }),
    prisma.doctorSubscription.count({ where: { status: "ACTIVE", currentPeriodEnd: { gt: now }, plan: { monthlyPrice: 0 } } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: "SUCCESSFUL", paidAt: { gte: startOfYear } }, _sum: { amount: true } }),
    prisma.appointment.count(),
    prisma.consultation.count(),
    prisma.labOrder.count(),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } } }),
    prisma.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] } } }),
    prisma.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING", "CONTAINED"] }, severity: { in: ["HIGH", "CRITICAL"] } } }),
    prisma.controlAuditEvent.findMany({ orderBy: { sequence: "desc" }, take: 8, select: { sequence: true, action: true, resourceId: true, occurredAt: true, actorId: true } }),
  ]);

  const actorIds = [...new Set(recentAdminActivity.map((a) => a.actorId))];
  const actorNames = new Map((await (actorIds.length ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }) : [])).map((u) => [u.id, u.name]));

  const revenue = (sum: { _sum: { amount: unknown } }, fallback = "—") =>
    sum._sum.amount ? formatMoney(String(sum._sum.amount), "NGN") : fallback;

  return (
    <>
      <PageHeader title="Medic1905 Control Centre" description={`Platform overview as of ${formatClinicDateTime(now)}`} actions={
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5"><ShieldPlus className="size-4" />{grants} Super Admin grant{grants === 1 ? "" : "s"} · {teamMembers} team member{teamMembers === 1 ? "" : "s"}</Badge>
      } />

      <section aria-label="Platform population" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Registered patients" value={patients.toLocaleString()} href="/super-admin/patients" />
        <StatCard label="Registered doctors" value={doctors.toLocaleString()} hint={`${pendingDoctors} awaiting verification`} href="/super-admin/doctors" />
        <StatCard label="Hospitals" value={hospitals.toLocaleString()} href="/super-admin/facilities" />
        <StatCard label="Laboratories" value={laboratories.toLocaleString()} href="/super-admin/facilities" />
        <StatCard label="Diagnostic centres" value={diagnosticCentres.toLocaleString()} href="/super-admin/facilities" />
        <StatCard label="Pharmacies" value={pharmacies.toLocaleString()} href="/super-admin/facilities" />
        <StatCard label="Healthcare professionals" value={healthcareProfessionals.toLocaleString()} hint="Active facility staff" href="/super-admin/users" />
        <StatCard label="Platform administrators" value={admins.toLocaleString()} href="/super-admin/team" />
        <StatCard label="Active users" value={activeUsers.toLocaleString()} href="/super-admin/users" />
        <StatCard label="Inactive / pending users" value={inactiveUsers.toLocaleString()} tone={inactiveUsers > 0 ? "warning" : undefined} href="/super-admin/users" />
        <StatCard label="Pending facility registrations" value={pendingFacilities.toLocaleString()} tone={pendingFacilities > 0 ? "warning" : undefined} href="/super-admin/facilities" />
        <StatCard label="Pending professional verifications" value={pendingDoctors.toLocaleString()} tone={pendingDoctors > 0 ? "warning" : undefined} href="/super-admin/doctors" />
      </section>

      <section aria-label="Commercial overview" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active subscriptions" value={activeSubscriptions.toLocaleString()} href="/super-admin/subscriptions" />
        <StatCard label="Expired subscriptions" value={expiredSubscriptions.toLocaleString()} href="/super-admin/subscriptions" />
        <StatCard label="Free-trial / free-plan accounts" value={trialSubscriptions.toLocaleString()} href="/super-admin/subscriptions" />
        <StatCard label="Revenue this month" value={revenue(revenueMonth)} hint={`Year to date: ${revenue(revenueYear)}`} href="/super-admin/subscriptions" />
      </section>

      <section aria-label="Usage and security" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Appointments booked" value={appointments.toLocaleString()} href="/super-admin/analytics" />
        <StatCard label="Consultations recorded" value={consultations.toLocaleString()} href="/super-admin/analytics" />
        <StatCard label="Laboratory orders" value={labOrders.toLocaleString()} href="/super-admin/laboratory" />
        <StatCard label="AI requests (30 days)" value={aiRequests30d.toLocaleString()} href="/super-admin/ai" />
        <StatCard label="Open security incidents" value={openIncidents.toLocaleString()} tone={openIncidents > 0 ? "warning" : undefined} href="/super-admin/security" />
        <StatCard label="High or critical incidents" value={criticalIncidents.toLocaleString()} tone={criticalIncidents > 0 ? "danger" : undefined} href="/super-admin/security" />
        <StatCard label="Admin team members" value={teamMembers.toLocaleString()} href="/super-admin/team" />
        <StatCard label="Super Admin grants" value={grants.toLocaleString()} href="/super-admin/security" />
      </section>

      <section aria-label="Recent activity" className="grid gap-4 lg:grid-cols-2">
        <Card className="beeline-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent user registrations</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentRegistrations.map((u) => (
              <div key={u.id} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                <span className="truncate"><span className="font-medium">{u.name}</span> <span className="text-muted-foreground">· {u.role.toLowerCase().replaceAll("_", " ")}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatClinicDateTime(u.createdAt)}</span>
              </div>
            ))}
            {!recentRegistrations.length && <p className="text-sm text-muted-foreground">No registrations yet.</p>}
            <Link href="/super-admin/users" className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">All users <ArrowRight className="size-3.5" /></Link>
          </CardContent>
        </Card>
        <Card className="beeline-card">
          <CardHeader className="pb-2"><CardTitle className="text-base">Recent administrative activity</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {recentAdminActivity.map((a) => (
              <div key={a.sequence.toString()} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                <span className="truncate"><span className="font-medium">{actorNames.get(a.actorId) ?? "System"}</span> <span className="text-muted-foreground">· {a.action.toLowerCase().replaceAll("_", " ")}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground">{formatClinicDateTime(a.occurredAt)}</span>
              </div>
            ))}
            {!recentAdminActivity.length && <p className="text-sm text-muted-foreground">Administrative actions will appear here once recorded.</p>}
            <Link href="/super-admin/audit" className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary">Full audit trail <ArrowRight className="size-3.5" /></Link>
          </CardContent>
        </Card>
      </section>

      <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        Master control configures the platform — it never opens patient medical records. Clinical-record access stays separately authorised, justified and audited through facility staff privileges and platform policies.
      </p>
    </>
  );
}
