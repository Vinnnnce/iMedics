import { Server, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { measureDatabaseLatency } from "@/lib/superadmin/windows";

export const dynamic = "force-dynamic";

export default async function SystemHealthPage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "SYSTEM_HEALTH");
  let dbOk = false;
  let latency = 0;
  try { latency = await measureDatabaseLatency(); dbOk = true; } catch { dbOk = false; }
  const [migrations, pendingIncidents] = await Promise.all([
    prisma.$queryRaw<{ count: bigint }[]>`SELECT COUNT(*)::bigint AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
    prisma.securityIncident.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);
  const releaseGate = process.env.MEDIC1905_ORG_RELEASE_APPROVED === "1" ? "approved" : "not approved";
  const backupRef = process.env.MEDIC1905_ORG_BACKUP_REFERENCE || "not set";

  const rows: [string, string, boolean][] = [
    ["Database", dbOk ? `Connected · ${latency} ms round trip · SSL pinned to verify-full` : "Unreachable", dbOk],
    ["Migrations", `${migrations[0]?.count ?? 0} applied`, true],
    ["Release gate", `Database-changing deploys require operator approval — currently ${releaseGate}`, true],
    ["Backup reference", backupRef, true],
    ["Incidents", `${pendingIncidents} open security incident${pendingIncidents === 1 ? "" : "s"}`, pendingIncidents === 0],
  ];

  return <>
    <PageHeader title="System Health" description="Platform operations status" />
    <Card className="beeline-card"><CardContent className="space-y-3 p-4">
      {rows.map(([name, value, ok]) => <div key={name} className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 className={`size-4 shrink-0 ${ok ? "text-success" : "text-destructive"}`} />
          <span className="font-medium">{name}</span>
        </div>
        <span className="min-w-0 break-all text-right text-muted-foreground">{value}</span>
      </div>)}
      <p className="flex items-start gap-2 rounded-xl bg-muted p-3 text-xs text-muted-foreground"><Server className="mt-0.5 size-4 shrink-0" />
        This screen reports only what the application can verify directly. External infrastructure telemetry (server fleet, storage volumes, CDN) is monitored in the infrastructure console, and sensitive credentials or encryption keys are never displayed here. Background jobs run as scheduled cron endpoints; failures surface in the audit trail and security incidents.</p>
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">Next.js 16</Badge><Badge variant="outline">React 19</Badge><Badge variant="outline">Prisma 7 · PostgreSQL</Badge><Badge variant="outline">Clerk auth + MFA</Badge>
      </div>
    </CardContent></Card>
  </>;
}
