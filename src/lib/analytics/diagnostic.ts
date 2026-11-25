import { Prisma } from "@prisma/client";
import { db, bucketedCounts, minutesDiff, ts } from "./sql";
import { attachTargets, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { round, summariseDurations } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }

/** Modality is read from the service name; Medic1905 services carry a category (imaging/procedure) but no modality field. */
export const MODALITY_SQL = Prisma.sql`CASE
  WHEN s.name ~* '\\m(x-?ray|radiograph\\w*)\\M' THEN 'X-ray'
  WHEN s.name ~* '\\m(ct|cat scan)\\M' THEN 'CT'
  WHEN s.name ~* '\\mmri\\M' THEN 'MRI'
  WHEN s.name ~* '(ultra ?sound|sonograph|\\musg\\M)' THEN 'Ultrasound'
  WHEN s.name ~* 'mammogra' THEN 'Mammography'
  WHEN s.name ~* '(echocardio|\\mecho\\M)' THEN 'Echocardiography'
  WHEN s.name ~* '(\\mecg\\M|\\mekg\\M|electrocardio)' THEN 'ECG'
  WHEN s.name ~* '\\meeg\\M' THEN 'EEG'
  WHEN s.name ~* '(endoscop|colonoscop|gastroscop|bronchoscop)' THEN 'Endoscopy'
  WHEN s.name ~* 'angiogra' THEN 'Angiography'
  WHEN s.name ~* '(nuclear|scintigra|\\mpet\\M)' THEN 'Nuclear medicine'
  ELSE 'Other diagnostic' END`;

const DX = Prisma.sql`s.category IN ('IMAGING','PROCEDURE')`;
const DONE_STAGES = Prisma.sql`b.workflow_stage IN ('PROCEDURE_COMPLETED','IMAGES_UPLOADED','REPORT_DRAFTED','REVIEWED','RELEASED','AMENDED','ARCHIVED')`;

export async function diagnosticFigures(ctx: Ctx, p: P): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const [req] = await db.$queryRaw<{ requests: number; completed: number; cancelled: number }[]>`
    SELECT count(*)::int AS requests,
      count(*) FILTER (WHERE b.status <> 'CANCELLED' AND ${DONE_STAGES})::int AS completed,
      count(*) FILTER (WHERE b.status = 'CANCELLED')::int AS cancelled
    FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id
    WHERE s.facility_id = ${f}::uuid AND ${DX} AND b.created_at >= ${ts(p.start)} AND b.created_at < ${ts(p.end)}`;
  const [rep] = await db.$queryRaw<{ finalised: number; tat: number[] | null }[]>`
    SELECT count(*)::int AS finalised, array_agg(${minutesDiff(Prisma.sql`r.finalized_at`, Prisma.sql`r.created_at`)} / 60.0) FILTER (WHERE r.finalized_at >= r.created_at) AS tat
    FROM diagnostic_reports r WHERE r.facility_id = ${f}::uuid AND r.finalized_at >= ${ts(p.start)} AND r.finalized_at < ${ts(p.end)}`;
  const t = summariseDurations((rep.tat ?? []).map(Number));
  return {
    dx_requests: fig(req.requests), dx_completed: fig(req.completed), dx_cancelled: fig(req.cancelled),
    dx_reports_finalised: fig(rep.finalised),
    dx_report_tat: fig(t.mean === null ? null : round(t.mean, 1), { sampleSize: t.count, note: t.median !== null ? `Median ${round(t.median, 1)} h; 90% within ${round(t.p90 ?? 0, 1)} h.` : undefined }),
  };
}

export async function diagnosticDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const granularity = chooseGranularity(cur);
  const [current, previous] = await Promise.all([diagnosticFigures(ctx, cur), ctx.range.previous ? diagnosticFigures(ctx, ctx.range.previous) : null]);
  const src = Prisma.sql`FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid AND ${DX} AND b.status <> 'CANCELLED'`;
  const [trend, modality, pending, amended, equip, specialists, stages] = await Promise.all([
    bucketedCounts(src, Prisma.sql`b.created_at`, cur, granularity, ctx.scope.calendar),
    db.$queryRaw<{ label: string; requests: number; completed: number; cancelled: number; tat_h: number | null; pending: number }[]>`
      SELECT ${MODALITY_SQL} AS label, count(*)::int AS requests, count(*) FILTER (WHERE b.status <> 'CANCELLED' AND ${DONE_STAGES})::int AS completed,
        count(*) FILTER (WHERE b.status = 'CANCELLED')::int AS cancelled,
        round((avg(${minutesDiff(Prisma.sql`r.finalized_at`, Prisma.sql`r.created_at`)}) FILTER (WHERE r.finalized_at >= r.created_at) / 60.0)::numeric, 1)::float AS tat_h,
        count(*) FILTER (WHERE r.status IN ('DRAFT','AWAITING_VERIFICATION'))::int AS pending
      FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id LEFT JOIN diagnostic_reports r ON r.booking_id = b.id
      WHERE s.facility_id = ${f}::uuid AND ${DX} AND b.created_at >= ${ts(cur.start)} AND b.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM diagnostic_reports r WHERE r.facility_id = ${f}::uuid AND r.status IN ('DRAFT','AWAITING_VERIFICATION')`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM diagnostic_reports r WHERE r.facility_id = ${f}::uuid AND r.updated_at >= ${ts(cur.start)} AND r.updated_at < ${ts(cur.end)} AND (r.status = 'AMENDED' OR EXISTS (SELECT 1 FROM diagnostic_report_versions v WHERE v.report_id = r.id AND v.version > 1))`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT e.status::text AS label, count(*)::int AS n FROM lab_equipment e WHERE e.facility_id = ${f}::uuid GROUP BY 1`,
    db.$queryRaw<{ name: string | null; verified: number; signed: number }[]>`
      SELECT coalesce(max(st.full_name), 'Staff member') AS name, count(*) FILTER (WHERE r.verified_by_id = u.uid)::int AS verified, count(*) FILTER (WHERE r.signed_by_id = u.uid)::int AS signed
      FROM diagnostic_reports r CROSS JOIN LATERAL (VALUES (r.verified_by_id), (r.signed_by_id)) AS u(uid)
      JOIN facility_staff st ON st.user_id = u.uid AND st.facility_id = ${f}::uuid
      WHERE r.facility_id = ${f}::uuid AND r.finalized_at >= ${ts(cur.start)} AND r.finalized_at < ${ts(cur.end)} GROUP BY u.uid ORDER BY 1`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT b.workflow_stage::text AS label, count(*)::int AS n FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid AND ${DX} AND b.status <> 'CANCELLED' AND b.created_at >= ${ts(cur.start)} AND b.created_at < ${ts(cur.end)} GROUP BY 1`,
  ]);
  const equipTotal = equip.reduce((s, r) => s + r.n, 0);
  let kpis: KpiValue[] = [
    makeKpi("dx_requests", current.dx_requests, previous?.dx_requests ?? null, { drill: "dx.requests", spark: trend.map((x) => x.y) }),
    makeKpi("dx_completed", current.dx_completed, previous?.dx_completed ?? null, { drill: "dx.requests" }),
    makeKpi("dx_cancelled", current.dx_cancelled, previous?.dx_cancelled ?? null),
    makeKpi("dx_reports_pending", fig(pending[0].n), null, { drill: "dx.pending-reports" }),
    makeKpi("dx_reports_finalised", current.dx_reports_finalised, previous?.dx_reports_finalised ?? null),
    makeKpi("dx_report_tat", current.dx_report_tat, previous?.dx_report_tat ?? null),
    makeKpi("dx_report_amended", fig(amended[0].n), null),
    makeKpi("dx_equipment_available", figRatio(equip.find((r) => r.label === "OPERATIONAL")?.n ?? 0, equipTotal), null),
  ];
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "volume", title: "Requests received", question: "Is imaging demand rising?", visual: { type: "line", unit: "count", series: [{ name: "Requests", points: trend }] }, drill: "dx.requests" },
    { id: "modality", title: "Performance by modality", question: "Which modalities carry the volume and the reporting delay?", visual: { type: "table", columns: [{ key: "label", label: "Modality" }, { key: "requests", label: "Requests", align: "right" }, { key: "completed", label: "Completed", align: "right" }, { key: "cancelled", label: "Cancelled", align: "right" }, { key: "tat", label: "Report TAT (h)", align: "right" }, { key: "pending", label: "Reports pending", align: "right" }], rows: modality.map((r) => ({ label: r.label, requests: r.requests, completed: r.completed, cancelled: r.cancelled, tat: r.tat_h, pending: r.pending })), footnote: "Modality is read from the service name (for example 'CT chest'), because services carry no modality field." } },
    { id: "stages", title: "Where examinations are in the workflow", question: "Where do examinations wait?", visual: { type: "bars", unit: "count", items: stages.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) } },
    { id: "equipment", title: "Equipment status", question: "Is any scanner out of service?", visual: { type: "donut", unit: "count", items: equip.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) }, drill: "lab.equipment" },
  ];
  if (specialists.length) sections.push({ id: "specialists", title: "Reports verified and signed (alphabetical — not a ranking)", question: "How is reporting work distributed?", visual: { type: "table", columns: [{ key: "name", label: "Staff member" }, { key: "verified", label: "Verified", align: "right" }, { key: "signed", label: "Signed", align: "right" }], rows: specialists.map((r) => ({ name: r.name, verified: r.verified, signed: r.signed })), footnote: "Report complexity differs by modality; volume is workload, not quality." } });
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  return {
    kpis, sections,
    gaps: [
      gap("Examination scheduling: slots, unused capacity, rescheduled examinations", "Bookings have a preferred time but there is no slot or capacity model."),
      gap("Equipment utilisation and per-modality equipment", "Equipment is not linked to examinations."),
      gap("Emergency vs routine examinations and waiting/examination duration", "Bookings carry no priority, arrival or start/end times."),
      gap("Repeat examination rate", "Repeat examinations are not flagged."),
      gap("Critical findings, notification and acknowledgement times, corrected-report reasons", "Diagnostic reports have no critical-finding workflow (laboratory critical alerts do)."),
      gap("Reporting turnaround from examination completion", "Examination completion is not timestamped; report creation is the start event."),
    ],
  };
}
