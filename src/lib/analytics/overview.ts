import { db, ts } from "./sql";
import { attachTargets, fig, makeKpi, targetsSection, type Ctx } from "./core";
import { hospitalFigures, liveHospital, liveBedFigures } from "./hospital";
import { laboratoryFigures } from "./laboratory";
import { nursingFigures } from "./nursing";
import { pharmacyFigures } from "./pharmacy";
import { diagnosticFigures } from "./diagnostic";
import { financialFigures } from "./management";
import type { DashboardPayload, KpiValue, Section } from "./types";

export async function overviewDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const f = ctx.scope.facility.id;
  const kind = ctx.scope.kind;
  const cur = ctx.range.current, prev = ctx.range.previous;
  const since90 = new Date(ctx.now.getTime() - 90 * 86_400_000);
  const [[totals], [staff], [pending]] = await Promise.all([
    db.$queryRaw<{ registered: number; active: number }[]>`
      WITH c AS (SELECT patient_id, registered_at AS at FROM encounters WHERE facility_id = ${f}::uuid AND status NOT IN ('CANCELLED','DID_NOT_ATTEND')
        UNION ALL SELECT patient_id, admission_date FROM admissions WHERE facility_id = ${f}::uuid AND status <> 'CANCELLED'
        UNION ALL SELECT o.patient_id, o.created_at FROM lab_orders o WHERE o.performing_facility_id = ${f}::uuid
        UNION ALL SELECT b.patient_id, b.created_at FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid AND b.status <> 'CANCELLED'
        UNION ALL SELECT patient_id, created_at FROM medication_order WHERE facility_id = ${f}::uuid AND status <> 'DRAFT')
      SELECT count(DISTINCT patient_id)::int AS registered, count(DISTINCT patient_id) FILTER (WHERE at >= ${ts(since90)})::int AS active FROM c`,
    db.$queryRaw<{ total: number; doctors: number; nurses: number; departments: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE s."facilityRole" IN ('DOCTOR','SURGEON'))::int AS doctors, count(*) FILTER (WHERE s."facilityRole" = 'NURSE')::int AS nurses, (SELECT count(*) FROM facility_departments d WHERE d.facility_id = ${f}::uuid AND d.active)::int AS departments FROM facility_staff s WHERE s.facility_id = ${f}::uuid AND s.status = 'ACTIVE'`,
    db.$queryRaw<{ docs: number; tasks: number; rx: number; results: number; reports: number; summaries: number; alerts: number }[]>`SELECT
      (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.deleted_at IS NULL AND d.status IN ('DRAFT','PENDING_REVIEW','PENDING_SIGNATURE'))::int AS docs,
      (SELECT count(*) FROM nursing_task t WHERE t.facility_id = ${f}::uuid AND t.status <> 'COMPLETED')::int AS tasks,
      (SELECT count(*) FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.status IN ('SUBMITTED','REVIEWED'))::int AS rx,
      (SELECT count(*) FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.status IN ('PENDING','PENDING_AI_ANALYSIS','AI_ANALYSIS_COMPLETE'))::int AS results,
      (SELECT count(*) FROM diagnostic_reports r WHERE r.facility_id = ${f}::uuid AND r.status IN ('DRAFT','AWAITING_VERIFICATION'))::int AS reports,
      (SELECT count(*) FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND (a.epicrisis IS NULL OR btrim(a.epicrisis) = ''))::int AS summaries,
      (SELECT count(*) FROM critical_result_alerts c WHERE c.ordering_facility_id = ${f}::uuid AND c.status IN ('SENT','ESCALATED'))::int AS alerts`,
  ]);
  const k = (key: string, label: string, value: number, extra: Partial<KpiValue> = {}): KpiValue => ({ key, label, value, unit: "count", betterWhen: "NEUTRAL", ...extra });
  const kpis: KpiValue[] = [
    k("ov_patients", "Patients registered with this facility", totals.registered, { note: "Distinct patients with any recorded contact." }),
    k("ov_active", "Active patients (last 90 days)", totals.active),
    k("ov_staff", "Active staff", staff.total, { note: `${staff.doctors} doctors, ${staff.nurses} nurses.` }),
    k("ov_departments", "Active departments", staff.departments),
    k("ov_pending_clinical", "Pending clinical activities", pending.docs + pending.tasks + pending.rx, { betterWhen: "LOWER", note: `${pending.docs} documents, ${pending.tasks} nursing tasks, ${pending.rx} medication orders.` }),
    k("ov_outstanding_reports", "Outstanding reports", pending.results + pending.reports + pending.summaries, { betterWhen: "LOWER", note: `${pending.results} lab results, ${pending.reports} diagnostic reports, ${pending.summaries} discharge summaries.` }),
    makeKpi("critical_alerts_open", fig(pending.alerts), null, { drill: "lab.critical" }),
  ];
  const periodKpis: KpiValue[] = [];
  const add = (key: string, a: { [k: string]: ReturnType<typeof fig> }, b: { [k: string]: ReturnType<typeof fig> } | null, drill?: string) => { if (a[key]) periodKpis.push(makeKpi(key, a[key], b?.[key] ?? null, { drill })); };
  const sections: Section[] = [];

  if (kind === "HOSPITAL") {
    const [h, hp, nu, nup, live] = await Promise.all([hospitalFigures(ctx, cur), prev ? hospitalFigures(ctx, prev) : null, nursingFigures(ctx, cur), prev ? nursingFigures(ctx, prev) : null, liveHospital(ctx)]);
    for (const key of ["admissions_total", "discharges_total", "emergency_arrivals", "alos", "readmission_rate", "discharge_summary_completion"]) add(key, h, hp, key.includes("admissions") ? "hospital.admissions" : undefined);
    const lf = liveBedFigures(live);
    periodKpis.push(makeKpi("bed_occupancy_now", lf.bed_occupancy_now, null, { drill: "hospital.beds" }));
    add("nursing_task_completion", nu, nup, "nursing.tasks");
    periodKpis.push({ ...makeKpi("inpatient_deaths", h.inpatient_deaths, hp?.inpatient_deaths ?? null, { drill: "mortality.deaths" }), note: "Counted separately from discharges and transfers; see Mortality & outcomes for the rate and its denominator." });
  }
  if (kind === "LABORATORY" || kind === "HOSPITAL") {
    const [l, lp] = await Promise.all([laboratoryFigures(ctx, cur), prev ? laboratoryFigures(ctx, prev) : null]);
    for (const key of ["lab_orders", "lab_rejection_rate", "lab_tat_overall"]) add(key, l, lp);
  }
  if (kind === "DIAGNOSTIC_CENTRE" || kind === "HOSPITAL") {
    const [d, dp] = await Promise.all([diagnosticFigures(ctx, cur), prev ? diagnosticFigures(ctx, prev) : null]);
    for (const key of ["dx_requests", "dx_report_tat"]) add(key, d, dp);
  }
  if (kind === "PHARMACY" || kind === "HOSPITAL") {
    const [p, pp] = await Promise.all([pharmacyFigures(ctx, cur), prev ? pharmacyFigures(ctx, prev) : null]);
    for (const key of ["rx_orders", "rx_fulfilment_rate", "rx_processing_time"]) add(key, p, pp);
  }
  if (ctx.scope.canViewFinancial) {
    const [row] = await db.$queryRaw<{ currency: string }[]>`SELECT p.currency FROM payments p JOIN facility_bookings b ON b.id = p.facility_booking_id JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)} GROUP BY 1 ORDER BY count(*) DESC LIMIT 1`;
    const currency = row?.currency ?? "NGN";
    const [fa, fp] = await Promise.all([financialFigures(ctx, cur, currency), prev ? financialFigures(ctx, prev, currency) : null]);
    add("revenue_total", fa, fp, "finance.payments");
  }
  const all = await attachTargets(f, [...periodKpis]);
  const attention = [
    { item: "Critical alerts awaiting acknowledgement", count: pending.alerts }, { item: "Discharge summaries outstanding", count: pending.summaries },
    { item: "Lab results awaiting verification", count: pending.results }, { item: "Diagnostic reports awaiting interpretation or verification", count: pending.reports },
    { item: "Overdue or open nursing tasks", count: pending.tasks }, { item: "Clinical documents awaiting completion or signature", count: pending.docs },
    { item: "Medication orders awaiting review or dispensing", count: pending.rx },
  ].filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
  sections.push({ id: "attention", title: "Operational backlog", question: "Where is work waiting?", visual: { type: "table", columns: [{ key: "item", label: "Backlog" }, { key: "count", label: "Items", align: "right" }], rows: attention, footnote: attention.length ? "Point-in-time counts. Open each dashboard for the worklists behind them." : "Nothing is waiting." } });
  const t = targetsSection(all); if (t) sections.push(t);
  return {
    kpis: [...all, ...kpis],
    sections,
    gaps: [
      { indicator: "Facility-to-facility comparison across an organisation", reason: "Medic1905 has branches but no organisation entity that groups independently verified facilities; cross-facility comparison is intentionally unavailable." },
      { indicator: "Patients 'total new', 'cases managed', 'total deaths recorded' at platform level", reason: "Platform-wide statistics are available only to platform administrators and never include identifiable records." },
    ],
  };
}
