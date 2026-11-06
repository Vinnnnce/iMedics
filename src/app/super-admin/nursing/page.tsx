import { BriefcaseMedical } from "lucide-react";
import { PageHeader, StatCard } from "@/components/admin/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageRole } from "@/lib/guards";
import { requireSectionPage } from "@/lib/superadmin/access";
import { prisma } from "@/lib/prisma";
import { moduleMode } from "@/lib/superadmin/policy-view";

export const dynamic = "force-dynamic";

export default async function NursingModulePage() {
  const user = await requirePageRole("ADMIN");
  await requireSectionPage(user, "NURSING");
  const [assessments, tasksOpen, tasksDone, handovers, mode] = await Promise.all([
    prisma.nursingAssessment.count(),
    prisma.nursingTask.count({ where: { status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    prisma.nursingTask.count({ where: { status: "COMPLETED" } }),
    prisma.nursingHandover.count(),
    moduleMode("NURSING"),
  ]);
  return <>
    <PageHeader title="Nursing Management" description="Platform-wide nursing module activity" actions={<Badge variant={mode === "ENABLED" ? "default" : "secondary"}>{mode.toLowerCase().replaceAll("_", " ")}</Badge>} />
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Nursing assessments" value={assessments.toLocaleString()} />
      <StatCard label="Open nursing tasks" value={tasksOpen.toLocaleString()} tone={tasksOpen > 0 ? "warning" : undefined} />
      <StatCard label="Completed tasks" value={tasksDone.toLocaleString()} />
      <StatCard label="Handovers recorded" value={handovers.toLocaleString()} />
    </section>
    <Card className="beeline-card"><CardContent className="p-4 text-sm text-muted-foreground">
      <p className="flex items-center gap-2 font-medium text-foreground"><BriefcaseMedical className="size-4" />Module availability</p>
      <p className="mt-2">This module is currently <strong>{mode.toLowerCase().replaceAll("_", " ")}</strong> platform-wide. Availability, read-only windows and per-facility restrictions are configured in Module & Feature Control and enforced on every API request — disabled modules cannot be reached through direct URLs.</p>
    </CardContent></Card>
  </>;
}
