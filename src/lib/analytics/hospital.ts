import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { db, minutesDiff, bucketedCounts, localTs, ts } from "./sql";
import { admissionDeptSql, encounterDeptSql, ADMISSION_EMERGENCY_SQL, attachTargets, fig, figRatio, gap, makeKpi, targetsSection, wardClass, type Ctx, type Figures } from "./core";
import { chooseGranularity, type ResolvedPeriod } from "./periods";
import { AGE_BANDS, ageBand, num, ratio, round, suppressSmall, MIN_RELIABLE_SAMPLE } from "./stats";
import type { BedWard, DashboardPayload, KpiValue, Section } from "./types";

export const READMISSION_DAYS = 30;
export const EXIT_TIME_SQL = Prisma.sql`coalesce(a.discharge_date, (SELECT min(l.created_at) FROM audit_logs l WHERE l.resource_type = 'Admission' AND l.resource_id = a.id AND l.action = 'ADMISSION_INTERFACILITY_TRANSFER'), a.updated_at)`;

interface P { start: Date; end: Date }

/* ───────────────────────── period figures ───────────────────────── */

export async function hospitalFigures(ctx: Ctx, p: P): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const inP = (col: string) => Prisma.sql`${Prisma.raw(col)} >= ${ts(p.start)} AND ${Prisma.raw(col)} < ${ts(p.end)}`;
  const encDept = encounterDeptSql(ctx);
  const admDept = admissionDeptSql(ctx);

  const [enc] = await db.$queryRaw<{ total: number; cancelled: number; emergency: number; outpatient: number; transfers_in: number; inpatient: number }[]>`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE e.status = 'CANCELLED')::int AS cancelled,
      count(*) FILTER (WHERE (e.type = 'EMERGENCY_DEPARTMENT' OR e.is_emergency) AND e.status <> 'CANCELLED')::int AS emergency,
      count(*) FILTER (WHERE e.type IN ('SCHEDULED_OUTPATIENT','UNSCHEDULED_OUTPATIENT','FOLLOW_UP','OBSERVATION') AND e.status <> 'CANCELLED')::int AS outpatient,
      count(*) FILTER (WHERE e.type = 'TRANSFER_IN' AND e.status <> 'CANCELLED')::int AS transfers_in,
      count(*) FILTER (WHERE e.type IN ('PLANNED_INPATIENT','EMERGENCY_INPATIENT') AND e.status <> 'CANCELLED')::int AS inpatient
    FROM encounters e WHERE e.facility_id = ${f}::uuid AND ${inP("e.registered_at")}${encDept}`;

  const [patients] = await db.$queryRaw<{ unique_patients: number; new_patients: number }[]>`
    WITH contacts AS (
      SELECT e.patient_id, e.registered_at AS at FROM encounters e
        WHERE e.facility_id = ${f}::uuid AND e.status NOT IN ('CANCELLED','DID_NOT_ATTEND')${encDept}
      UNION ALL
      SELECT a.patient_id, a.admission_date FROM admissions a
        WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED'${admDept}
    ), firsts AS (SELECT patient_id, min(at) AS first_at FROM contacts GROUP BY patient_id)
    SELECT
      (SELECT count(DISTINCT patient_id) FROM contacts WHERE at >= ${ts(p.start)} AND at < ${ts(p.end)})::int AS unique_patients,
      (SELECT count(*) FROM firsts WHERE first_at >= ${ts(p.start)} AND first_at < ${ts(p.end)})::int AS new_patients`;

  const [adm] = await db.$queryRaw<{ total: number; emergency: number; unclassified: number; readmissions: number }[]>`
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE e.id IS NOT NULL AND ${ADMISSION_EMERGENCY_SQL})::int AS emergency,
      count(*) FILTER (WHERE e.id IS NULL)::int AS unclassified,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM admissions prev WHERE prev.facility_id = a.facility_id AND prev.patient_id = a.patient_id AND prev.id <> a.id
          AND prev.status = 'DISCHARGED' AND prev.disposition IS DISTINCT FROM 'DECEASED' AND prev.discharge_date IS NOT NULL
          AND prev.discharge_date <= a.admission_date AND prev.discharge_date >= a.admission_date - make_interval(days => ${READMISSION_DAYS}::int)
      ))::int AS readmissions
    FROM admissions a LEFT JOIN encounters e ON e.admission_id = a.id
    WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED' AND ${inP("a.admission_date")}${admDept}`;

  const [exits] = await db.$queryRaw<{ live: number; deaths: number; with_summary: number; referred: number; los: number[] | null }[]>`
    SELECT
      count(*) FILTER (WHERE a.disposition IS DISTINCT FROM 'DECEASED')::int AS live,
      count(*) FILTER (WHERE a.disposition = 'DECEASED')::int AS deaths,
      count(*) FILTER (WHERE a.epicrisis IS NOT NULL AND btrim(a.epicrisis) <> '')::int AS with_summary,
      count(*) FILTER (WHERE a.disposition = 'REFERRED')::int AS referred,
      array_agg(extract(epoch FROM (a.discharge_date - a.admission_date)) / 86400.0) FILTER (WHERE a.discharge_date > a.admission_date) AS los
    FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND ${inP("a.discharge_date")}${admDept}`;

  const [tout] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM admissions a
    WHERE a.facility_id = ${f}::uuid AND a.status = 'TRANSFERRED'${admDept}
      AND ${EXIT_TIME_SQL} >= ${ts(p.start)} AND ${EXIT_TIME_SQL} < ${ts(p.end)}`;

  const [wt] = await db.$queryRaw<{ n: number }[]>`
    SELECT count(*)::int AS n FROM ward_transfers wt JOIN admissions a ON a.id = wt.admission_id
    WHERE a.facility_id = ${f}::uuid AND wt.transferred_at >= ${ts(p.start)} AND wt.transferred_at < ${ts(p.end)}${admDept}`;

  const referrals = ctx.dept ? null : await prisma.facilityReferral.count({ where: { facilityId: f, createdAt: { gte: p.start, lt: p.end } } });

  // Bed-days: every admission's overlap with the period, divided by in-service beds × elapsed days.
  const bedWhere = ctx.dept ? Prisma.sql` AND b.ward_id IN (${ctx.dept.wardIds.length ? Prisma.join(ctx.dept.wardIds.map((w) => Prisma.sql`${w}::uuid`)) : Prisma.sql`NULL::uuid`})` : Prisma.empty;
  const [bedRow] = await db.$queryRaw<{ in_service: number }[]>`SELECT count(*) FILTER (WHERE b.status <> 'MAINTENANCE')::int AS in_service FROM beds b WHERE b.facility_id = ${f}::uuid${bedWhere}`;
  const effectiveEnd = new Date(Math.min(p.end.getTime(), ctx.now.getTime()));
  const elapsedDays = Math.max(0, (effectiveEnd.getTime() - p.start.getTime()) / 86_400_000);
  const [stay] = await db.$queryRaw<{ bed_days: number | null }[]>`
    SELECT sum(extract(epoch FROM (least(x.stay_end, ${ts(effectiveEnd)}) - greatest(x.stay_start, ${ts(p.start)}))) / 86400.0)::float AS bed_days
    FROM (
      SELECT a.admission_date AS stay_start,
        CASE a.status WHEN 'ACTIVE' THEN ${ts(ctx.now)} WHEN 'DISCHARGED' THEN coalesce(a.discharge_date, a.admission_date) ELSE ${EXIT_TIME_SQL} END AS stay_end
      FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED'${admDept}
    ) x WHERE x.stay_start < ${ts(effectiveEnd)} AND x.stay_end > ${ts(p.start)}`;

  const losValues = (exits?.los ?? []).map(Number);
  const totalExits = exits.live + exits.deaths + tout.n;
  const availableBedDays = bedRow.in_service * elapsedDays;
  const occupiedBedDays = stay?.bed_days ?? 0;

  const figures: Figures = {
    encounters_total: fig(enc.total, { sampleSize: enc.total }),
    unique_patients: fig(patients.unique_patients),
    new_patients: fig(patients.new_patients),
    emergency_arrivals: fig(enc.emergency),
    outpatient_encounters: fig(enc.outpatient),
    transfers_in: fig(enc.transfers_in),
    admissions_total: fig(adm.total),
    admissions_emergency: fig(adm.emergency, { note: adm.unclassified ? `${adm.unclassified} admission${adm.unclassified === 1 ? "" : "s"} with no linked encounter are not classified as planned or emergency.` : undefined }),
    discharges_total: fig(exits.live),
    inpatient_deaths: fig(exits.deaths),
    inpatient_mortality_rate: figRatio(exits.deaths, exits.live + exits.deaths),
    transfers_out: fig(tout.n),
    ward_transfers: fig(wt.n),
    alos: fig(losValues.length ? round(losValues.reduce((s, v) => s + v, 0) / losValues.length, 1) : null, { sampleSize: losValues.length, numerator: round(losValues.reduce((s, v) => s + v, 0), 1), denominator: losValues.length }),
    median_los: fig(losValues.length ? round(medianOf(losValues), 1) : null, { sampleSize: losValues.length }),
    readmission_rate: figRatio(adm.readmissions, adm.total),
    pending_discharge_summaries: fig(exits.live + exits.deaths - exits.with_summary),
    discharge_summary_completion: figRatio(exits.with_summary, exits.live + exits.deaths),
    bed_occupancy_period: availableBedDays > 0 ? figRatio(round(occupiedBedDays, 1), round(availableBedDays, 1)) : fig(null, { note: "No in-service beds are configured." }),
    bed_turnover: fig(bedRow.in_service > 0 ? round(totalExits / bedRow.in_service, 2) : null, { numerator: totalExits, denominator: bedRow.in_service }),
  };
  if (referrals !== null) figures.referrals_received = fig(referrals);
  return figures;
}

function medianOf(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/* ───────────────────────── point-in-time figures ───────────────────────── */

export interface LiveHospital {
  wards: BedWard[];
  bedCounts: Record<string, number>;
  awaitingAdmission: number;
  awaitingDischarge: number;
  openEmergency: number;
  activeAdmissions: number;
}

export async function liveHospital(ctx: Ctx): Promise<LiveHospital> {
  const f = ctx.scope.facility.id;
  const wardFilter: Prisma.WardWhereInput = ctx.dept ? { id: { in: ctx.dept.wardIds } } : {};
  const wards = await prisma.ward.findMany({
    where: { facilityId: f, ...wardFilter },
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, genderPolicy: true, beds: { orderBy: { label: "asc" }, select: { id: true, label: true, status: true, isolationReason: true, currentAdmissionId: true } } },
  });
  const encDept = encounterDeptSql(ctx);
  const admDept = admissionDeptSql(ctx);
  const [enc] = await db.$queryRaw<{ awaiting_admission: number; awaiting_discharge: number; open_emergency: number }[]>`
    SELECT count(*) FILTER (WHERE e.status = 'AWAITING_ADMISSION')::int AS awaiting_admission,
           count(*) FILTER (WHERE e.status = 'AWAITING_DISCHARGE')::int AS awaiting_discharge,
           count(*) FILTER (WHERE (e.type = 'EMERGENCY_DEPARTMENT' OR e.is_emergency) AND e.closed_at IS NULL)::int AS open_emergency
    FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.closed_at IS NULL${encDept}`;
  const [active] = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'ACTIVE'${admDept}`;
  const pendingByWard = await db.$queryRaw<{ ward: string | null; n: number }[]>`
    SELECT a.ward, count(*)::int AS n FROM encounters e JOIN admissions a ON a.id = e.admission_id
    WHERE e.facility_id = ${f}::uuid AND e.status = 'AWAITING_DISCHARGE' AND e.closed_at IS NULL AND a.status = 'ACTIVE'${admDept} GROUP BY a.ward`;
  const pending = new Map(pendingByWard.map((r) => [r.ward ?? "", r.n]));

  const bedCounts: Record<string, number> = {};
  const wardViews: BedWard[] = wards.map((w) => {
    const beds = w.beds.map((b) => {
      const status = (b.status === "MAINTENANCE" ? "MAINTENANCE" : b.isolationReason ? "ISOLATION" : b.status) as BedWard["beds"][number]["status"];
      bedCounts[b.status] = (bedCounts[b.status] ?? 0) + 1;
      if (b.isolationReason) bedCounts.ISOLATION = (bedCounts.ISOLATION ?? 0) + 1;
      return { id: b.id, label: b.label, status };
    });
    const occupied = beds.filter((b) => b.status === "OCCUPIED" || (b.status === "ISOLATION" && w.beds.find((x) => x.id === b.id)?.currentAdmissionId)).length;
    return { wardId: w.id, name: w.name, className: wardClass(w.name, w.code), beds, occupied, inService: beds.filter((b) => b.status !== "MAINTENANCE").length, pendingDischarge: pending.get(w.name) ?? 0 };
  });
  return { wards: wardViews, bedCounts, awaitingAdmission: enc.awaiting_admission, awaitingDischarge: enc.awaiting_discharge, openEmergency: enc.open_emergency, activeAdmissions: active.n };
}

export function liveBedFigures(live: LiveHospital): Figures {
  const total = live.wards.reduce((s, w) => s + w.beds.length, 0);
  const inService = live.wards.reduce((s, w) => s + w.inService, 0);
  const occupied = live.wards.reduce((s, w) => s + w.occupied, 0);
  return {
    beds_total: fig(total),
    bed_occupancy_now: figRatio(occupied, inService),
    awaiting_admission: fig(live.awaitingAdmission),
    awaiting_discharge: fig(live.awaitingDischarge),
  };
}

/* ───────────────────────── dashboard ───────────────────────── */

export async function patientFlowFunnel(ctx: Ctx, p: P): Promise<{ label: string; value: number }[]> {
  const f = ctx.scope.facility.id;
  const [row] = await db.$queryRaw<{ registered: number; triaged: number; assessed: number; admitted: number; discharged: number }[]>`
    SELECT count(*)::int AS registered,
      count(*) FILTER (WHERE e.triaged_at IS NOT NULL)::int AS triaged,
      count(*) FILTER (WHERE EXISTS (SELECT 1 FROM encounter_status_events s WHERE s.encounter_id = e.id AND s.to_status = 'UNDER_ASSESSMENT'))::int AS assessed,
      count(*) FILTER (WHERE e.admission_id IS NOT NULL)::int AS admitted,
      count(*) FILTER (WHERE e.status = 'DISCHARGED')::int AS discharged
    FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.status NOT IN ('CANCELLED') AND e.registered_at >= ${ts(p.start)} AND e.registered_at < ${ts(p.end)}${encounterDeptSql(ctx)}`;
  return [
    { label: "Registered", value: row.registered }, { label: "Triaged", value: row.triaged }, { label: "Clinically assessed", value: row.assessed },
    { label: "Admitted", value: row.admitted }, { label: "Discharged from care", value: row.discharged },
  ];
}

export async function busiestHours(ctx: Ctx, p: P): Promise<{ rows: string[]; cols: string[]; values: number[][] }> {
  const f = ctx.scope.facility.id;
  const local = localTs(Prisma.sql`e.registered_at`, ctx.scope.calendar.timeZone);
  const data = await db.$queryRaw<{ dow: number; hour: number; n: number }[]>`
    SELECT extract(dow FROM ${local})::int AS dow, extract(hour FROM ${local})::int AS hour, count(*)::int AS n
    FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(p.start)} AND e.registered_at < ${ts(p.end)}${encounterDeptSql(ctx)} GROUP BY 1, 2`;
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const order = Array.from({ length: 7 }, (_, i) => (ctx.scope.calendar.weekStartsOn + i) % 7);
  const grid = order.map(() => Array.from({ length: 24 }, () => 0));
  for (const r of data) grid[order.indexOf(r.dow)][r.hour] = r.n;
  return { rows: order.map((d) => days[d]), cols: Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}`), values: grid };
}

export async function hospitalDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const prev = ctx.range.previous;
  const f = ctx.scope.facility.id;
  const granularity = chooseGranularity(cur);
  const cal = ctx.scope.calendar;
  const admSource = Prisma.sql`FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED'${admissionDeptSql(ctx)}`;
  const disSource = Prisma.sql`FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED'${admissionDeptSql(ctx)}`;
  const encSource = Prisma.sql`FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.status <> 'CANCELLED'${encounterDeptSql(ctx)}`;

  const [current, previous, live, admTrend, disTrend, encTrend, funnel, hours, byType, byWard, emergencySplit] = await Promise.all([
    hospitalFigures(ctx, cur),
    prev ? hospitalFigures(ctx, prev) : Promise.resolve(null),
    liveHospital(ctx),
    bucketedCounts(admSource, Prisma.sql`a.admission_date`, cur, granularity, cal),
    bucketedCounts(disSource, Prisma.sql`a.discharge_date`, cur, granularity, cal),
    bucketedCounts(encSource, Prisma.sql`e.registered_at`, cur, granularity, cal),
    patientFlowFunnel(ctx, cur),
    busiestHours(ctx, cur),
    db.$queryRaw<{ type: string; n: number }[]>`SELECT e.type::text AS type, count(*)::int AS n FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(cur.start)} AND e.registered_at < ${ts(cur.end)}${encounterDeptSql(ctx)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ ward: string | null; n: number; deaths: number }[]>`SELECT coalesce(a.ward, 'Unassigned') AS ward, count(*)::int AS n, 0 AS deaths FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(cur.start)} AND a.admission_date < ${ts(cur.end)}${admissionDeptSql(ctx)} GROUP BY 1 ORDER BY 2 DESC LIMIT 12`,
    db.$queryRaw<{ category: string; n: number }[]>`SELECT CASE WHEN e.id IS NULL THEN 'Unclassified' WHEN ${ADMISSION_EMERGENCY_SQL} THEN 'Emergency' ELSE 'Planned' END AS category, count(*)::int AS n FROM admissions a LEFT JOIN encounters e ON e.admission_id = a.id WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(cur.start)} AND a.admission_date < ${ts(cur.end)}${admissionDeptSql(ctx)} GROUP BY 1`,
  ]);

  const liveFigs = liveBedFigures(live);
  const spark = (points: { y: number | null }[]) => points.map((x) => x.y ?? 0);
  const order: [string, string?][] = [
    ["admissions_total", "hospital.admissions"], ["discharges_total", "hospital.discharges"], ["admissions_emergency", "hospital.admissions"],
    ["encounters_total", "hospital.encounters"], ["unique_patients"], ["new_patients"], ["transfers_out", "hospital.transfers"], ["transfers_in", "hospital.transfers"], ["ward_transfers"],
    ["alos"], ["median_los"], ["readmission_rate", "hospital.readmissions"], ["discharge_summary_completion"], ["pending_discharge_summaries", "hospital.pending-summaries"],
    ["bed_occupancy_period"], ["bed_turnover"], ["referrals_received"],
  ];
  const sparks: Record<string, number[]> = { admissions_total: spark(admTrend), discharges_total: spark(disTrend), encounters_total: spark(encTrend) };
  let kpis: KpiValue[] = order.filter(([k]) => current[k]).map(([k, drill]) => makeKpi(k, current[k], previous?.[k] ?? null, { drill, spark: sparks[k] }));
  const liveKeys: [string, string?][] = [["bed_occupancy_now", "hospital.beds"], ["awaiting_admission", "hospital.awaiting-admission"], ["awaiting_discharge", "hospital.awaiting-discharge"]];
  kpis.push(...liveKeys.map(([k, drill]) => makeKpi(k, liveFigs[k], null, { drill })));
  kpis = await attachTargets(f, kpis);

  const sections: Section[] = [
    { id: "flow-trend", title: "Admissions and discharges", question: "Are we admitting faster than we discharge?", visual: { type: "line", unit: "count", series: [{ name: "Admissions", points: admTrend }, { name: "Live discharges", points: disTrend }] }, drill: "hospital.admissions" },
    { id: "funnel", title: "Patient flow", question: "Where do patients drop out between arrival and discharge?", visual: { type: "funnel", steps: funnel }, note: "Counts encounters registered in the period; later steps include only those that reached them so far." },
    { id: "admission-category", title: "Emergency vs planned admissions", question: "How much of our inpatient work is unplanned?", visual: { type: "donut", unit: "count", items: emergencySplit.map((r) => ({ label: r.category, value: r.n })) } },
    { id: "encounter-types", title: "Encounters by type", question: "What kind of care are patients arriving for?", visual: { type: "bars", unit: "count", items: byType.map((r) => ({ label: r.type.replaceAll("_", " ").toLowerCase(), value: r.n })) }, drill: "hospital.encounters" },
    { id: "ward-load", title: "Admissions by ward", question: "Which wards take the most admissions?", visual: { type: "bars", unit: "count", items: byWard.map((r) => ({ label: r.ward ?? "Unassigned", value: r.n })) } },
    { id: "busy-hours", title: "When registration is busiest", question: "Which weekday and hour need the most front-door staffing?", visual: { type: "heatmap", unit: "count", rows: hours.rows, cols: hours.cols, values: hours.values } },
    { id: "bed-map", title: "Bed occupancy map", question: "Which wards have free beds right now?", visual: { type: "beds", wards: live.wards }, drill: "hospital.beds" },
  ];
  const targets = targetsSection(kpis);
  if (targets) sections.push(targets);
  return { kpis, sections, gaps: HOSPITAL_GAPS };
}

export const HOSPITAL_GAPS = [
  gap("Discharges against medical advice", "Discharge disposition has no 'against medical advice' value; the free-text outcome is not parsed."),
  gap("Theatre and surgical analytics", "Medic1905 has no theatre scheduling or surgical case model yet, so theatre utilisation, turnaround and surgical outcomes cannot be calculated."),
  gap("Hospital-acquired infection and surgical-site infection indicators", "Infection events are not recorded as structured data."),
  gap("Patient complaints and complaint resolution time", "Complaints are not recorded against facilities (support tickets are platform-level)."),
  gap("Equipment downtime for the wider hospital", "Only laboratory/diagnostic equipment is tracked."),
];

/* ───────────────────────── mortality & outcomes ───────────────────────── */

export async function mortalityDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const cur = ctx.range.current;
  const prev = ctx.range.previous;
  const f = ctx.scope.facility.id;
  const admDept = admissionDeptSql(ctx);
  const granularity = chooseGranularity(cur);
  const [current, previous] = await Promise.all([hospitalFigures(ctx, cur), prev ? hospitalFigures(ctx, prev) : Promise.resolve(null)]);
  const inP = Prisma.sql`a.discharge_date >= ${ts(cur.start)} AND a.discharge_date < ${ts(cur.end)}`;

  const [byWard, byDiagnosis, byCategory, ages, trend] = await Promise.all([
    db.$queryRaw<{ label: string; deaths: number; exits: number }[]>`SELECT coalesce(a.ward, 'Unassigned') AS label, count(*) FILTER (WHERE a.disposition = 'DECEASED')::int AS deaths, count(*)::int AS exits FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND ${inP}${admDept} GROUP BY 1 ORDER BY 3 DESC`,
    db.$queryRaw<{ label: string; deaths: number }[]>`SELECT coalesce(nullif(btrim(a.final_diagnosis_name), ''), 'No final diagnosis recorded') AS label, count(*)::int AS deaths FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.disposition = 'DECEASED' AND ${inP}${admDept} GROUP BY 1 ORDER BY 2 DESC LIMIT 15`,
    db.$queryRaw<{ label: string; deaths: number; exits: number }[]>`SELECT CASE WHEN e.id IS NULL THEN 'Unclassified' WHEN ${ADMISSION_EMERGENCY_SQL} THEN 'Emergency admission' ELSE 'Planned admission' END AS label, count(*) FILTER (WHERE a.disposition = 'DECEASED')::int AS deaths, count(*)::int AS exits FROM admissions a LEFT JOIN encounters e ON e.admission_id = a.id WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND ${inP}${admDept} GROUP BY 1`,
    db.$queryRaw<{ dob: Date | null; deaths: number }[]>`SELECT p.date_of_birth AS dob, count(*)::int AS deaths FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.disposition = 'DECEASED' AND ${inP}${admDept} GROUP BY 1`,
    bucketedMortality(ctx, cur, granularity),
  ]);

  const bandCounts = new Map<string, number>(AGE_BANDS.map((b) => [b, 0]));
  for (const r of ages) { const band = ageBand(r.dob, cur.end); bandCounts.set(band, (bandCounts.get(band) ?? 0) + r.deaths); }
  const ageRows = suppressSmall(AGE_BANDS.map((b) => ({ label: b as string, count: bandCounts.get(b) ?? 0 })).filter((r) => r.count > 0));
  const diagRows = suppressSmall(byDiagnosis.map((r) => ({ label: r.label, count: r.deaths })));

  const kpis = await attachTargets(f, [
    makeKpi("inpatient_mortality_rate", current.inpatient_mortality_rate, previous?.inpatient_mortality_rate ?? null, { drill: "mortality.deaths" }),
    makeKpi("inpatient_deaths", current.inpatient_deaths, previous?.inpatient_deaths ?? null, { drill: "mortality.deaths" }),
    makeKpi("discharges_total", current.discharges_total, previous?.discharges_total ?? null, { drill: "hospital.discharges" }),
    makeKpi("transfers_out", current.transfers_out, previous?.transfers_out ?? null, { drill: "hospital.transfers", note: "Transfers out are not part of the mortality denominator; outcomes after transfer are unknown to this facility." }),
    makeKpi("readmission_rate", current.readmission_rate, previous?.readmission_rate ?? null, { drill: "hospital.readmissions" }),
    makeKpi("alos", current.alos, previous?.alos ?? null),
  ]);

  const rate = (n: number, d: number) => (d > 0 ? round((n / d) * 100, 1) : null);
  const sections: Section[] = [
    { id: "mortality-trend", title: "Mortality rate and deaths over time", question: "Is the crude inpatient mortality rate moving, and on how many cases?", visual: { type: "table", columns: [{ key: "period", label: "Period" }, { key: "deaths", label: "Deaths", align: "right" }, { key: "exits", label: "Exits (denominator)", align: "right" }, { key: "rate", label: "Rate %", align: "right" }], rows: trend.map((t) => ({ period: t.x, deaths: t.deaths, exits: t.exits, rate: rate(t.deaths, t.exits) })), footnote: "Rates over fewer than 20 exits are unstable; treat them as signals for clinical review, not conclusions." } },
    { id: "by-category", title: "By admission category", question: "Do outcomes differ between emergency and planned admissions?", visual: { type: "table", columns: [{ key: "label", label: "Category" }, { key: "deaths", label: "Deaths", align: "right" }, { key: "exits", label: "Exits", align: "right" }, { key: "rate", label: "Rate %", align: "right" }], rows: byCategory.map((r) => ({ label: r.label, deaths: r.deaths, exits: r.exits, rate: rate(r.deaths, r.exits) })), footnote: "Emergency admissions are expected to carry higher crude mortality; do not compare categories without case-mix adjustment." } },
    { id: "by-ward", title: "By ward", question: "Which wards carry the deaths, relative to the patients they discharge?", visual: { type: "table", columns: [{ key: "label", label: "Ward" }, { key: "deaths", label: "Deaths", align: "right" }, { key: "exits", label: "Exits", align: "right" }, { key: "rate", label: "Rate %", align: "right" }], rows: byWard.map((r) => ({ label: r.label, deaths: r.deaths, exits: r.exits, rate: rate(r.deaths, r.exits) })), footnote: "Intensive-care wards treat sicker patients; a higher crude rate there is expected." } },
    { id: "by-age", title: "Deaths by age group", question: "Which age groups account for deaths?", visual: { type: "bars", unit: "count", items: ageRows.rows.map((r) => ({ label: r.label, value: r.count })) }, note: ageRows.suppressed ? `${ageRows.suppressed} group(s) with fewer than 5 deaths are hidden to protect patient privacy.` : undefined },
    { id: "by-diagnosis", title: "Deaths by documented final diagnosis", question: "Which conditions are recorded for patients who died?", visual: { type: "bars", unit: "count", items: diagRows.rows.map((r) => ({ label: r.label, value: r.count })) }, note: "Medic1905 records a final diagnosis, not a separate cause of death. Groups with fewer than 5 deaths are hidden." },
  ];
  const targets = targetsSection(kpis);
  if (targets) sections.push(targets);
  sections.push({ id: "definitions", title: "How these figures are defined", question: "What exactly is being counted?", visual: { type: "definitions", items: ["inpatient_mortality_rate", "inpatient_deaths", "readmission_rate", "alos"].map((k) => ({ key: k, name: nameOf(k), formula: formulaOf(k), caveat: caveatOf(k) })) } });
  return {
    kpis, sections,
    gaps: [
      gap("Risk-adjusted mortality", "Requires validated acuity and case-mix data (for example a severity score per admission) that Medic1905 does not record."),
      gap("Emergency-department and pre-admission deaths", "The encounter workflow has no death outcome, so these cannot be reported without mixing them into inpatient deaths; they are deliberately excluded."),
      gap("Morbidity and mortality reviews", "Review meetings are not recorded."),
      gap("Complications, adverse events and patient-safety incidents", "No structured incident or complication records exist yet."),
      gap("Individual clinician attribution of deaths", "Deliberately not provided: a death is not attributed to one doctor or nurse."),
    ],
  };
}

import { getMetric } from "./registry";
const nameOf = (k: string) => getMetric(k)?.name ?? k;
const formulaOf = (k: string) => getMetric(k)?.formula ?? "";
const caveatOf = (k: string) => getMetric(k)?.caveat;

async function bucketedMortality(ctx: Ctx, period: ResolvedPeriod, granularity: ReturnType<typeof chooseGranularity>) {
  const f = ctx.scope.facility.id;
  const { bucketExpr } = await import("./sql");
  const { bucketStarts } = await import("./periods");
  const bucket = bucketExpr(Prisma.sql`a.discharge_date`, granularity, ctx.scope.calendar);
  const rows = await db.$queryRaw<{ bucket: string; deaths: number; exits: number }[]>`
    SELECT ${bucket} AS bucket, count(*) FILTER (WHERE a.disposition = 'DECEASED')::int AS deaths, count(*)::int AS exits
    FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.discharge_date >= ${ts(period.start)} AND a.discharge_date < ${ts(period.end)}${admissionDeptSql(ctx)} GROUP BY 1`;
  const map = new Map(rows.map((r) => [r.bucket, r]));
  return bucketStarts(period, granularity, ctx.scope.calendar.weekStartsOn).map((x) => ({ x, deaths: map.get(x)?.deaths ?? 0, exits: map.get(x)?.exits ?? 0 }));
}

export { MIN_RELIABLE_SAMPLE, minutesDiff, num, ratio, ageBand as _ageBand };
