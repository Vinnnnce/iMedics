import Link from "next/link";
import { HeartPulse, ArrowRight } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DoctorManagementPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "DOCTORS");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const status = ["ALL", "PENDING", "VERIFIED", "REJECTED"].includes(sp.status ?? "ALL") ? sp.status : "ALL";
  const live = { deletedAt: null } as const;

  const [total, pending, approved, rejected, doctors] = await Promise.all([
    prisma.doctorProfile.count({ where: { user: live } }),
    prisma.doctorProfile.count({ where: { verificationStatus: "PENDING", user: live } }),
    prisma.doctorProfile.count({ where: { verificationStatus: "VERIFIED", user: live } }),
    prisma.doctorProfile.count({ where: { verificationStatus: "REJECTED", user: live } }),
    prisma.doctorProfile.findMany({
      where: {
        user: live,
        ...(status !== "ALL" ? { verificationStatus: status as never } : {}),
        ...(q ? { OR: [{ user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q, mode: "insensitive" as const } } }, { specialty: { contains: q, mode: "insensitive" as const } }] } : {}),
      },
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, specialty: true, verificationStatus: true, createdAt: true, licenseNumber: true, user: { select: { id: true, name: true, email: true, status: true } } },
    }),
  ]);

  return <>
    <PageHeader title="Doctor Management" description="Professional profiles, credential verification and account status" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Registered doctors" value={total.toLocaleString()} />
      <StatCard label="Awaiting verification" value={pending.toLocaleString()} tone={pending > 0 ? "warning" : undefined} href="/admin/verifications" />
      <StatCard label="Approved" value={approved.toLocaleString()} />
      <StatCard label="Rejected" value={rejected.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <form className="flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Search name, email or specialty" aria-label="Search doctors" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-sm" />
        <select name="status" defaultValue={status} aria-label="Filter by verification status" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{["ALL", "PENDING", "VERIFIED", "REJECTED"].map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s.toLowerCase()}</option>)}</select>
        <button type="submit" className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Doctor</th><th className="py-2 pr-3 font-medium">Specialty</th><th className="py-2 pr-3 font-medium">Licence</th>
            <th className="py-2 pr-3 font-medium">Verification</th><th className="py-2 pr-3 font-medium">Registered</th><th className="py-2 font-medium">Account</th>
          </tr></thead>
          <tbody>
            {doctors.map((d) => <tr key={d.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3"><span className="block truncate font-medium">{d.user.name}</span><span className="block truncate text-xs text-muted-foreground">{d.user.email}</span></td>
              <td className="py-2.5 pr-3">{d.specialty ?? "—"}</td>
              <td className="py-2.5 pr-3 font-mono text-xs">{d.licenseNumber ?? "—"}</td>
              <td className="py-2.5 pr-3"><Badge variant={d.verificationStatus === "VERIFIED" ? "default" : d.verificationStatus === "PENDING" ? "secondary" : "destructive"}>{d.verificationStatus.toLowerCase()}</Badge></td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">{formatClinicDateTime(d.createdAt)}</td>
              <td className="py-2.5"><Link href={`/admin/users/${d.user.id}`} className="text-sm font-medium text-primary hover:underline">Manage</Link></td>
            </tr>)}
            {!doctors.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground"><HeartPulse className="mx-auto mb-2 size-6" />No doctors match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {pending > 0 && <Link href="/admin/verifications" className="inline-flex items-center gap-1 text-sm font-medium text-primary">Open the verification workspace ({pending}) <ArrowRight className="size-3.5" /></Link>}
    </CardContent></Card>
  </>;
}
