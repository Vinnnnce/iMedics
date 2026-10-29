import { requireHisPage } from "@/lib/his/page";
import { prisma } from "@/lib/prisma";
import { PRIORITY_LABEL, TYPE_LABEL } from "@/lib/his/encounters";
import { groupTitle } from "@/lib/his/catalogue";
import { MEDIA_CATEGORY_LABEL } from "@/lib/his/media-formats";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

function Table({ title, rows }: { title: string; rows: [string, number | string][] }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No data yet.</p> : (
        <table className="mt-2 w-full text-sm"><tbody>{rows.map(([k, v]) => <tr key={k} className="border-t"><td className="py-1">{k}</td><td className="py-1 text-right font-medium">{v}</td></tr>)}</tbody></table>
      )}
    </section>
  );
}

// Aggregated indicators only — no patient-level data on this page.
export default async function HisAnalyticsPage() {
  const { facility } = await requireHisPage("VIEW_ANALYTICS");
  const fid = facility.id;
  const since = daysAgo(30);
  const [byDept, byType, byPriority, docsByStatus, docsByGroup, payer, media, admitted, discharged, templateUsage, finalized] = await Promise.all([
    prisma.encounter.groupBy({ by: ["department"], where: { facilityId: fid, registeredAt: { gte: since } }, _count: { _all: true } }),
    prisma.encounter.groupBy({ by: ["type"], where: { facilityId: fid, registeredAt: { gte: since } }, _count: { _all: true } }),
    prisma.encounter.groupBy({ by: ["priority"], where: { facilityId: fid, registeredAt: { gte: since } }, _count: { _all: true } }),
    prisma.clinicalDocument.groupBy({ by: ["status"], where: { facilityId: fid }, _count: { _all: true } }),
    prisma.clinicalDocument.groupBy({ by: ["groupCode"], where: { facilityId: fid }, _count: { _all: true } }),
    prisma.payerCoverage.groupBy({ by: ["category"], where: { facilityId: fid, active: true }, _count: { _all: true } }),
    prisma.medicalMedia.groupBy({ by: ["category"], where: { facilityId: fid, deletedAt: null }, _count: { _all: true } }),
    prisma.admission.count({ where: { facilityId: fid, admissionDate: { gte: since } } }),
    prisma.admission.count({ where: { facilityId: fid, dischargeDate: { gte: since } } }),
    prisma.clinicalDocument.groupBy({ by: ["templateVersionId"], where: { facilityId: fid }, _count: { _all: true }, orderBy: { _count: { templateVersionId: "desc" } }, take: 10 }),
    prisma.clinicalDocument.findMany({ where: { facilityId: fid, finalizedAt: { not: null, gte: since } }, select: { createdAt: true, finalizedAt: true }, take: 2000 }),
  ]);
  const versions = await prisma.clinicalDocumentTemplateVersion.findMany({ where: { id: { in: templateUsage.map((t) => t.templateVersionId) } }, select: { id: true, version: true, template: { select: { name: true } } } });
  const avgHours = finalized.length ? (finalized.reduce((s, d) => s + (d.finalizedAt!.getTime() - d.createdAt.getTime()), 0) / finalized.length / 3_600_000).toFixed(1) : "—";
  const unsigned = docsByStatus.filter((d) => d.status === "PENDING_SIGNATURE" || d.status === "PENDING_REVIEW").reduce((s, d) => s + d._count._all, 0);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold">Operational analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Aggregated counts for the last 30 days (documents and coverage: current totals). No patient-level information is shown.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Table title="Activity (30 days)" rows={[["Admissions", admitted], ["Discharges", discharged], ["Documents finalized", finalized.length], ["Avg. creation → finalization (hours)", avgHours], ["Unsigned / unverified documents", unsigned]]} />
        <Table title="Encounters by department" rows={byDept.map((r) => [r.department ?? "Unassigned", r._count._all])} />
        <Table title="Emergency vs planned (encounter type)" rows={byType.map((r) => [TYPE_LABEL[r.type], r._count._all])} />
        <Table title="Care priority" rows={byPriority.map((r) => [PRIORITY_LABEL[r.priority], r._count._all])} />
        <Table title="Documents by status" rows={docsByStatus.map((r) => [r.status, r._count._all])} />
        <Table title="Documents by group" rows={docsByGroup.map((r) => [`${r.groupCode} · ${groupTitle(r.groupCode)}`, r._count._all])} />
        <Table title="Payer distribution (active)" rows={payer.map((r) => [r.category, r._count._all])} />
        <Table title="Diagnostic media by category" rows={media.map((r) => [MEDIA_CATEGORY_LABEL[r.category], r._count._all])} />
        <Table title="Template usage (top 10)" rows={templateUsage.map((t) => { const v = versions.find((x) => x.id === t.templateVersionId); return [v ? `${v.template.name} v${v.version}` : "—", t._count._all]; })} />
      </div>
    </div>
  );
}
