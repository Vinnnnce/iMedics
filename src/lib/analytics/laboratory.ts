import { Prisma } from "@prisma/client";
import { db, bucketedCounts, bucketedAverageMinutes, minutesDiff, ts } from "./sql";
import { attachTargets, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { round, summariseDurations } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }

const mean = (a: number[] | null) => { const s = summariseDurations((a ?? []).map(Number)); return { v: s.mean === null ? null : round(s.mean, 1), n: s.count, median: s.median, p90: s.p90 }; };

export async function laboratoryFigures(ctx: Ctx, p: P): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const inRange = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${ts(p.start)} AND ${Prisma.raw(col)} < ${ts(p.end)}`;
  const [[orders], [spec], [reject], [res], [crit]] = await Promise.all([
    db.$queryRaw<{ orders: number; tests: number }[]>`SELECT count(*)::int AS orders, coalesce(sum((SELECT count(*) FROM lab_order_items i WHERE i.order_id = o.id)), 0)::int AS tests FROM lab_orders o WHERE o.performing_facility_id = ${f}::uuid AND ${inRange("o.created_at")}`,
    db.$queryRaw<{ collected: number; received: number; req_to_coll: number[] | null; coll_to_recv: number[] | null }[]>`
      SELECT count(*) FILTER (WHERE s.collected_at >= ${ts(p.start)} AND s.collected_at < ${ts(p.end)})::int AS collected,
             count(*) FILTER (WHERE s.received_at >= ${ts(p.start)} AND s.received_at < ${ts(p.end)})::int AS received,
             array_agg(${minutesDiff(Prisma.sql`s.collected_at`, Prisma.sql`o.created_at`)}) FILTER (WHERE s.collected_at >= ${ts(p.start)} AND s.collected_at < ${ts(p.end)} AND s.collected_at >= o.created_at) AS req_to_coll,
             array_agg(${minutesDiff(Prisma.sql`s.received_at`, Prisma.sql`s.collected_at`)}) FILTER (WHERE s.received_at >= ${ts(p.start)} AND s.received_at < ${ts(p.end)} AND s.collected_at IS NOT NULL AND s.received_at >= s.collected_at) AS coll_to_recv
      FROM specimens s JOIN lab_orders o ON o.id = s.lab_order_id WHERE s.facility_id = ${f}::uuid`,
    db.$queryRaw<{ received: number; rejected: number; recollect: number }[]>`SELECT count(*)::int AS received, count(*) FILTER (WHERE s.status IN ('REJECTED','RECOLLECTION_REQUESTED'))::int AS rejected, count(*) FILTER (WHERE s.status = 'RECOLLECTION_REQUESTED')::int AS recollect FROM specimens s WHERE s.facility_id = ${f}::uuid AND ${inRange("s.received_at")}`,
    db.$queryRaw<{ entered: number; verified: number; entry_to_ver: number[] | null; overall: number[] | null }[]>`
      SELECT count(*) FILTER (WHERE r.created_at >= ${ts(p.start)} AND r.created_at < ${ts(p.end)})::int AS entered,
             count(*) FILTER (WHERE r.verified_at >= ${ts(p.start)} AND r.verified_at < ${ts(p.end)})::int AS verified,
             array_agg(${minutesDiff(Prisma.sql`r.verified_at`, Prisma.sql`r.created_at`)}) FILTER (WHERE r.verified_at >= ${ts(p.start)} AND r.verified_at < ${ts(p.end)} AND r.verified_at >= r.created_at) AS entry_to_ver,
             array_agg(${minutesDiff(Prisma.sql`r.verified_at`, Prisma.sql`o.created_at`)}) FILTER (WHERE r.verified_at >= ${ts(p.start)} AND r.verified_at < ${ts(p.end)} AND r.verified_at >= o.created_at) AS overall
      FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid`,
    db.$queryRaw<{ ack: number[] | null; total: number; unacked: number }[]>`
      SELECT array_agg(${minutesDiff(Prisma.sql`c."acknowledgedAt"`, Prisma.sql`c.created_at`)}) FILTER (WHERE c."acknowledgedAt" IS NOT NULL AND c."acknowledgedAt" >= c.created_at) AS ack,
             count(*)::int AS total, count(*) FILTER (WHERE c."acknowledgedAt" IS NULL)::int AS unacked
      FROM critical_result_alerts c JOIN lab_orders o ON o.id = c.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND ${inRange("c.created_at")}`,
  ]);
  const a = mean(spec.req_to_coll), b = mean(spec.coll_to_recv), c = mean(res.entry_to_ver), d = mean(res.overall), e = mean(crit.ack);
  return {
    lab_orders: fig(orders.orders), lab_tests_requested: fig(orders.tests),
    lab_specimens_collected: fig(spec.collected), lab_specimens_received: fig(spec.received),
    lab_rejection_rate: figRatio(reject.rejected, reject.received),
    lab_recollection_rate: figRatio(reject.recollect, reject.received),
    lab_results_entered: fig(res.entered), lab_results_verified: fig(res.verified),
    lab_tat_collection: fig(a.v, { sampleSize: a.n }), lab_tat_reception: fig(b.v, { sampleSize: b.n }),
    lab_tat_verification: fig(c.v, { sampleSize: c.n }), lab_tat_overall: fig(d.v, { sampleSize: d.n, note: d.median !== null ? `Median ${d.median} min; 90% within ${d.p90} min.` : undefined }),
    lab_critical_ack_time: fig(e.v, { sampleSize: e.n, note: crit.unacked ? `${crit.unacked} critical alert(s) in the period are still unacknowledged.` : undefined }),
  };
}

export async function laboratoryDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const cal = ctx.scope.calendar;
  const granularity = chooseGranularity(cur);
  const [current, previous] = await Promise.all([laboratoryFigures(ctx, cur), ctx.range.previous ? laboratoryFigures(ctx, ctx.range.previous) : null]);
  const orderSrc = Prisma.sql`FROM lab_orders o WHERE o.performing_facility_id = ${f}::uuid`;
  const verSrc = Prisma.sql`FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.verified_at IS NOT NULL`;
  const [orderTrend, tatTrend, live, byCat, qc, equip, equipDue, downtime, reagents, specStatus, priority] = await Promise.all([
    bucketedCounts(orderSrc, Prisma.sql`o.created_at`, cur, granularity, cal),
    bucketedAverageMinutes(verSrc, Prisma.sql`r.verified_at`, minutesDiff(Prisma.sql`r.verified_at`, Prisma.sql`o.created_at`), cur, granularity, cal),
    db.$queryRaw<{ pending_spec: number; pending_res: number }[]>`SELECT (SELECT count(*) FROM specimens s WHERE s.facility_id = ${f}::uuid AND s.status IN ('PENDING_COLLECTION','COLLECTED','RECEIVED'))::int AS pending_spec, (SELECT count(*) FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.status IN ('PENDING','PENDING_AI_ANALYSIS','AI_ANALYSIS_COMPLETE'))::int AS pending_res`,
    db.$queryRaw<{ label: string; results: number; verified: number; mean_min: number | null; critical: number }[]>`
      SELECT r.category::text AS label, count(*)::int AS results, count(r.verified_at)::int AS verified,
        round(avg(${minutesDiff(Prisma.sql`r.verified_at`, Prisma.sql`o.created_at`)}) FILTER (WHERE r.verified_at >= o.created_at)::numeric, 1)::float AS mean_min,
        count(c.id)::int AS critical
      FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id LEFT JOIN critical_result_alerts c ON c.lab_result_id = r.id
      WHERE o.performing_facility_id = ${f}::uuid AND r.created_at >= ${ts(cur.start)} AND r.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ runs: number; passed: number; failed: number }[]>`SELECT count(*)::int AS runs, count(*) FILTER (WHERE q.result = 'PASS')::int AS passed, count(*) FILTER (WHERE q.result = 'FAIL')::int AS failed FROM lab_quality_control_runs q WHERE q.facility_id = ${f}::uuid AND q.performed_at >= ${ts(cur.start)} AND q.performed_at < ${ts(cur.end)}`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT e.status::text AS label, count(*)::int AS n FROM lab_equipment e WHERE e.facility_id = ${f}::uuid GROUP BY 1`,
    db.$queryRaw<{ with_due: number; overdue: number }[]>`SELECT count(*) FILTER (WHERE e.next_service_due_at IS NOT NULL)::int AS with_due, count(*) FILTER (WHERE e.next_service_due_at < ${ts(ctx.now)})::int AS overdue FROM lab_equipment e WHERE e.facility_id = ${f}::uuid`,
    db.$queryRaw<{ hours: number | null }[]>`SELECT sum(m.downtime_hours)::float AS hours FROM lab_equipment_maintenance m JOIN lab_equipment e ON e.id = m.equipment_id WHERE e.facility_id = ${f}::uuid AND m.performed_at >= ${ts(cur.start)} AND m.performed_at < ${ts(cur.end)}`,
    db.$queryRaw<{ total: number; low: number; expiring: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE r.quantity <= r.min_stock_level)::int AS low, count(*) FILTER (WHERE r.expires_at IS NOT NULL AND r.expires_at <= ${ts(new Date(ctx.now.getTime() + 30 * 86_400_000))})::int AS expiring FROM lab_reagents r WHERE r.facility_id = ${f}::uuid`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT s.status::text AS label, count(*)::int AS n FROM specimens s WHERE s.facility_id = ${f}::uuid AND coalesce(s.received_at, s.collected_at, s.created_at) >= ${ts(cur.start)} AND coalesce(s.received_at, s.collected_at, s.created_at) < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT o.priority::text AS label, count(*)::int AS n FROM lab_orders o WHERE o.performing_facility_id = ${f}::uuid AND o.created_at >= ${ts(cur.start)} AND o.created_at < ${ts(cur.end)} GROUP BY 1`,
  ]);

  const equipTotal = equip.reduce((s, r) => s + r.n, 0);
  const operational = equip.find((r) => r.label === "OPERATIONAL")?.n ?? 0;
  const dueRow = equipDue[0];
  let kpis: KpiValue[] = [
    makeKpi("lab_orders", current.lab_orders, previous?.lab_orders ?? null, { drill: "lab.orders", spark: orderTrend.map((x) => x.y) }),
    makeKpi("lab_tests_requested", current.lab_tests_requested, previous?.lab_tests_requested ?? null),
    makeKpi("lab_specimens_collected", current.lab_specimens_collected, previous?.lab_specimens_collected ?? null, { drill: "lab.specimens" }),
    makeKpi("lab_specimens_received", current.lab_specimens_received, previous?.lab_specimens_received ?? null, { drill: "lab.specimens" }),
    makeKpi("lab_rejection_rate", current.lab_rejection_rate, previous?.lab_rejection_rate ?? null, { drill: "lab.rejected" }),
    makeKpi("lab_recollection_rate", current.lab_recollection_rate, previous?.lab_recollection_rate ?? null),
    makeKpi("lab_results_entered", current.lab_results_entered, previous?.lab_results_entered ?? null),
    makeKpi("lab_results_verified", current.lab_results_verified, previous?.lab_results_verified ?? null),
    makeKpi("lab_results_pending", fig(live[0].pending_res), null, { drill: "lab.pending-results" }),
    makeKpi("lab_pending_specimens", fig(live[0].pending_spec), null, { drill: "lab.pending-specimens" }),
    makeKpi("lab_tat_collection", current.lab_tat_collection, previous?.lab_tat_collection ?? null),
    makeKpi("lab_tat_reception", current.lab_tat_reception, previous?.lab_tat_reception ?? null),
    makeKpi("lab_tat_verification", current.lab_tat_verification, previous?.lab_tat_verification ?? null),
    makeKpi("lab_tat_overall", current.lab_tat_overall, previous?.lab_tat_overall ?? null),
    makeKpi("lab_critical_ack_time", current.lab_critical_ack_time, previous?.lab_critical_ack_time ?? null, { drill: "lab.critical" }),
    makeKpi("lab_qc_pass_rate", figRatio(qc[0].passed, qc[0].runs), null, { note: qc[0].failed ? `${qc[0].failed} failed run(s) in the period.` : undefined, drill: "lab.qc" }),
    makeKpi("lab_equipment_available", figRatio(operational, equipTotal), null),
    makeKpi("lab_calibration_compliance", figRatio((dueRow?.with_due ?? 0) - (dueRow?.overdue ?? 0), dueRow?.with_due ?? 0), null, { note: downtime[0].hours ? `${downtime[0].hours} hours of logged equipment downtime in the period.` : undefined }),
    makeKpi("lab_reagents_low", fig(reagents[0].low), null, { drill: "lab.reagents" }),
    makeKpi("lab_reagents_expiring", fig(reagents[0].expiring), null, { drill: "lab.reagents" }),
  ];
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "orders-trend", title: "Requests received", question: "Is laboratory demand rising?", visual: { type: "line", unit: "count", series: [{ name: "Requests", points: orderTrend }] }, drill: "lab.orders" },
    { id: "tat-trend", title: "Request → verified result time", question: "Are results getting slower?", visual: { type: "line", unit: "minutes", series: [{ name: "Mean minutes", points: tatTrend }] }, note: "Periods with no verified results are blank, not zero." },
    { id: "by-category", title: "Workload and turnaround by sample category", question: "Which sample types take longest, and which carry critical results?", visual: { type: "table", columns: [{ key: "label", label: "Category" }, { key: "results", label: "Results", align: "right" }, { key: "verified", label: "Verified", align: "right" }, { key: "mean", label: "Mean TAT (min)", align: "right" }, { key: "critical", label: "Critical", align: "right" }], rows: byCat.map((r) => ({ label: r.label.toLowerCase(), results: r.results, verified: r.verified, mean: r.mean_min, critical: r.critical })), footnote: "Medic1905 categorises results by sample type (blood, urine, …), not by laboratory discipline such as haematology or microbiology." } },
    { id: "specimens", title: "Specimen status", question: "How many specimens are stuck or rejected?", visual: { type: "donut", unit: "count", items: specStatus.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) }, drill: "lab.specimens" },
    { id: "priority", title: "Requests by priority", question: "How much work is urgent?", visual: { type: "donut", unit: "count", items: priority.map((r) => ({ label: r.label.toLowerCase(), value: r.n })) } },
    { id: "equipment", title: "Equipment status", question: "How much of the equipment is available?", visual: { type: "donut", unit: "count", items: equip.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) }, drill: "lab.equipment" },
  ];
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  return {
    kpis, sections,
    gaps: [
      gap("Per-department analytics (haematology, microbiology, biochemistry, histopathology, …)", "Results carry a sample category, not a laboratory section. Section-level analytics need a section on each test."),
      gap("Reception → processing and verification → release times", "Processing and release are not timestamped."),
      gap("Sample recollection rate beyond status", "Recollection is a status; the replacement specimen is not linked to the original."),
      gap("External quality assessment, nonconformities, corrective actions, corrected-report counts", "Not recorded (internal QC runs only)."),
      gap("Reagent consumption, wastage and lot usage; reagent demand forecast", "Reagents hold a current balance, with no consumption transactions."),
      gap("Turnaround targets per investigation", "Targets can be set per metric; per-test targets are not available because results are not linked to catalogue tests."),
      gap("Tests by referring facility and laboratory staff workload", "Order-to-requester facility joins are available but not yet surfaced; staff workload needs per-step actor timestamps."),
    ],
  };
}
