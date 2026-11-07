import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { formatClinicDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AuditLogPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "AUDIT");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const page = Math.max(0, Number(sp.page ?? 0) || 0);
  const PAGE_SIZE = 50;
  const where = q ? { OR: [{ action: { contains: q.toUpperCase() } }, { resourceId: { contains: q } }] } : {};
  const [total, events, auditLogs] = await Promise.all([
    prisma.controlAuditEvent.count({ where }),
    prisma.controlAuditEvent.findMany({
      where, orderBy: { sequence: "desc" }, skip: page * PAGE_SIZE, take: PAGE_SIZE,
      select: { sequence: true, actorId: true, action: true, resourceId: true, details: true, occurredAt: true, previousHash: true, hash: true },
    }),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20, select: { id: true, action: true, resourceType: true, createdAt: true, user: { select: { name: true } } } }),
  ]);
  const actorIds = [...new Set(events.map((e) => e.actorId))];
  const actorNames = new Map(actorIds.length
    ? (await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } })).map((u) => [u.id, u] as const)
    : []);
  const pages = Math.ceil(total / PAGE_SIZE);
  const human = (s: string) => s.toLowerCase().replaceAll("_", " ");

  return <>
    <PageHeader title="Audit Logs" description="Tamper-evident administrative history" />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Total control events" value={total.toLocaleString()} />
      <StatCard label="Recent admin actions" value={auditLogs.length.toLocaleString()} href="/admin/activity" />
    </section>
    <Card className="beeline-card"><CardContent className="space-y-4 p-4">
      <form className="flex flex-wrap gap-3" method="get">
        <input name="q" defaultValue={q} placeholder="Search action or resource" aria-label="Search audit events" className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-background px-3 text-sm sm:max-w-sm" />
        <button type="submit" className="min-h-11 rounded-lg bg-foreground px-4 text-sm font-medium text-background">Search</button>
      </form>
      <div className="space-y-2">
        {events.map((e) => <article key={e.sequence.toString()} className="min-w-0 space-y-1 rounded-xl border p-4 text-sm">
          <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">{human(e.action)}</p>
            <p className="text-xs text-muted-foreground">#{e.sequence.toString()} · {formatClinicDateTime(e.occurredAt)}</p>
          </div>
          <p className="text-xs text-muted-foreground">{actorNames.get(e.actorId)?.name ?? e.actorId}</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{e.resourceId}</p>
          {e.details && typeof e.details === "object" && Object.keys(e.details as object).length > 0 && (
            <details><summary className="cursor-pointer text-xs text-muted-foreground">Details</summary><pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2 text-[11px] leading-relaxed">{JSON.stringify(e.details, null, 2)}</pre></details>
          )}
          <p className="break-all font-mono text-[10px] text-muted-foreground">SHA-256 {e.hash?.slice(0, 32)}…</p>
        </article>)}
        {!events.length && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground"><ScrollText className="mx-auto mb-2 size-6" />No audit events match.</p>}
      </div>
      {pages > 1 && <nav aria-label="Pagination" className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Page {page + 1} of {pages}</span>
        <div className="flex gap-2">
          {page > 0 && <Link href={`/super-admin/audit?q=${encodeURIComponent(q)}&page=${page - 1}`} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Previous</Link>}
          {(page + 1) * PAGE_SIZE < total && <Link href={`/super-admin/audit?q=${encodeURIComponent(q)}&page=${page + 1}`} className="rounded-lg border px-3 py-1.5 hover:bg-muted">Next</Link>}
        </div>
      </nav>}
      <p className="text-xs text-muted-foreground">Every sensitive action records who did it, what changed (previous and new values where appropriate), when, the affected resource, and the reason. Events are hash-chained by the database — they cannot be updated or deleted — and are retained according to applicable legal requirements.</p>
    </CardContent></Card>
  </>;
}
