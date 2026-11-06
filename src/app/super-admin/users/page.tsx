import Link from "next/link";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_FILTERS = ["ALL", "PATIENT", "DOCTOR", "LAB_SCIENTIST", "ADMIN"] as const;
const STATUS_FILTERS = ["ALL", "ACTIVE", "PENDING", "SUSPENDED", "BANNED"] as const;

export default async function GlobalUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; page?: string }> }) {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "USERS");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const role = ROLE_FILTERS.includes(sp.role as never) && sp.role !== "ALL" ? sp.role : undefined;
  const status = STATUS_FILTERS.includes(sp.status as never) && sp.status !== "ALL" ? sp.status : undefined;
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const PAGE_SIZE = 25;

  const where = {
    deletedAt: null,
    ...(role ? { role: role as never } : {}),
    ...(status ? { status: status as never } : {}),
    ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] } : {}),
  };
  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, orderBy: { createdAt: "desc" }, skip: page * PAGE_SIZE, take: PAGE_SIZE, select: { id: true, name: true, email: true, role: true, accountType: true, status: true, createdAt: true, lastLoginAt: true } }),
  ]);
  const pages = Math.ceil(total / PAGE_SIZE);
  const qs = (next: Record<string, string | number | undefined>) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(role && { role }), ...(status && { status }), ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    return `/super-admin/users?${params.toString()}`;
  };

  return <>
    <PageHeader title="Global User Management" description={`All account types · ${total.toLocaleString()} matching user${total === 1 ? "" : "s"}`} />
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto]" method="get">
        <input name="q" defaultValue={q} placeholder="Search name or email" aria-label="Search users" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm" />
        <select name="role" defaultValue={role ?? "ALL"} aria-label="Filter by role" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{ROLE_FILTERS.map((r) => <option key={r} value={r}>{r === "ALL" ? "All roles" : r.toLowerCase().replaceAll("_", " ")}</option>)}</select>
        <select name="status" defaultValue={status ?? "ALL"} aria-label="Filter by status" className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm">{STATUS_FILTERS.map((s) => <option key={s} value={s}>{s === "ALL" ? "All statuses" : s.toLowerCase()}</option>)}</select>
        <button type="submit" className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Filter</button>
      </form>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[46rem] text-sm">
          <thead><tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-2 pr-3 font-medium">User</th><th className="py-2 pr-3 font-medium">Role</th><th className="py-2 pr-3 font-medium">Account</th>
            <th className="py-2 pr-3 font-medium">Status</th><th className="py-2 pr-3 font-medium">Registered</th><th className="py-2 font-medium">Last login</th>
          </tr></thead>
          <tbody>
            {users.map((u) => <tr key={u.id} className="border-b last:border-0">
              <td className="py-2.5 pr-3"><Link href={`/admin/users/${u.id}`} className="font-medium hover:underline"><span className="block truncate">{u.name}</span><span className="block truncate text-xs text-muted-foreground">{u.email}</span></Link></td>
              <td className="py-2.5 pr-3">{u.role.toLowerCase().replaceAll("_", " ")}</td>
              <td className="py-2.5 pr-3">{u.accountType?.toLowerCase().replaceAll("_", " ") ?? "—"}</td>
              <td className="py-2.5 pr-3"><Badge variant={u.status === "ACTIVE" ? "default" : u.status === "PENDING" ? "secondary" : "destructive"}>{u.status.toLowerCase()}</Badge></td>
              <td className="py-2.5 pr-3 text-xs text-muted-foreground">{formatClinicDateTime(u.createdAt)}</td>
              <td className="py-2.5 text-xs text-muted-foreground">{u.lastLoginAt ? formatClinicDateTime(u.lastLoginAt) : "never"}</td>
            </tr>)}
            {!users.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground"><Users className="mx-auto mb-2 size-6" />No users match these filters.</td></tr>}
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
      <p className="text-xs text-muted-foreground">Account controls (suspend, deactivate, recovery) open in the existing administration console. Console access here never includes patient medical records.</p>
    </CardContent></Card>
  </>;
}
