import { Prisma } from "@prisma/client";
import { db, bucketedCounts, localTs, ts } from "./sql";
import { attachTargets, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { round } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }

/** Department filter through the admission a record belongs to (records with no admission are outside any department). */
function wardJoin(ctx: Ctx, table: string): { join: Prisma.Sql; where: Prisma.Sql } {
  if (!ctx.dept) return { join: Prisma.empty, where: Prisma.empty };
  const names = ctx.dept.wardNames.length ? Prisma.join(ctx.dept.wardNames.map((n) => Prisma.sql`${n}`)) : Prisma.sql`NULL`;
  return { join: Prisma.sql`JOIN admissions adm ON adm.id = ${Prisma.raw(table)}.admission_id`, where: Prisma.sql` AND adm.ward IN (${names})` };
}

/** Two shifts, 07:00–19:00 local (day) and 19:00–07:00 (night); wards with other rosters can still read the hourly pattern. */
export const SHIFT_DAY_START_HOUR = 7;
export const SHIFT_DAY_END_HOUR = 19;

export async function nursingFigures(ctx: Ctx, p: P, nurseUserId?: string): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const t = wardJoin(ctx, "t");
  const o = wardJoin(ctx, "o");
  const n = wardJoin(ctx, "n");
  const m = { join: Prisma.empty, where: Prisma.empty };
  const who = (col: string) => (nurseUserId ? Prisma.sql` AND ${Prisma.raw(col)} = ${nurseUserId}::uuid` : Prisma.empty);
  const due = Prisma.sql`coalesce(t.due_at, t.created_at)`;

  const [[tasks], [obs], [assess], [hand], [mar], [patients]] = await Promise.all([
    db.$queryRaw<{ total: number; completed: number; ontime_den: number; ontime: number }[]>`
      SELECT count(*)::int AS total, count(*) FILTER (WHERE t.status = 'COMPLETED')::int AS completed,
        count(*) FILTER (WHERE t.status = 'COMPLETED' AND t.due_at IS NOT NULL AND t.completed_at IS NOT NULL)::int AS ontime_den,
        count(*) FILTER (WHERE t.status = 'COMPLETED' AND t.due_at IS NOT NULL AND t.completed_at IS NOT NULL AND t.completed_at <= t.due_at)::int AS ontime
      FROM nursing_task t ${t.join} WHERE t.facility_id = ${f}::uuid AND ${due} >= ${ts(p.start)} AND ${due} < ${ts(p.end)}${t.where}${who("t.assigned_to_id")}`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM nursing_observation o ${o.join} WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(p.start)} AND o.recorded_at < ${ts(p.end)}${o.where}${who("o.recorded_by_id")}`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM nursing_assessments n ${n.join} WHERE n.facility_id = ${f}::uuid AND n.assessed_at >= ${ts(p.start)} AND n.assessed_at < ${ts(p.end)}${n.where}${who("n.assessed_by_id")}`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM nursing_handover h WHERE h.facility_id = ${f}::uuid AND h.created_at >= ${ts(p.start)} AND h.created_at < ${ts(p.end)}${who("h.from_user_id")}`,
    db.$queryRaw<{ total: number; given: number }[]>`SELECT count(*)::int AS total, count(*) FILTER (WHERE a.status = 'GIVEN')::int AS given FROM medication_administration a WHERE a.facility_id = ${f}::uuid AND a.administered_at >= ${ts(p.start)} AND a.administered_at < ${ts(p.end)}${who("a.administered_by_id")}`,
    db.$queryRaw<{ unique_patients: number }[]>`
      SELECT count(DISTINCT x.patient_id)::int AS unique_patients FROM (
        SELECT o.patient_id FROM nursing_observation o ${o.join} WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(p.start)} AND o.recorded_at < ${ts(p.end)}${o.where}${who("o.recorded_by_id")}
        UNION SELECT t.patient_id FROM nursing_task t ${t.join} WHERE t.facility_id = ${f}::uuid AND ${due} >= ${ts(p.start)} AND ${due} < ${ts(p.end)}${t.where}${who("t.assigned_to_id")}
        UNION SELECT a.patient_id FROM medication_administration a WHERE a.facility_id = ${f}::uuid AND a.administered_at >= ${ts(p.start)} AND a.administered_at < ${ts(p.end)}${who("a.administered_by_id")}
      ) x`,
  ]);
  void m;
  return {
    nursing_tasks_total: fig(tasks.total),
    nursing_task_completion: figRatio(tasks.completed, tasks.total),
    nursing_task_ontime: figRatio(tasks.ontime, tasks.ontime_den),
    nursing_observations: fig(obs.n),
    nursing_assessments: fig(assess.n),
    nursing_handovers: fig(hand.n),
    mar_given_rate: figRatio(mar.given, mar.total),
    nursing_unique_patients: fig(patients.unique_patients),
  };
}

export async function nursingDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const granularity = chooseGranularity(cur);
  const cal = ctx.scope.calendar;
  const o = wardJoin(ctx, "o");
  const t = wardJoin(ctx, "t");
  const [current, previous] = await Promise.all([nursingFigures(ctx, cur), ctx.range.previous ? nursingFigures(ctx, ctx.range.previous) : null]);
  const localObs = localTs(Prisma.sql`o.recorded_at`, cal.timeZone);

  const [overdue, obsTrend, byType, byAssess, marStatus, byWard, shiftRows, nurseRows, taskStatus] = await Promise.all([
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM nursing_task t ${t.join} WHERE t.facility_id = ${f}::uuid AND t.status <> 'COMPLETED' AND t.due_at < ${ts(ctx.now)}${t.where}`,
    bucketedCounts(Prisma.sql`FROM nursing_observation o ${o.join} WHERE o.facility_id = ${f}::uuid${o.where}`, Prisma.sql`o.recorded_at`, cur, granularity, cal),
    db.$queryRaw<{ label: string; n: number }[]>`SELECT o.observation_type AS label, count(*)::int AS n FROM nursing_observation o ${o.join} WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(cur.start)} AND o.recorded_at < ${ts(cur.end)}${o.where} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT n.type::text AS label, count(*)::int AS n FROM nursing_assessments n WHERE n.facility_id = ${f}::uuid AND n.assessed_at >= ${ts(cur.start)} AND n.assessed_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT a.status AS label, count(*)::int AS n FROM medication_administration a WHERE a.facility_id = ${f}::uuid AND a.administered_at >= ${ts(cur.start)} AND a.administered_at < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ label: string; obs: number; patients: number; open_tasks: number }[]>`
      SELECT coalesce(adm.ward, 'No admission') AS label, count(DISTINCT o.id)::int AS obs, count(DISTINCT o.patient_id)::int AS patients, 0 AS open_tasks
      FROM nursing_observation o LEFT JOIN admissions adm ON adm.id = o.admission_id
      WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(cur.start)} AND o.recorded_at < ${ts(cur.end)}${ctx.dept ? Prisma.sql` AND adm.ward IN (${ctx.dept.wardNames.length ? Prisma.join(ctx.dept.wardNames.map((w) => Prisma.sql`${w}`)) : Prisma.sql`NULL`})` : Prisma.empty}
      GROUP BY 1 ORDER BY 1`,
    db.$queryRaw<{ shift: string; n: number }[]>`SELECT CASE WHEN extract(hour FROM ${localObs}) >= ${SHIFT_DAY_START_HOUR} AND extract(hour FROM ${localObs}) < ${SHIFT_DAY_END_HOUR} THEN 'Day (07:00–19:00)' ELSE 'Night (19:00–07:00)' END AS shift, count(*)::int AS n FROM nursing_observation o ${o.join} WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(cur.start)} AND o.recorded_at < ${ts(cur.end)}${o.where} GROUP BY 1`,
    ctx.dept ? Promise.resolve([]) : db.$queryRaw<{ user_id: string; name: string | null; patients: number; obs: number; tasks: number; done: number; mar: number; handovers: number }[]>`
      WITH act AS (
        SELECT o.recorded_by_id AS uid, o.patient_id, 1 AS obs, 0 AS tasks, 0 AS done, 0 AS mar, 0 AS ho FROM nursing_observation o WHERE o.facility_id = ${f}::uuid AND o.recorded_at >= ${ts(cur.start)} AND o.recorded_at < ${ts(cur.end)}
        UNION ALL SELECT t.assigned_to_id, t.patient_id, 0, 1, (t.status = 'COMPLETED')::int, 0, 0 FROM nursing_task t WHERE t.facility_id = ${f}::uuid AND t.assigned_to_id IS NOT NULL AND coalesce(t.due_at, t.created_at) >= ${ts(cur.start)} AND coalesce(t.due_at, t.created_at) < ${ts(cur.end)}
        UNION ALL SELECT a.administered_by_id, a.patient_id, 0, 0, 0, 1, 0 FROM medication_administration a WHERE a.facility_id = ${f}::uuid AND a.administered_at >= ${ts(cur.start)} AND a.administered_at < ${ts(cur.end)}
        UNION ALL SELECT h.from_user_id, h.patient_id, 0, 0, 0, 0, 1 FROM nursing_handover h WHERE h.facility_id = ${f}::uuid AND h.created_at >= ${ts(cur.start)} AND h.created_at < ${ts(cur.end)})
      SELECT act.uid::text AS user_id, max(s.full_name) AS name, count(DISTINCT act.patient_id)::int AS patients, sum(act.obs)::int AS obs, sum(act.tasks)::int AS tasks, sum(act.done)::int AS done, sum(act.mar)::int AS mar, sum(act.ho)::int AS handovers
      FROM act JOIN facility_staff s ON s.user_id = act.uid AND s.facility_id = ${f}::uuid AND s."facilityRole" = 'NURSE' GROUP BY act.uid ORDER BY max(s.full_name)`,
    db.$queryRaw<{ label: string; n: number }[]>`SELECT t.status AS label, count(*)::int AS n FROM nursing_task t ${t.join} WHERE t.facility_id = ${f}::uuid AND coalesce(t.due_at, t.created_at) >= ${ts(cur.start)} AND coalesce(t.due_at, t.created_at) < ${ts(cur.end)}${t.where} GROUP BY 1`,
  ]);

  const perNurse = nurseRows.length ? round(nurseRows.reduce((s, r) => s + r.patients, 0) / nurseRows.length, 1) : null;
  let kpis: KpiValue[] = [
    makeKpi("nursing_task_completion", current.nursing_task_completion, previous?.nursing_task_completion ?? null, { drill: "nursing.tasks" }),
    makeKpi("nursing_task_ontime", current.nursing_task_ontime, previous?.nursing_task_ontime ?? null, { drill: "nursing.tasks" }),
    makeKpi("nursing_tasks_total", current.nursing_tasks_total, previous?.nursing_tasks_total ?? null, { drill: "nursing.tasks" }),
    makeKpi("nursing_tasks_overdue", fig(overdue[0].n), null, { drill: "nursing.overdue" }),
    makeKpi("nursing_observations", current.nursing_observations, previous?.nursing_observations ?? null, { drill: "nursing.observations", spark: obsTrend.map((x) => x.y) }),
    makeKpi("nursing_assessments", current.nursing_assessments, previous?.nursing_assessments ?? null),
    makeKpi("nursing_handovers", current.nursing_handovers, previous?.nursing_handovers ?? null),
    makeKpi("mar_given_rate", current.mar_given_rate, previous?.mar_given_rate ?? null),
    { key: "nursing_unique_patients", label: "Unique patients cared for", value: current.nursing_unique_patients.value, unit: "count", betterWhen: "NEUTRAL", change: undefined },
    { key: "nursing_patients_per_nurse", label: "Average patients per nurse", value: perNurse, unit: "ratio", betterWhen: "NEUTRAL", note: nurseRows.length ? `Across ${nurseRows.length} nurse(s) with recorded activity; this is workload context, not a performance score.` : "Not available for department-limited views." },
  ];
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "obs-trend", title: "Observations recorded", question: "Is observation activity steady across the period?", visual: { type: "line", unit: "count", series: [{ name: "Observations", points: obsTrend }] } },
    { id: "tasks", title: "Tasks: completed versus pending", question: "How much of the planned nursing work was completed?", visual: { type: "bars", unit: "count", items: taskStatus.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) }, drill: "nursing.tasks" },
    { id: "obs-type", title: "Nursing activity by category", question: "What kinds of observations make up the workload?", visual: { type: "bars", unit: "count", items: byType.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) } },
    { id: "assess-type", title: "Assessments by type", question: "How often are fall-risk, pressure-injury and wound assessments done?", visual: { type: "bars", unit: "count", items: byAssess.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) } },
    { id: "mar", title: "Medication administration", question: "How many doses were given versus held, refused or omitted?", visual: { type: "donut", unit: "count", items: marStatus.map((r) => ({ label: r.label.toLowerCase(), value: r.n })) }, note: "Held, refused and omitted doses are documented absences, not errors." },
    { id: "shift", title: "Shift workload", question: "Is the night shift carrying a disproportionate load?", visual: { type: "bars", unit: "count", items: shiftRows.map((r) => ({ label: r.shift, value: r.n })) }, note: "Observations by local time of recording; Medic1905 stores no rosters, so shifts are inferred from the clock." },
    { id: "ward", title: "Workload by ward", question: "Which wards generate the most nursing observations, and for how many patients?", visual: { type: "table", columns: [{ key: "label", label: "Ward" }, { key: "obs", label: "Observations", align: "right" }, { key: "patients", label: "Patients", align: "right" }], rows: byWard.map((r) => ({ label: r.label, obs: r.obs, patients: r.patients })) } },
  ];
  if (nurseRows.length) {
    sections.push({
      id: "nurses", title: "Nurse activity (alphabetical — not a ranking)", question: "How is activity distributed across the nursing team?",
      visual: { type: "table", columns: [{ key: "name", label: "Nurse" }, { key: "patients", label: "Patients", align: "right" }, { key: "obs", label: "Observations", align: "right" }, { key: "tasks", label: "Tasks assigned", align: "right" }, { key: "done", label: "Tasks completed", align: "right" }, { key: "mar", label: "Doses recorded", align: "right" }, { key: "handovers", label: "Handovers", align: "right" }], rows: nurseRows.map((r) => ({ name: r.name ?? "Staff member", patients: r.patients, obs: r.obs, tasks: r.tasks, done: r.done, mar: r.mar, handovers: r.handovers })), footnote: "Counts reflect recorded activity and the acuity of the patients assigned. They are opportunities to review workload, not performance rankings." },
    });
  }
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  return {
    kpis, sections,
    gaps: [
      gap("Medication administration timeliness", "Scheduled dose times are not stored, so on-time administration cannot be measured."),
      gap("Missed or delayed medication administrations", "Only documented absences (held, refused, omitted) are recorded; undocumented missed doses are invisible."),
      gap("Patient falls, pressure injuries, hospital-acquired infection, medication errors, incident reports, complaints", "There is no structured incident register. Fall-risk and pressure-injury assessments are counted, but outcomes are not."),
      gap("Shift attendance and hours worked", "No roster or attendance data."),
      gap("Patient acuity distribution, ward staffing and acuity overview", "Acuity scores per patient are not recorded."),
      gap("Fluid balance, catheter care, mobility, hygiene, patient education and discharge preparation tallies", "Recorded only as free-text observations or not at all; not separately counted."),
    ],
  };
}
