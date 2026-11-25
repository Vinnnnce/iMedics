import { Prisma } from "@prisma/client";
import { db, bucketedCounts, minutesDiff, ts } from "./sql";
import { fig, figRatio, gap, makeKpi, type Ctx } from "./core";
import { chooseGranularity, DEFAULT_CALENDAR, type CalendarSettings, type ResolvedRange } from "./periods";
import { round, ratio } from "./stats";
import { nursingFigures } from "./nursing";
import type { DashboardPayload, KpiValue, Section } from "./types";

type Part = Pick<DashboardPayload, "kpis" | "sections" | "gaps">;

/** The signed-in member of staff's own activity at this facility. Never exposes colleagues' figures. */
export async function myFacilityPerformance(ctx: Ctx): Promise<Part> {
  const f = ctx.scope.facility.id;
  const u = ctx.scope.user.id;
  const cur = ctx.range.current;
  const granularity = chooseGranularity(cur);
  const in_ = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${ts(cur.start)} AND ${Prisma.raw(col)} < ${ts(cur.end)}`;
  const [[row], nur, trend] = await Promise.all([
    db.$queryRaw<{ med: number; lab: number; docs: number; docs_final: number; open_docs: number; results_entered: number; results_verified: number; hours: number | null; patients: number }[]>`
      SELECT (SELECT count(*) FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.prescriber_id = ${u}::uuid AND m.status <> 'DRAFT' AND ${in_("m.created_at")})::int AS med,
        (SELECT count(*) FROM lab_orders o WHERE o.requesting_facility_id = ${f}::uuid AND o.ordered_by_id = ${u}::uuid AND ${in_("o.created_at")})::int AS lab,
        (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND d.deleted_at IS NULL AND ${in_("d.created_at")})::int AS docs,
        (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND d.deleted_at IS NULL AND ${in_("d.finalized_at")})::int AS docs_final,
        (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND d.deleted_at IS NULL AND d.status IN ('DRAFT','PENDING_REVIEW','PENDING_SIGNATURE'))::int AS open_docs,
        (SELECT count(*) FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.uploaded_by_id = ${u}::uuid AND ${in_("r.created_at")})::int AS results_entered,
        (SELECT count(*) FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.verified_by_id = ${u}::uuid AND ${in_("r.verified_at")})::int AS results_verified,
        (SELECT round((avg(${minutesDiff(Prisma.sql`d.finalized_at`, Prisma.sql`d.created_at`)}) / 60.0)::numeric, 1)::float FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND d.deleted_at IS NULL AND ${in_("d.finalized_at")} AND d.finalized_at >= d.created_at) AS hours,
        (SELECT count(DISTINCT x.patient_id) FROM (
          SELECT m.patient_id FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.prescriber_id = ${u}::uuid AND ${in_("m.created_at")}
          UNION SELECT d.patient_id FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND ${in_("d.created_at")}
          UNION SELECT o.patient_id FROM nursing_observation o WHERE o.facility_id = ${f}::uuid AND o.recorded_by_id = ${u}::uuid AND ${in_("o.recorded_at")}) x)::int AS patients`,
    nursingFigures(ctx, cur, u),
    bucketedCounts(Prisma.sql`FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.author_id = ${u}::uuid AND d.deleted_at IS NULL`, Prisma.sql`d.created_at`, cur, granularity, ctx.scope.calendar),
  ]);
  const role = (await db.facilityStaff.findFirst({ where: { facilityId: f, userId: u }, select: { facilityRole: true } }))?.facilityRole ?? "OWNER";
  const kpis: KpiValue[] = [
    { key: "my_patients", label: "Unique patients you recorded care for", value: row.patients, unit: "count", betterWhen: "NEUTRAL" },
    { key: "my_docs", label: "Clinical documents you authored", value: row.docs, unit: "count", betterWhen: "NEUTRAL", spark: trend.map((t) => t.y) },
    { key: "my_docs_final", label: "Documents you finalised", value: row.docs_final, unit: "count", betterWhen: "NEUTRAL" },
    { key: "my_docs_open", label: "Your documents outstanding", value: row.open_docs, unit: "count", betterWhen: "LOWER", note: "Drafts and documents waiting for review or signature." },
    { key: "my_doc_hours", label: "Your mean time to finalise a document", value: row.hours, unit: "hours", betterWhen: "LOWER" },
  ];
  if (row.med) kpis.push({ key: "my_med", label: "Medication orders you wrote", value: row.med, unit: "count", betterWhen: "NEUTRAL" });
  if (row.lab) kpis.push({ key: "my_lab", label: "Lab requests you made", value: row.lab, unit: "count", betterWhen: "NEUTRAL" });
  if (row.results_entered || row.results_verified) kpis.push({ key: "my_results", label: "Results you entered / verified", value: row.results_entered, unit: "count", betterWhen: "NEUTRAL", note: `${row.results_verified} verified by you.` });
  const nurse = role === "NURSE" || nur.nursing_observations.value! > 0 || (nur.nursing_tasks_total.value ?? 0) > 0;
  if (nurse) {
    kpis.push(makeKpi("nursing_task_completion", nur.nursing_task_completion, null), makeKpi("nursing_task_ontime", nur.nursing_task_ontime, null), makeKpi("nursing_observations", nur.nursing_observations, null), makeKpi("nursing_assessments", nur.nursing_assessments, null), makeKpi("nursing_handovers", nur.nursing_handovers, null), makeKpi("mar_given_rate", nur.mar_given_rate, null));
    kpis.push({ key: "my_nursing_patients", label: "Unique patients you cared for", value: nur.nursing_unique_patients.value, unit: "count", betterWhen: "NEUTRAL" });
  }
  const sections: Section[] = [{ id: "docs-trend", title: "Documents you created", question: "How is your documentation workload moving?", visual: { type: "line", unit: "count", series: [{ name: "Documents", points: trend }] } }];
  void fig; void figRatio; void ratio; void round;
  return {
    kpis, sections,
    gaps: [
      gap("Outcome measures and comparisons with colleagues", "This page shows only your own recorded activity. Volume is workload, not quality, and outcomes are not attributed to individuals."),
    ],
  };
}

/* ───────────────────────── independent doctor (platform practice) ───────────────────────── */

export interface DoctorPlatformInput { userId: string; doctorId: string; range: ResolvedRange }

export async function doctorPlatformPerformance(input: DoctorPlatformInput): Promise<Part> {
  const { doctorId, userId, range } = input;
  const cur = range.current;
  const prev = range.previous;
  const cal: CalendarSettings = range.calendar ?? DEFAULT_CALENDAR;
  const granularity = chooseGranularity(cur);
  const figures = async (p: { start: Date; end: Date }) => {
    const [c] = await db.$queryRaw<{ total: number; patients: number; finalised: number; drafts: number; hours: number[] | null }[]>`
      SELECT count(*)::int AS total, count(DISTINCT c.patient_id)::int AS patients, count(*) FILTER (WHERE c.status = 'FINALIZED')::int AS finalised, count(*) FILTER (WHERE c.status = 'DRAFT')::int AS drafts,
        array_agg(${minutesDiff(Prisma.sql`c.finalized_at`, Prisma.sql`c.created_at`)} / 60.0) FILTER (WHERE c.finalized_at >= c.created_at) AS hours
      FROM consultations c WHERE c.doctor_id = ${doctorId}::uuid AND c.created_at >= ${ts(p.start)} AND c.created_at < ${ts(p.end)}`;
    const [a] = await db.$queryRaw<{ completed: number; no_show: number; cancelled: number; fu_due: number; fu_done: number; new_pts: number; fu_pts: number }[]>`
      SELECT count(*) FILTER (WHERE a.status = 'COMPLETED')::int AS completed, count(*) FILTER (WHERE a.status = 'NO_SHOW')::int AS no_show, count(*) FILTER (WHERE a.status = 'CANCELLED')::int AS cancelled,
        count(*) FILTER (WHERE a.follow_up_of_id IS NOT NULL AND a.status <> 'CANCELLED' AND a.scheduled_at < now())::int AS fu_due,
        count(*) FILTER (WHERE a.follow_up_of_id IS NOT NULL AND a.status = 'COMPLETED')::int AS fu_done,
        count(*) FILTER (WHERE a.follow_up_of_id IS NULL AND a.status = 'COMPLETED')::int AS new_pts, count(*) FILTER (WHERE a.follow_up_of_id IS NOT NULL AND a.status = 'COMPLETED')::int AS fu_pts
      FROM appointments a WHERE a.doctor_id = ${doctorId}::uuid AND a.scheduled_at >= ${ts(p.start)} AND a.scheduled_at < ${ts(p.end)}`;
    const [rx] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM prescriptions r WHERE r.doctor_id = ${doctorId}::uuid AND r.created_at >= ${ts(p.start)} AND r.created_at < ${ts(p.end)}`;
    const [lab] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM lab_orders o WHERE o.ordered_by_id = ${userId}::uuid AND o.created_at >= ${ts(p.start)} AND o.created_at < ${ts(p.end)}`;
    const hours = (c.hours ?? []).map(Number);
    const past = a.completed + a.no_show + a.cancelled;
    return { c, a, rx: rx.n, lab: lab.n, meanHours: hours.length ? round(hours.reduce((s, v) => s + v, 0) / hours.length, 1) : null, hoursN: hours.length, completion: figRatio(a.completed, past), followUp: figRatio(a.fu_done, a.fu_due) };
  };
  const [cf, pf] = await Promise.all([figures(cur), prev ? figures(prev) : null]);
  const [trend, byDx, byMode, overdue] = await Promise.all([
    bucketedCounts(Prisma.sql`FROM consultations c WHERE c.doctor_id = ${doctorId}::uuid`, Prisma.sql`c.created_at`, cur, granularity, cal),
    db.$queryRaw<{ label: string; n: number }[]>`SELECT d.code || ' · ' || d.description AS label, count(*)::int AS n FROM consultations c JOIN consultation_diagnoses d ON d.consultation_id = c.id WHERE c.doctor_id = ${doctorId}::uuid AND c.created_at >= ${ts(cur.start)} AND c.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 10`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT a.mode::text AS label, count(*)::int AS n FROM appointments a WHERE a.doctor_id = ${doctorId}::uuid AND a.status = 'COMPLETED' AND a.scheduled_at >= ${ts(cur.start)} AND a.scheduled_at < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM consultations c WHERE c.doctor_id = ${doctorId}::uuid AND c.status = 'FINALIZED' AND c.follow_up_date < now() AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.doctor_id = c.doctor_id AND a.patient_id = c.patient_id AND a.scheduled_at > c.finalized_at AND a.status <> 'CANCELLED')`,
  ]);
  const cmp = (key: string, label: string, value: number | null, prevValue: number | null | undefined, extra: Partial<KpiValue> = {}): KpiValue => {
    const change = prevValue === undefined ? undefined : (await_change(value, prevValue));
    return { key, label, value, unit: "count", betterWhen: "NEUTRAL", ...(change ? { change } : {}), ...extra };
  };
  const kpis: KpiValue[] = [
    cmp("doc_consultations", "Consultations", cf.c.total, pf?.c.total, { spark: trend.map((t) => t.y), note: "Volume is workload, not quality." }),
    cmp("doc_unique_patients", "Unique patients treated", cf.c.patients, pf?.c.patients),
    cmp("doc_completed_appts", "Completed appointments", cf.a.completed, pf?.a.completed),
    { ...makeKpi("doc_appointment_completion", cf.completion, pf?.completion ?? null) },
    { ...makeKpi("doc_followup_attendance", cf.followUp, pf?.followUp ?? null) },
    { ...makeKpi("doc_documentation_time", fig(cf.meanHours, { sampleSize: cf.hoursN }), pf ? fig(pf.meanHours) : null) },
    cmp("doc_drafts", "Consultation drafts awaiting finalisation", cf.c.drafts, undefined, { betterWhen: "LOWER" }),
    cmp("doc_rx", "Prescriptions issued", cf.rx, pf?.rx),
    cmp("doc_lab", "Laboratory requests", cf.lab, pf?.lab),
    cmp("doc_missed", "Missed appointments (no-shows)", cf.a.no_show, pf?.a.no_show, { betterWhen: "LOWER" }),
    cmp("doc_cancelled", "Cancelled appointments", cf.a.cancelled, pf?.a.cancelled, { betterWhen: "LOWER" }),
    cmp("doc_followups_overdue", "Follow-ups overdue (no later appointment)", overdue[0].n, undefined, { betterWhen: "LOWER", note: "Finalised consultations whose follow-up date has passed with no later booking." }),
  ];
  const sections: Section[] = [
    { id: "trend", title: "Consultation volume", question: "How is my consultation workload changing?", visual: { type: "line", unit: "count", series: [{ name: "Consultations", points: trend }] } },
    { id: "dx", title: "Most frequent diagnoses", question: "What conditions make up my caseload?", visual: { type: "bars", unit: "count", items: byDx.map((r) => ({ label: r.label, value: r.n })) } },
    { id: "mode", title: "Completed appointments by mode", question: "How do patients reach me?", visual: { type: "donut", unit: "count", items: byMode.map((r) => ({ label: r.label.toLowerCase(), value: r.n })) } },
    { id: "split", title: "New and follow-up visits", question: "How much of my work is continuing care?", visual: { type: "donut", unit: "count", items: [{ label: "New patient visits", value: cf.a.new_pts }, { label: "Follow-up visits", value: cf.a.fu_pts }].filter((x) => x.value > 0) } },
  ];
  return {
    kpis, sections,
    gaps: [
      gap("Average consultation duration", "Only the scheduled appointment length is recorded, not the actual time spent."),
      gap("Patient outcomes, readmissions, complications, adverse events", "Outcomes depend on case mix and shared care and are not attributed to an individual doctor."),
      gap("Procedures performed, treatment plans, discharge documentation time, results-review time", "Not recorded as separate structured events for independent practice."),
    ],
  };
}

import { change as statChange } from "./stats";
function await_change(value: number | null, prev: number | null) { return statChange(value, prev); }
