import Link from "next/link";
import { Building2 } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const KINDS = ["ALL", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE", "PHARMACY"] as const;
const STATUSES = ["ALL", "PENDING", "VERIFIED", "REJECTED"] as const;

export default async function FacilityManagementPage({ searchParams }: { searchParams: Promise<{ q?: string; kind?: string; status?: string; page?: string }> }) {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "FACILITIES");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kind = KINDS.includes(sp.kind as never) && sp.kind !== "ALL" ? sp.kind : undefined;
  const status = STATUSES.includes(sp.status as never) && sp.status !== "ALL" ? sp.status : undefined;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const PAGE_SIZE = 25;

  const where = {
    ...(kind ? { kind: kind as never } : {}),
    ...(status ? { verificationStatus: status as never } : {}),
    ...(q ? { OR: [{ laboratoryName: { contains: q, mode: "insensitive" as const } }, { user: { name: { contains: q, mode: "insensitive" as const } } }, { user: { email: { contains: q, mode: "insensitive" as const } } }] } : {}),
  };
  const [total, pending, facilities, kindCounts] = await Promise.all([
    prisma.labStaffProfile.count({ where }),
    prisma.labStaffProfile.count({ where: { verificationStatus: "PENDING" } }),
    prisma.labStaffProfile.findMany({
      where, orderBy: { createdAt: "desc" }, skip: page * PAGE_SIZE, take: PAGE_SIZE,
      select: { id: true, laboratoryName: true, kind: true, verificationStatus: true, createdAt: true, cacRegistrationNumber: true, facilityLicenseNumber: true, user: { select: { id: true, name: true, email: true, status: true } } },
    }),
    prisma.labStaffProfile.groupBy({ by: ["kind"], _count: { _all: true } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(kind && { kind }), ...(status && { status }), ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return `/super-admin/facilities?${params.toString()}`;
  };

  return <>
    <PageHeader title="Facility Management" description="Hospitals, laboratories, diagnostic centres and pharmacies across the platform" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {kindCounts.map((c) => <StatCard key={c.kind ?? "unclassified"} label={(c.kind ?? "Unclassified").toLowerCase().replaceAll("_", " ")} value={c._count._all.toLocaleString()} />)}
      <StatCard label="Pending registrations" value={pending.toLocaleString()} tone={pending > 0 ? "warning" : undefined} href="/admin/verifications" />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" method="get">
        <input name="q" defaultValue={q} placeholder="Search facility or owner" aria-label="Search facilities" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm" />
        <select name="kind" defaultValue={kind ?? "ALL"} aria-label="Filter by facility type" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{KINDS.map((k) => <option key={k} value={k}>{k === "ALL" ? "All types" : k.toLowerCase().replaceAll("_", " ")}</option>)}</select>
        <select name="status" defaultValue={status ?? "ALL"} aria-label="Filter by status" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{STATUSES.map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s.toLowerCase()}</option>)}</select>
        <button type="submit" className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Facility</th><th className="py-2 pr-3 font-medium">Type</th><th className="py-2 pr-3 font-medium">Licence / CAC</th>
            <th className="py-2 pr-3 font-medium">Verification</th><th className="py-2 pr-3 font-medium">Owner</th><th className="py-2 pr-3 font-medium">Registered</th><th className="py-2 font-medium">Account</th>
          </tr></thead>
          <tbody>
            {facilities.map((f) => <tr key={f.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3 font-medium">{f.laboratoryName ?? "Unnamed facility"}</td>
              <td className="py-2.5 pr-3">{f.kind?.toLowerCase().replaceAll("_", " ") ?? "—"}</td>
              <td className="py-2.5 pr-3 font-mono text-xs">{f.facilityLicenseNumber ?? f.cacRegistrationNumber ?? "—"}</td>
              <td className="py-2.5 pr-3"><Badge variant={f.verificationStatus === "VERIFIED" ? "default" : f.verificationStatus === "PENDING" ? "secondary" : "destructive"}>{f.verificationStatus.toLowerCase()}</Badge></td>
              <td className="py-2.5 pr-3"><span className="block truncate">{f.user.name}</span><span className="block truncate text-xs text-muted-foreground">{f.user.email}</span></td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">{formatClinicDateTime(f.createdAt)}</td>
              <td className="py-2.5"><Link href={`/admin/users/${f.user.id}`} className="text-sm font-medium text-primary hover:underline">Manage</Link></td>
            </tr>)}
            {!facilities.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground"><Building2 className="mx-auto mb-2 size-6" />No facilities match these filters.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          {page > 0 && <Link href={qs({ page: page - 1 })} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Previous</Link>}
          {(page + 1) * PAGE_SIZE < total && <Link href={qs({ page: page + 1 })} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Next</Link>}
        </div>
      </nav>}
      <p className="text-xs text-muted-foreground">Each facility&#39;s records and permissions stay isolated. A facility administrator can never access another facility&#39;s private records; suspending a facility never deletes clinical records.</p>
    </CardContent></Card>
  </>;
}
