import Link from "next/link";
import { UserRound } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Patient account management: account status and registration details only.
 * Medical records are not listed here — they stay behind separately
 * authorised, justified and audited clinical access. */
export default async function PatientAccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "PATIENT_ACCOUNTS");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const PAGE_SIZE = 25;
  const where = { deletedAt: null, role: "PATIENT" as const, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}) };
  const [total, patients] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: page * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, name: true, email: true, status: true, createdAt: true, statusReason: true, patient: { select: { id: true, caseNumber: true } } } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);

  return <>
    <PageHeader title="Patient Account Management" description={`${total.toLocaleString()} patient account${total === 1 ? "" : "s"}`} />
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <form className="flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search patients" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-sm" />
        <button type="submit" className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Search</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[38rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">Patient</th><th className="py-2 pr-3 font-medium">Case number</th>
            <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Registered</th><th className="py-2 font-medium">Account</th>
          </tr></thead>
          <tbody>
            {patients.map((p) => <tr key={p.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-muted-foreground">{p.email}</span></td>
              <td className="py-2.5 pr-3 font-mono text-xs">{p.patient?.caseNumber ?? "—"}</td>
              <td className="py-2.5 pr-3"><Badge variant={p.status === "ACTIVE" ? "default" : "destructive"}>{p.status.toLowerCase()}</Badge></td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">{formatClinicDateTime(p.createdAt)}</td>
              <td className="py-2.5"><Link href={`/admin/users/${p.id}`} className="text-sm font-medium text-primary hover:underline">Manage account</Link></td>
            </tr>)}
            {!patients.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground"><UserRound className="mx-auto mb-2 size-6" />No patient accounts match.</td></tr>}
          </tbody>
        </table>
      </div>
      {pages > 1 && <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          {page > 0 && <Link href={`/super-admin/patients?q=${encodeURIComponent(q)}&page=${page - 1}`} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Previous</Link>}
          {(page + 1) * PAGE_SIZE < total && <Link href={`/super-admin/patients?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Next</Link>}
        </div>
      </nav>}
      <p className="text-xs text-muted-foreground">This view shows account administration only — status, recovery and portal permissions. A patient&#39;s medical record is accessible only to professionals with an authorised care relationship, and every access is audited.</p>
    </CardContent></Card>
  </>;
}
