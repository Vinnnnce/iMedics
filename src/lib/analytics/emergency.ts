import { Prisma } from "@prisma/client";
import { db, bucketedCounts, minutesDiff, ts } from "./sql";
import { attachTargets, encounterDeptSql, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { round, summariseDurations } from "./stats";
import { liveHospital } from "./hospital";
import { getMetric } from "./registry";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }

const ED = Prisma.sql`e.type = 'EMERGENCY_DEPARTMENT'`;

export async function emergencyFigures(ctx: Ctx, p: P): Promise<Figures & { _durations?: never }> {
  const f = ctx.scope.facility.id;
  const dept = encounterDeptSql(ctx);
  const base = Prisma.sql`FROM encounters e WHERE e.facility_id = ${f}::uuid AND ${ED} AND e.registered_at >= ${ts(p.start)} AND e.registered_at < ${ts(p.end)}${dept}`;
  const [row] = await db.$queryRaw<{ arrivals: number; ambulance: number; critical: number; admitted: number; discharged: number; transferred: number; dna: number; triage: number[] | null; assess: number[] | null; los: number[] | null }[]>`
    SELECT count(*) FILTER (WHERE e.status <> 'CANCELLED')::int AS arrivals,
      count(*) FILTER (WHERE e.status <> 'CANCELLED' AND lower(coalesce(e.arrival_mode, '')) LIKE '%ambulance%')::int AS ambulance,
      count(*) FILTER (WHERE e.status <> 'CANCELLED' AND e.priority = 'EMERGENCY')::int AS critical,
      count(*) FILTER (WHERE e.admission_id IS NOT NULL)::int AS admitted,
      count(*) FILTER (WHERE e.status = 'DISCHARGED')::int AS discharged,
      count(*) FILTER (WHERE e.status = 'TRANSFERRED')::int AS transferred,
      count(*) FILTER (WHERE e.status = 'DID_NOT_ATTEND')::int AS dna,
      array_agg(${minutesDiff(Prisma.sql`e.triaged_at`, Prisma.sql`e.registered_at`)}) FILTER (WHERE e.triaged_at IS NOT NULL AND e.triaged_at >= e.registered_at) AS triage,
      array_agg(${minutesDiff(Prisma.sql`fa.first_at`, Prisma.sql`e.registered_at`)}) FILTER (WHERE fa.first_at IS NOT NULL AND fa.first_at >= e.registered_at) AS assess,
      array_agg(${minutesDiff(Prisma.sql`e.closed_at`, Prisma.sql`e.registered_at`)}) FILTER (WHERE e.closed_at IS NOT NULL AND e.closed_at >= e.registered_at) AS los
    FROM encounters e
    LEFT JOIN LATERAL (SELECT min(s.created_at) AS first_at FROM encounter_status_events s WHERE s.encounter_id = e.id AND s.to_status = 'UNDER_ASSESSMENT') fa ON true
    WHERE e.facility_id = ${f}::uuid AND ${ED} AND e.registered_at >= ${ts(p.start)} AND e.registered_at < ${ts(p.end)}${dept}`;
  void base;
  const triage = summariseDurations((row.triage ?? []).map(Number));
  const assess = summariseDurations((row.assess ?? []).map(Number));
  const los = summariseDurations((row.los ?? []).map(Number));
  return {
    emergency_arrivals: fig(row.arrivals),
    ed_time_to_triage: fig(triage.mean === null ? null : round(triage.mean, 1), { sampleSize: triage.count, note: row.arrivals > triage.count ? `${row.arrivals - triage.count} arrival(s) have no triage time and are left out, not counted as zero.` : undefined }),
    ed_time_to_assessment: fig(assess.mean === null ? null : round(assess.mean, 1), { sampleSize: assess.count }),
    ed_length_of_stay: fig(los.mean === null ? null : round(los.mean, 1), { sampleSize: los.count }),
    ed_left_without_assessment: fig(row.dna),
    _ed_extra: { value: null, numerator: row.ambulance, denominator: row.critical, sampleSize: row.admitted, note: `${row.discharged}|${row.transferred}` },
  } as Figures;
}

export async function emergencyDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const [cf, pf] = await Promise.all([emergencyFigures(ctx, cur), ctx.range.previous ? emergencyFigures(ctx, ctx.range.previous) : null]);
  const extra = cf._ed_extra as unknown as { numerator: number; denominator: number; sampleSize: number; note: string };
  const [discharged, transferred] = extra.note.split("|").map(Number);
  const granularity = chooseGranularity(cur);
  const dept = encounterDeptSql(ctx);
  const [trend, triage, status] = await Promise.all([
    bucketedCounts(Prisma.sql`FROM encounters e WHERE e.facility_id = ${f}::uuid AND ${ED} AND e.status <> 'CANCELLED'${dept}`, Prisma.sql`e.registered_at`, cur, granularity, ctx.scope.calendar),
    db.$queryRaw<{ label: string; n: number }[]>`SELECT coalesce(nullif(btrim(e.triage_category), ''), 'Not triaged') AS label, count(*)::int AS n FROM encounters e WHERE e.facility_id = ${f}::uuid AND ${ED} AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(cur.start)} AND e.registered_at < ${ts(cur.end)}${dept} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT CASE WHEN e.admission_id IS NOT NULL THEN 'Admitted' WHEN e.status = 'DISCHARGED' THEN 'Discharged' WHEN e.status = 'TRANSFERRED' THEN 'Transferred' WHEN e.status = 'DID_NOT_ATTEND' THEN 'Left without assessment' ELSE 'Still in department' END AS label, count(*)::int AS n FROM encounters e WHERE e.facility_id = ${f}::uuid AND ${ED} AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(cur.start)} AND e.registered_at < ${ts(cur.end)}${dept} GROUP BY 1`,
  ]);
  const keys = ["emergency_arrivals", "ed_time_to_triage", "ed_time_to_assessment", "ed_length_of_stay", "ed_left_without_assessment"];
  let kpis: KpiValue[] = keys.map((k) => makeKpi(k, cf[k], pf?.[k] ?? null, { drill: "emergency.arrivals" }));
  const admittedFig = figRatio(extra.sampleSize, cf.emergency_arrivals.value ?? 0);
  kpis.push({ key: "ed_conversion", label: "Emergency admissions from ED", value: admittedFig.value, unit: "percent", betterWhen: "NEUTRAL", numerator: admittedFig.numerator, denominator: admittedFig.denominator, note: "ED arrivals who were admitted, as a share of ED arrivals.", sampleSize: admittedFig.denominator });
  kpis.push({ key: "ed_ambulance", label: "Ambulance arrivals", value: extra.numerator, unit: "count", betterWhen: "NEUTRAL", note: "Where the arrival mode contains 'ambulance'." }, { key: "ed_critical", label: "Critical-priority cases", value: extra.denominator, unit: "count", betterWhen: "NEUTRAL" });
  kpis.push({ key: "ed_discharged_transferred", label: "Discharged / transferred from ED", value: discharged + transferred, unit: "count", betterWhen: "NEUTRAL", note: `${discharged} discharged, ${transferred} transferred.` });
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "arrivals-trend", title: "Emergency arrivals", question: "How is emergency demand changing?", visual: { type: "line", unit: "count", series: [{ name: "Arrivals", points: trend }] }, drill: "emergency.arrivals" },
    { id: "triage", title: "Triage categories", question: "How acute is the case mix arriving?", visual: { type: "donut", unit: "count", items: triage.map((r) => ({ label: r.label, value: r.n })) }, note: "Triage categories follow the hospital's own approved protocol." },
    { id: "disposition", title: "Where emergency patients go", question: "How many arrivals end up admitted, discharged or leaving?", visual: { type: "bars", unit: "count", items: status.map((r) => ({ label: r.label, value: r.n })) } },
  ];
  const t = targetsSection(kpis); if (t) sections.push(t);
  return {
    kpis, sections,
    gaps: [
      gap("Time to treatment", "Treatment start is not a distinct timestamp in the encounter workflow."),
      gap("Emergency-department deaths", "The encounter workflow records no death outcome; deaths are not inferred."),
      gap("Ambulance handover time", "Only the arrival mode is recorded."),
    ],
  };
  void getMetric;
}

/* ───────────────────────── command centre ───────────────────────── */

export async function commandCentre(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const f = ctx.scope.facility.id;
  const live = await liveHospital(ctx);
  const overdueMinutes = (await db.hospitalSettings.findUnique({ where: { facilityId: f }, select: { overdueMinutes: true } }))?.overdueMinutes ?? 60;
  const dept = encounterDeptSql(ctx);
  const [[ov], [tasks], [alerts], [staffing], priorities] = await Promise.all([
    db.$queryRaw<{ overdue: number; reassess: number }[]>`SELECT count(*) FILTER (WHERE e.closed_at IS NULL AND e.status_changed_at < ${ts(new Date(ctx.now.getTime() - overdueMinutes * 60_000))} AND e.status NOT IN ('AWAITING_DISCHARGE'))::int AS overdue, count(*) FILTER (WHERE e.closed_at IS NULL AND e.reassessment_due_at IS NOT NULL AND e.reassessment_due_at < ${ts(ctx.now)})::int AS reassess FROM encounters e WHERE e.facility_id = ${f}::uuid${dept}`,
    db.$queryRaw<{ overdue: number }[]>`SELECT count(*)::int AS overdue FROM nursing_task t WHERE t.facility_id = ${f}::uuid AND t.status <> 'COMPLETED' AND t.due_at < ${ts(ctx.now)}`,
    db.$queryRaw<{ open: number; escalated: number }[]>`SELECT count(*) FILTER (WHERE c.status IN ('SENT','ESCALATED'))::int AS open, count(*) FILTER (WHERE c.status = 'ESCALATED')::int AS escalated FROM critical_result_alerts c WHERE c.ordering_facility_id = ${f}::uuid`,
    db.$queryRaw<{ nurses: number }[]>`SELECT count(*)::int AS nurses FROM facility_staff s WHERE s.facility_id = ${f}::uuid AND s."facilityRole" = 'NURSE' AND s.status = 'ACTIVE'`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT e.priority::text AS label, count(*)::int AS n FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.closed_at IS NULL${dept} GROUP BY 1`,
  ]);
  const occupied = live.wards.reduce((s, w) => s + w.occupied, 0);
  const inService = live.wards.reduce((s, w) => s + w.inService, 0);
  const free = inService - occupied;
  const ratio = staffing.nurses > 0 ? round(live.activeAdmissions / staffing.nurses, 1) : null;
  const k = (key: string, label: string, value: number | null, unit: KpiValue["unit"], better: KpiValue["betterWhen"], extra: Partial<KpiValue> = {}): KpiValue => ({ key, label, value, unit, betterWhen: better, ...extra });
  const kpis: KpiValue[] = [
    k("cc_occupied", "Beds occupied", occupied, "count", "NEUTRAL", { denominator: inService, numerator: occupied, drill: "hospital.beds", note: `${free} free of ${inService} in-service beds.` }),
    k("cc_open_emergency", "Open emergency patients", live.openEmergency, "count", "NEUTRAL", { drill: "emergency.arrivals" }),
    k("cc_awaiting_admission", "Awaiting a bed", live.awaitingAdmission, "count", "LOWER", { drill: "hospital.awaiting-admission" }),
    k("cc_pending_discharge", "Pending discharges", live.awaitingDischarge, "count", "LOWER", { drill: "hospital.awaiting-discharge" }),
    k("cc_stalled", "Encounters stalled", ov.overdue, "count", "LOWER", { note: `No workflow update for more than ${overdueMinutes} minutes (hospital setting).` }),
    k("cc_reassess", "Reassessments overdue", ov.reassess, "count", "LOWER"),
    k("cc_overdue_tasks", "Overdue nursing tasks", tasks.overdue, "count", "LOWER"),
    k("critical_alerts_open", "Unacknowledged critical alerts", alerts.open, "count", "LOWER", { note: alerts.escalated ? `${alerts.escalated} escalated.` : undefined }),
    k("cc_staffing", "Admitted patients per active nurse", ratio, "ratio", "NEUTRAL", { note: "Whole-facility ratio from staff records. Shift rosters are not recorded, so on-duty staffing cannot be calculated." }),
  ];
  const alertList = kpis.filter((x) => ["cc_awaiting_admission", "cc_stalled", "cc_overdue_tasks", "critical_alerts_open", "cc_reassess"].includes(x.key) && (x.value ?? 0) > 0)
    .map((x) => ({ alert: x.label, count: x.value, detail: x.note ?? "" }));
  const sections: Section[] = [
    { id: "alerts", title: "Operational alerts", question: "What needs attention right now?", visual: { type: "table", columns: [{ key: "alert", label: "Alert" }, { key: "count", label: "Count", align: "right" }, { key: "detail", label: "Detail" }], rows: alertList, footnote: alertList.length ? undefined : "No operational alerts." } },
    { id: "bed-map", title: "Bed occupancy map", question: "Where are beds free, reserved, being cleaned or isolated?", visual: { type: "beds", wards: live.wards }, drill: "hospital.beds" },
    { id: "open-priority", title: "Open encounters by priority", question: "How many urgent patients are still in the hospital's care?", visual: { type: "donut", unit: "count", items: priorities.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) } },
  ];
  return { kpis, sections, gaps: [gap("On-duty staffing and acuity-adjusted staffing pressure", "Shift rosters and patient acuity scores are not recorded.")] };
}
