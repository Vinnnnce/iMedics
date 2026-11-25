/**
 * Drill-down: the records behind a number.
 *
 * Every figure that links to a drill key shows the same period and department scope as the
 * dashboard it came from. Rows are de-identified by default (record dates, categories, ward, age
 * band). Patient case numbers appear only for staff with patient-record permission and a full-facility
 * access level, and every drill-down request is written to the audit trail.
 */
import { Prisma } from "@prisma/client";
import { db, localTs, ts } from "./sql";
import { admissionDeptSql, encounterDeptSql, type Ctx } from "./core";
import { assertDashboardAllowed } from "./scope";
import { forbidden, notFound } from "@/lib/errors";
import type { DashboardKey, DrilldownPage } from "./types";

type Col = { key: string; label: string };
interface Def {
  title: string;
  dashboard: DashboardKey;
  columns: Col[];
  /** FROM … WHERE … fragment; may use alias `p` for patients when `identified`. */
  from: (ctx: Ctx, identified: boolean) => Prisma.Sql;
  select: (ctx: Ctx, identified: boolean) => Prisma.Sql;
  order: Prisma.Sql;
  needsFinance?: boolean;
}

const f = (ctx: Ctx) => ctx.scope.facility.id;
const P = (ctx: Ctx) => ctx.range.current;
const inP = (ctx: Ctx, col: string) => Prisma.sql`${Prisma.raw(col)} >= ${ts(P(ctx).start)} AND ${Prisma.raw(col)} < ${ts(P(ctx).end)}`;
const dt = (ctx: Ctx, col: string, alias: string) => Prisma.sql`to_char(${localTs(Prisma.raw(col) as unknown as Prisma.Sql, ctx.scope.calendar.timeZone)}, 'YYYY-MM-DD HH24:MI') AS ${Prisma.raw(alias)}`;
const patient = (identified: boolean, col = "p.case_number") => (identified ? Prisma.sql`, ${Prisma.raw(col)} AS patient` : Prisma.empty);
const patientCol = (identified: boolean): Col[] => (identified ? [{ key: "patient", label: "Case number" }] : []);
const join = (identified: boolean, on: string) => (identified ? Prisma.sql`JOIN patients p ON p.id = ${Prisma.raw(on)}` : Prisma.empty);
const ageBandSql = (dobCol: string) => Prisma.sql`CASE WHEN ${Prisma.raw(dobCol)} IS NULL THEN 'Unknown' WHEN age(${Prisma.raw(dobCol)}) < interval '5 years' THEN '0–4' WHEN age(${Prisma.raw(dobCol)}) < interval '18 years' THEN '5–17' WHEN age(${Prisma.raw(dobCol)}) < interval '40 years' THEN '18–39' WHEN age(${Prisma.raw(dobCol)}) < interval '60 years' THEN '40–59' WHEN age(${Prisma.raw(dobCol)}) < interval '80 years' THEN '60–79' ELSE '80+' END`;
const sid = (col: string) => Prisma.sql`left(${Prisma.raw(col)}::text, 8) AS ref`;

const admissionDef = (title: string, cond: (ctx: Ctx) => Prisma.Sql, dateCol: string, dashboard: DashboardKey = "hospital"): Def => ({
  title, dashboard,
  columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "date", label: "Date" }, { key: "ward", label: "Ward" }, { key: "status", label: "Status" }, { key: "disposition", label: "Disposition" }, { key: "diagnosis", label: "Final diagnosis" }, { key: "age", label: "Age band" }],
  from: (ctx, id) => Prisma.sql`FROM admissions a JOIN patients p ON p.id = a.patient_id WHERE a.facility_id = ${f(ctx)}::uuid AND ${cond(ctx)}${admissionDeptSql(ctx)}${id ? Prisma.empty : Prisma.empty}`,
  select: (ctx, id) => Prisma.sql`${sid("a.id")}, ${dt(ctx, dateCol, "date")}, a.ward AS ward, a.status::text AS status, a.disposition::text AS disposition, a.final_diagnosis_name AS diagnosis, ${ageBandSql("p.date_of_birth")} AS age${patient(id)}`,
  order: Prisma.sql`${Prisma.raw(dateCol)} DESC, a.id`,
});

const encounterDef = (title: string, cond: (ctx: Ctx) => Prisma.Sql, dashboard: DashboardKey = "hospital"): Def => ({
  title, dashboard,
  columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "date", label: "Registered" }, { key: "type", label: "Type" }, { key: "priority", label: "Priority" }, { key: "status", label: "Status" }, { key: "department", label: "Department" }],
  from: (ctx) => Prisma.sql`FROM encounters e JOIN patients p ON p.id = e.patient_id WHERE e.facility_id = ${f(ctx)}::uuid AND ${cond(ctx)}${encounterDeptSql(ctx)}`,
  select: (ctx, id) => Prisma.sql`${sid("e.id")}, ${dt(ctx, "e.registered_at", "date")}, e.type::text AS type, e.priority::text AS priority, e.status::text AS status, e.department AS department${patient(id)}`,
  order: Prisma.sql`e.registered_at DESC, e.id`,
});

export const DRILLDOWNS: Record<string, Def> = {
  "hospital.admissions": admissionDef("Admissions", (c) => Prisma.sql`a.status <> 'CANCELLED' AND ${inP(c, "a.admission_date")}`, "a.admission_date"),
  "hospital.discharges": admissionDef("Live discharges", (c) => Prisma.sql`a.status = 'DISCHARGED' AND a.disposition IS DISTINCT FROM 'DECEASED' AND ${inP(c, "a.discharge_date")}`, "a.discharge_date"),
  "mortality.deaths": admissionDef("Inpatient deaths", (c) => Prisma.sql`a.status = 'DISCHARGED' AND a.disposition = 'DECEASED' AND ${inP(c, "a.discharge_date")}`, "a.discharge_date", "mortality"),
  "hospital.transfers": admissionDef("Inter-facility transfers out", (c) => Prisma.sql`a.status = 'TRANSFERRED' AND coalesce(a.discharge_date, a.updated_at) >= ${ts(P(c).start)} AND coalesce(a.discharge_date, a.updated_at) < ${ts(P(c).end)}`, "coalesce(a.discharge_date, a.updated_at)"),
  "hospital.readmissions": admissionDef("Readmissions", (c) => Prisma.sql`a.status <> 'CANCELLED' AND ${inP(c, "a.admission_date")} AND EXISTS (SELECT 1 FROM admissions prev WHERE prev.facility_id = a.facility_id AND prev.patient_id = a.patient_id AND prev.id <> a.id AND prev.status = 'DISCHARGED' AND prev.disposition IS DISTINCT FROM 'DECEASED' AND prev.discharge_date <= a.admission_date AND prev.discharge_date >= a.admission_date - interval '30 days')`, "a.admission_date"),
  "hospital.pending-summaries": admissionDef("Discharges without a discharge summary", (c) => Prisma.sql`a.status = 'DISCHARGED' AND (a.epicrisis IS NULL OR btrim(a.epicrisis) = '') AND ${inP(c, "a.discharge_date")}`, "a.discharge_date"),
  "hospital.encounters": encounterDef("Encounters", (c) => Prisma.sql`e.status <> 'CANCELLED' AND ${inP(c, "e.registered_at")}`),
  "emergency.arrivals": encounterDef("Emergency-department arrivals", (c) => Prisma.sql`e.type = 'EMERGENCY_DEPARTMENT' AND e.status <> 'CANCELLED' AND ${inP(c, "e.registered_at")}`, "emergency"),
  "hospital.awaiting-admission": encounterDef("Awaiting admission now", () => Prisma.sql`e.status = 'AWAITING_ADMISSION' AND e.closed_at IS NULL`),
  "hospital.awaiting-discharge": encounterDef("Awaiting discharge now", () => Prisma.sql`e.status = 'AWAITING_DISCHARGE' AND e.closed_at IS NULL`),
  "hospital.beds": {
    title: "Beds", dashboard: "hospital",
    columns: [{ key: "ward", label: "Ward" }, { key: "bed", label: "Bed" }, { key: "status", label: "Status" }, { key: "isolation", label: "Isolation reason" }],
    from: (ctx) => Prisma.sql`FROM beds b JOIN wards w ON w.id = b.ward_id WHERE b.facility_id = ${f(ctx)}::uuid${ctx.dept ? Prisma.sql` AND w.name IN (${ctx.dept.wardNames.length ? Prisma.join(ctx.dept.wardNames.map((n) => Prisma.sql`${n}`)) : Prisma.sql`NULL`})` : Prisma.empty}`,
    select: () => Prisma.sql`w.name AS ward, b.label AS bed, b.status::text AS status, b."isolationReason" AS isolation`,
    order: Prisma.sql`w.name, b.label`,
  },
  "nursing.tasks": {
    title: "Nursing tasks", dashboard: "nursing",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "due", label: "Due" }, { key: "status", label: "Status" }, { key: "completed", label: "Completed" }, { key: "title", label: "Task" }],
    from: (ctx) => Prisma.sql`FROM nursing_task t JOIN patients p ON p.id = t.patient_id WHERE t.facility_id = ${f(ctx)}::uuid AND ${inP(ctx, "coalesce(t.due_at, t.created_at)")}`,
    select: (ctx, id) => Prisma.sql`${sid("t.id")}, ${dt(ctx, "coalesce(t.due_at, t.created_at)", "due")}, t.status AS status, ${dt(ctx, "t.completed_at", "completed")}, t.title AS title${patient(id)}`,
    order: Prisma.sql`coalesce(t.due_at, t.created_at) DESC, t.id`,
  },
  "nursing.overdue": {
    title: "Overdue nursing tasks", dashboard: "nursing",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "due", label: "Due" }, { key: "status", label: "Status" }, { key: "title", label: "Task" }],
    from: (ctx) => Prisma.sql`FROM nursing_task t JOIN patients p ON p.id = t.patient_id WHERE t.facility_id = ${f(ctx)}::uuid AND t.status <> 'COMPLETED' AND t.due_at < ${ts(ctx.now)}`,
    select: (ctx, id) => Prisma.sql`${sid("t.id")}, ${dt(ctx, "t.due_at", "due")}, t.status AS status, t.title AS title${patient(id)}`,
    order: Prisma.sql`t.due_at, t.id`,
  },
  "nursing.observations": {
    title: "Nursing observations", dashboard: "nursing",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "at", label: "Recorded" }, { key: "type", label: "Type" }],
    from: (ctx) => Prisma.sql`FROM nursing_observation o JOIN patients p ON p.id = o.patient_id WHERE o.facility_id = ${f(ctx)}::uuid AND ${inP(ctx, "o.recorded_at")}`,
    select: (ctx, id) => Prisma.sql`${sid("o.id")}, ${dt(ctx, "o.recorded_at", "at")}, o.observation_type AS type${patient(id)}`,
    order: Prisma.sql`o.recorded_at DESC, o.id`,
  },
  "lab.orders": {
    title: "Laboratory requests", dashboard: "laboratory",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "date", label: "Created" }, { key: "status", label: "Status" }, { key: "priority", label: "Priority" }],
    from: (ctx) => Prisma.sql`FROM lab_orders o JOIN patients p ON p.id = o.patient_id WHERE o.performing_facility_id = ${f(ctx)}::uuid AND ${inP(ctx, "o.created_at")}`,
    select: (ctx, id) => Prisma.sql`${sid("o.id")}, ${dt(ctx, "o.created_at", "date")}, o.status::text AS status, o.priority::text AS priority${patient(id)}`,
    order: Prisma.sql`o.created_at DESC, o.id`,
  },
  "lab.specimens": specimenDef("Specimens", (c) => Prisma.sql`${inP(c, "coalesce(s.received_at, s.collected_at, s.created_at)")}`),
  "lab.rejected": specimenDef("Rejected and recollection-requested specimens", (c) => Prisma.sql`s.status IN ('REJECTED','RECOLLECTION_REQUESTED') AND ${inP(c, "s.received_at")}`),
  "lab.pending-specimens": specimenDef("Specimens awaiting collection or processing", () => Prisma.sql`s.status IN ('PENDING_COLLECTION','COLLECTED','RECEIVED')`),
  "lab.pending-results": {
    title: "Results awaiting verification", dashboard: "laboratory",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "entered", label: "Entered" }, { key: "category", label: "Category" }, { key: "status", label: "Status" }],
    from: (ctx) => Prisma.sql`FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id JOIN patients p ON p.id = o.patient_id WHERE o.performing_facility_id = ${f(ctx)}::uuid AND r.status IN ('PENDING','PENDING_AI_ANALYSIS','AI_ANALYSIS_COMPLETE')`,
    select: (ctx, id) => Prisma.sql`${sid("r.id")}, ${dt(ctx, "r.created_at", "entered")}, r.category::text AS category, r.status::text AS status${patient(id)}`,
    order: Prisma.sql`r.created_at, r.id`,
  },
  "lab.critical": {
    title: "Critical-result alerts", dashboard: "laboratory",
    columns: [{ key: "ref", label: "Ref" }, { key: "raised", label: "Raised" }, { key: "status", label: "Status" }, { key: "ack", label: "Acknowledged" }],
    from: (ctx) => Prisma.sql`FROM critical_result_alerts c WHERE c.ordering_facility_id = ${f(ctx)}::uuid AND (${inP(ctx, "c.created_at")} OR c.status IN ('SENT','ESCALATED'))`,
    select: (ctx) => Prisma.sql`${sid("c.id")}, ${dt(ctx, "c.created_at", "raised")}, c.status::text AS status, ${dt(ctx, 'c."acknowledgedAt"', "ack")}`,
    order: Prisma.sql`c.created_at DESC, c.id`,
  },
  "lab.qc": {
    title: "Quality-control runs", dashboard: "laboratory",
    columns: [{ key: "ref", label: "Ref" }, { key: "at", label: "Performed" }, { key: "result", label: "Result" }],
    from: (ctx) => Prisma.sql`FROM lab_quality_control_runs q WHERE q.facility_id = ${f(ctx)}::uuid AND ${inP(ctx, "q.performed_at")}`,
    select: (ctx) => Prisma.sql`${sid("q.id")}, ${dt(ctx, "q.performed_at", "at")}, q.result::text AS result`,
    order: Prisma.sql`q.performed_at DESC, q.id`,
  },
  "lab.equipment": {
    title: "Equipment", dashboard: "laboratory",
    columns: [{ key: "name", label: "Equipment" }, { key: "status", label: "Status" }, { key: "due", label: "Next service due" }],
    from: (ctx) => Prisma.sql`FROM lab_equipment e WHERE e.facility_id = ${f(ctx)}::uuid`,
    select: (ctx) => Prisma.sql`e.name AS name, e.status::text AS status, ${dt(ctx, "e.next_service_due_at", "due")}`,
    order: Prisma.sql`e.name`,
  },
  "lab.reagents": {
    title: "Reagents at minimum stock or near expiry", dashboard: "laboratory",
    columns: [{ key: "name", label: "Reagent" }, { key: "qty", label: "Quantity" }, { key: "min", label: "Minimum" }, { key: "expires", label: "Expires" }],
    from: (ctx) => Prisma.sql`FROM lab_reagents r WHERE r.facility_id = ${f(ctx)}::uuid AND (r.quantity <= r.min_stock_level OR r.expires_at <= ${ts(new Date(ctx.now.getTime() + 30 * 86_400_000))})`,
    select: (ctx) => Prisma.sql`r.name AS name, r.quantity AS qty, r.min_stock_level AS min, ${dt(ctx, "r.expires_at", "expires")}`,
    order: Prisma.sql`r.name`,
  },
  "dx.requests": {
    title: "Diagnostic requests", dashboard: "diagnostic",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "created", label: "Requested" }, { key: "service", label: "Examination" }, { key: "stage", label: "Stage" }, { key: "status", label: "Status" }],
    from: (ctx) => Prisma.sql`FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id JOIN patients p ON p.id = b.patient_id WHERE s.facility_id = ${f(ctx)}::uuid AND s.category IN ('IMAGING','PROCEDURE') AND ${inP(ctx, "b.created_at")}`,
    select: (ctx, id) => Prisma.sql`${sid("b.id")}, ${dt(ctx, "b.created_at", "created")}, s.name AS service, b.workflow_stage::text AS stage, b.status::text AS status${patient(id)}`,
    order: Prisma.sql`b.created_at DESC, b.id`,
  },
  "dx.pending-reports": {
    title: "Diagnostic reports awaiting interpretation or verification", dashboard: "diagnostic",
    columns: [{ key: "ref", label: "Ref" }, { key: "created", label: "Created" }, { key: "status", label: "Status" }],
    from: (ctx) => Prisma.sql`FROM diagnostic_reports r WHERE r.facility_id = ${f(ctx)}::uuid AND r.status IN ('DRAFT','AWAITING_VERIFICATION')`,
    select: (ctx) => Prisma.sql`${sid("r.id")}, ${dt(ctx, "r.created_at", "created")}, r.status::text AS status`,
    order: Prisma.sql`r.created_at, r.id`,
  },
  "pharmacy.orders": {
    title: "Medication orders", dashboard: "pharmacy",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "created", label: "Created" }, { key: "medicine", label: "Medicine" }, { key: "status", label: "Status" }, { key: "dispensed", label: "Dispensed" }],
    from: (ctx) => Prisma.sql`FROM medication_order m JOIN patients p ON p.id = m.patient_id WHERE m.facility_id = ${f(ctx)}::uuid AND m.status <> 'DRAFT' AND ${inP(ctx, "m.created_at")}`,
    select: (ctx, id) => Prisma.sql`${sid("m.id")}, ${dt(ctx, "m.created_at", "created")}, m.medication_name AS medicine, m.status AS status, ${dt(ctx, "m.dispensed_at", "dispensed")}${patient(id)}`,
    order: Prisma.sql`m.created_at DESC, m.id`,
  },
  "pharmacy.pending": {
    title: "Orders awaiting review or dispensing", dashboard: "pharmacy",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "created", label: "Created" }, { key: "medicine", label: "Medicine" }, { key: "status", label: "Status" }],
    from: (ctx) => Prisma.sql`FROM medication_order m JOIN patients p ON p.id = m.patient_id WHERE m.facility_id = ${f(ctx)}::uuid AND m.status IN ('SUBMITTED','REVIEWED')`,
    select: (ctx, id) => Prisma.sql`${sid("m.id")}, ${dt(ctx, "m.created_at", "created")}, m.medication_name AS medicine, m.status AS status${patient(id)}`,
    order: Prisma.sql`m.created_at, m.id`,
  },
  "pharmacy.stock": stockDef("Stock on hand", () => Prisma.sql`b.quantity > 0`),
  "pharmacy.expiring": stockDef("Batches expiring within 90 days", (c) => Prisma.sql`b.quantity > 0 AND b.expires_at >= ${ts(c.now)} AND b.expires_at <= ${ts(new Date(c.now.getTime() + 90 * 86_400_000))}`),
  "pharmacy.expired": stockDef("Expired batches with stock", (c) => Prisma.sql`b.quantity > 0 AND b.expires_at < ${ts(c.now)}`),
  "pharmacy.stockout": {
    title: "Formulary items with no unexpired stock", dashboard: "pharmacy",
    columns: [{ key: "medicine", label: "Medicine" }],
    from: (ctx) => Prisma.sql`FROM formulary_item fi WHERE fi.facility_id = ${f(ctx)}::uuid AND fi.active AND NOT EXISTS (SELECT 1 FROM pharmacy_stock_batches b WHERE b.facility_id = fi.facility_id AND lower(b.medication_name) = lower(fi.medication_name) AND b.quantity > 0 AND b.expires_at >= ${ts(ctx.now)})`,
    select: () => Prisma.sql`fi.medication_name AS medicine`,
    order: Prisma.sql`fi.medication_name`,
  },
  "finance.payments": {
    title: "Payments", dashboard: "financial", needsFinance: true,
    columns: [{ key: "ref", label: "Ref" }, { key: "paid", label: "Paid" }, { key: "service", label: "Service" }, { key: "amount", label: "Amount" }, { key: "currency", label: "Currency" }, { key: "status", label: "Status" }],
    from: (ctx) => Prisma.sql`FROM payments p JOIN facility_bookings b ON b.id = p.facility_booking_id JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f(ctx)}::uuid AND coalesce(p.paid_at, p.created_at) >= ${ts(P(ctx).start)} AND coalesce(p.paid_at, p.created_at) < ${ts(P(ctx).end)}`,
    select: (ctx) => Prisma.sql`${sid("p.id")}, ${dt(ctx, "p.paid_at", "paid")}, s.name AS service, p.amount::float AS amount, p.currency AS currency, p.status::text AS status`,
    order: Prisma.sql`coalesce(p.paid_at, p.created_at) DESC, p.id`,
  },
  "quality.documents": {
    title: "Clinical documents awaiting completion", dashboard: "quality",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "created", label: "Created" }, { key: "status", label: "Status" }, { key: "department", label: "Department" }],
    from: (ctx) => Prisma.sql`FROM clinical_documents d JOIN patients p ON p.id = d.patient_id WHERE d.facility_id = ${f(ctx)}::uuid AND d.deleted_at IS NULL AND d.status IN ('DRAFT','PENDING_REVIEW','PENDING_SIGNATURE')`,
    select: (ctx, id) => Prisma.sql`${sid("d.id")}, ${dt(ctx, "d.created_at", "created")}, d.status::text AS status, d.department AS department${patient(id)}`,
    order: Prisma.sql`d.created_at, d.id`,
  },
};

function specimenDef(title: string, cond: (c: Ctx) => Prisma.Sql): Def {
  return {
    title, dashboard: "laboratory",
    columns: [{ key: "ref", label: "Ref" }, ...patientCol(true), { key: "collected", label: "Collected" }, { key: "received", label: "Received" }, { key: "status", label: "Status" }, { key: "type", label: "Specimen" }],
    from: (ctx) => Prisma.sql`FROM specimens s JOIN lab_orders o ON o.id = s.lab_order_id JOIN patients p ON p.id = o.patient_id WHERE s.facility_id = ${f(ctx)}::uuid AND ${cond(ctx)}`,
    select: (ctx, id) => Prisma.sql`${sid("s.id")}, ${dt(ctx, "s.collected_at", "collected")}, ${dt(ctx, "s.received_at", "received")}, s.status::text AS status, s."specimenType"::text AS type${patient(id)}`,
    order: Prisma.sql`coalesce(s.received_at, s.collected_at, s.created_at) DESC, s.id`,
  };
}

function stockDef(title: string, cond: (c: Ctx) => Prisma.Sql): Def {
  return {
    title, dashboard: "pharmacy",
    columns: [{ key: "medicine", label: "Medicine" }, { key: "batch", label: "Batch" }, { key: "qty", label: "Quantity" }, { key: "expires", label: "Expires" }],
    from: (ctx) => Prisma.sql`FROM pharmacy_stock_batches b WHERE b.facility_id = ${f(ctx)}::uuid AND ${cond(ctx)}`,
    select: (ctx) => Prisma.sql`b.medication_name AS medicine, b.batch_number AS batch, b.quantity AS qty, ${dt(ctx, "b.expires_at", "expires")}`,
    order: Prisma.sql`b.expires_at, b.medication_name`,
  };
}

export const DRILL_PAGE_SIZE = 50;
export const MAX_DRILL_PAGE_SIZE = 200;

export function isDrillKey(key: string): boolean { return Object.prototype.hasOwnProperty.call(DRILLDOWNS, key); }

export async function loadDrilldown(ctx: Ctx, key: string, page = 1, pageSize = DRILL_PAGE_SIZE, wantIdentified = false): Promise<DrilldownPage> {
  const def = isDrillKey(key) ? DRILLDOWNS[key] : undefined;
  if (!def) throw notFound("Unknown drill-down");
  assertDashboardAllowed(ctx.scope, def.dashboard);
  if (def.needsFinance && !ctx.scope.canViewFinancial) throw forbidden("Your role does not allow financial records");
  const identified = wantIdentified && ctx.scope.canIdentifyPatients;
  const size = Math.min(Math.max(1, Math.floor(pageSize) || DRILL_PAGE_SIZE), MAX_DRILL_PAGE_SIZE);
  const pg = Math.max(1, Math.floor(page) || 1);
  const from = def.from(ctx, identified);
  const [[{ n }], rows] = await Promise.all([
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from}`,
    db.$queryRaw<Record<string, string | number | null>[]>`SELECT ${def.select(ctx, identified)} ${from} ORDER BY ${def.order} LIMIT ${size} OFFSET ${(pg - 1) * size}`,
  ]);
  const columns = def.columns.filter((c) => identified || c.key !== "patient");
  return {
    key, title: def.title, columns, total: n, page: pg, pageSize: size, identified,
    rows: rows.map((r) => Object.fromEntries(columns.map((c) => [c.key, typeof r[c.key] === "bigint" ? Number(r[c.key]) : (r[c.key] ?? null)]))),
    period: { startDate: ctx.range.current.startDate, endDate: ctx.range.current.endDate, label: ctx.range.current.label },
  };
}
void join;
