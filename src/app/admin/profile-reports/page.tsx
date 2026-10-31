import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { ProfileReportsList } from "@/components/admin/profile-reports-list";
import { prisma } from "@/lib/prisma";
import { REPORT_REASONS, type ReportReason } from "@/lib/profile-reports";

export const dynamic = "force-dynamic";

export default async function AdminProfileReportsPage() {
  const reports = await prisma.profileReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  // Resolve the reported profiles' names in two bulk queries.
  const doctorIds = reports.filter((r) => r.targetType === "DOCTOR").map((r) => r.targetId);
  const facilityIds = reports.filter((r) => r.targetType === "FACILITY").map((r) => r.targetId);
  const [doctors, facilities] = await Promise.all([
    doctorIds.length ? prisma.doctorProfile.findMany({ where: { id: { in: doctorIds } }, select: { id: true, user: { select: { name: true } } } }) : [],
    facilityIds.length ? prisma.labStaffProfile.findMany({ where: { id: { in: facilityIds } }, select: { id: true, laboratoryName: true, slug: true, kind: true } }) : [],
  ]);
  const names = new Map<string, string>([
    ...doctors.map((d) => [d.id, d.user.name] as [string, string]),
    ...facilities.map((f) => [f.id, f.laboratoryName ?? "Facility"] as [string, string]),
  ]);

  return (
    <>
      <PageHeader title="Profile reports" description="Profiles flagged by users. Review the profile, then mark the report reviewed or dismiss it." />
      <ProfileReportsList
        reports={reports.map((r) => ({
          id: r.id,
          targetType: r.targetType,
          targetId: r.targetId,
          targetName: names.get(r.targetId) ?? "Removed profile",
          profileHref: r.targetType === "DOCTOR" ? `/doctors/${r.targetId}` : null,
          reason: REPORT_REASONS[r.reason as ReportReason] ?? r.reason,
          details: r.details,
          status: r.status,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
      <p className="mt-4 text-xs text-muted-foreground">
        Reports about doctors link to the public profile. For facilities, search the facility in <Link href="/admin/providers" className="underline">Providers</Link>.
      </p>
    </>
  );
}
