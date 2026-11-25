import { Prisma } from "@prisma/client";
import { db, bucketedCounts, minutesDiff, ts } from "./sql";
import { attachTargets, fig, figRatio, gap, makeKpi, targetsSection, type Ctx, type Figures } from "./core";
import { chooseGranularity } from "./periods";
import { round, summariseDurations, MIN_RELIABLE_SAMPLE } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

interface P { start: Date; end: Date }
type Part = Pick<DashboardPayload, "kpis" | "sections" | "gaps">;

/* ───────────────────────── financial ───────────────────────── */

const FIN_BASE = (f: string) => Prisma.sql`FROM payments p JOIN facility_bookings b ON b.id = p.facility_booking_id JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid`;

export async function financialFigures(ctx: Ctx, p: P, currency: string): Promise<Figures> {
  const f = ctx.scope.facility.id;
  const [row] = await db.$queryRaw<{ revenue: number | null; outstanding: number | null; refunds: number | null; paid: number }[]>`
    SELECT sum(p.amount) FILTER (WHERE p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(p.start)} AND p.paid_at < ${ts(p.end)})::float AS revenue,
      sum(p.amount) FILTER (WHERE p.status = 'PENDING' AND (p.expires_at IS NULL OR p.expires_at > ${ts(ctx.now)}) AND p.created_at >= ${ts(p.start)} AND p.created_at < ${ts(p.end)})::float AS outstanding,
      sum(p.amount) FILTER (WHERE p.status IN ('REFUNDED','REFUND_PENDING') AND coalesce(p.refunded_at, p.created_at) >= ${ts(p.start)} AND coalesce(p.refunded_at, p.created_at) < ${ts(p.end)})::float AS refunds,
      count(*) FILTER (WHERE p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(p.start)} AND p.paid_at < ${ts(p.end)})::int AS paid
    ${FIN_BASE(f)} AND p.currency = ${currency}`;
  return {
    revenue_total: fig(row.revenue === null ? 0 : round(row.revenue, 2), { currency, sampleSize: row.paid }),
    revenue_outstanding: fig(row.outstanding === null ? 0 : round(row.outstanding, 2), { currency }),
    refunds_total: fig(row.refunds === null ? 0 : round(row.refunds, 2), { currency }),
  };
}

export async function financialDashboard(ctx: Ctx): Promise<Part> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const cal = ctx.scope.calendar;
  const granularity = chooseGranularity(cur);
  const currencies = await db.$queryRaw<{ currency: string; n: number }[]>`SELECT p.currency, count(*)::int AS n ${FIN_BASE(f)} AND p.created_at >= ${ts(cur.start)} AND p.created_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`;
  const currency = currencies[0]?.currency ?? "NGN";
  const [current, previous] = await Promise.all([financialFigures(ctx, cur, currency), ctx.range.previous ? financialFigures(ctx, ctx.range.previous, currency) : null]);
  const bucket = (await import("./sql")).bucketExpr(Prisma.sql`p.paid_at`, granularity, cal);
  const { bucketStarts } = await import("./periods");
  const [series, byCategory, byDepartment, byService, claims] = await Promise.all([
    db.$queryRaw<{ bucket: string; v: number }[]>`SELECT ${bucket} AS bucket, sum(p.amount)::float AS v ${FIN_BASE(f)} AND p.currency = ${currency} AND p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)} GROUP BY 1`,
    db.$queryRaw<{ label: string; v: number }[]>`SELECT s.category::text AS label, sum(p.amount)::float AS v ${FIN_BASE(f)} AND p.currency = ${currency} AND p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ label: string; v: number }[]>`SELECT coalesce(d.name, 'No department') AS label, sum(p.amount)::float AS v FROM payments p JOIN facility_bookings b ON b.id = p.facility_booking_id JOIN facility_services s ON s.id = b.service_id LEFT JOIN facility_departments d ON d.id = s.department_id WHERE s.facility_id = ${f}::uuid AND p.currency = ${currency} AND p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC`,
    db.$queryRaw<{ label: string; v: number; n: number }[]>`SELECT s.name AS label, sum(p.amount)::float AS v, count(*)::int AS n ${FIN_BASE(f)} AND p.currency = ${currency} AND p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)} GROUP BY 1 ORDER BY 2 DESC LIMIT 10`,
    ctx.scope.permissions.includes("MANAGE_INSURANCE") ? db.$queryRaw<{ label: string; n: number }[]>`SELECT c.claim_status::text AS label, count(*)::int AS n FROM payer_coverages c WHERE c.facility_id = ${f}::uuid AND c.active AND c.category <> 'SELF_PAY' GROUP BY 1` : Promise.resolve(null),
  ]);
  const map = new Map(series.map((r) => [r.bucket, r.v]));
  const points = bucketStarts(cur, granularity, cal.weekStartsOn).map((x) => ({ x, y: round(map.get(x) ?? 0, 2) }));
  let kpis: KpiValue[] = [
    makeKpi("revenue_total", current.revenue_total, previous?.revenue_total ?? null, { spark: points.map((x) => x.y ?? 0), drill: "finance.payments", currency }),
    makeKpi("revenue_outstanding", current.revenue_outstanding, previous?.revenue_outstanding ?? null, { currency }),
    makeKpi("refunds_total", current.refunds_total, previous?.refunds_total ?? null, { currency }),
  ];
  if (claims) kpis.push(makeKpi("claims_open", fig((claims.find((c) => c.label === "SUBMITTED")?.n ?? 0) + (claims.find((c) => c.label === "IN_REVIEW")?.n ?? 0)), null));
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "revenue-trend", title: `Revenue received (${currency})`, question: "How is income trending?", visual: { type: "line", unit: "currency", series: [{ name: "Revenue", points }] } },
    { id: "by-category", title: "Revenue by service category", question: "Which kinds of service earn the most?", visual: { type: "donut", unit: "currency", items: byCategory.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: round(r.v, 2) })) } },
    { id: "by-department", title: "Revenue by department", question: "Which departments generate income?", visual: { type: "bars", unit: "currency", items: byDepartment.map((r) => ({ label: r.label, value: round(r.v, 2) })) } },
    { id: "by-service", title: "Top services by revenue", question: "Which individual services matter most financially?", visual: { type: "table", columns: [{ key: "label", label: "Service" }, { key: "n", label: "Payments", align: "right" }, { key: "v", label: `Revenue (${currency})`, align: "right" }], rows: byService.map((r) => ({ label: r.label, n: r.n, v: round(r.v, 2) })) } },
  ];
  if (claims) sections.push({ id: "claims", title: "Insurance claims by status", question: "How many claims are waiting on a payer?", visual: { type: "bars", unit: "count", items: claims.map((r) => ({ label: r.label.replaceAll("_", " ").toLowerCase(), value: r.n })) }, note: "Counts active payer coverages by their claim status; claim amounts are not recorded." });
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  const others = currencies.slice(1).map((c) => c.currency);
  if (others.length) sections[0].note = `Also received in ${others.join(", ")}; currencies are never added together.`;
  return {
    kpis, sections,
    gaps: [
      gap("Revenue by consultation, admission, theatre and pharmacy", "Only booked services paid through Medic1905 are counted; bedside billing, admission charges, theatre and pharmacy sales are not recorded as payments."),
      gap("Outstanding invoices and insurance claim amounts", "There is no invoice or claim-amount model; pending booking payments stand in for outstanding payments."),
      gap("Operational expenditure and department-level profitability", "Costs are recorded only for pharmacy purchase orders and stock."),
    ],
  };
}

/* ───────────────────────── quality & safety ───────────────────────── */

export async function qualityDashboard(ctx: Ctx): Promise<Part> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const granularity = chooseGranularity(cur);
  const [[docs], [pendingDocs], [alerts], [rating], dq] = await Promise.all([
    db.$queryRaw<{ created: number; finalised: number }[]>`SELECT count(*)::int AS created, count(*) FILTER (WHERE d.finalized_at IS NOT NULL)::int AS finalised FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.deleted_at IS NULL AND d.status <> 'ENTERED_IN_ERROR' AND d.created_at >= ${ts(cur.start)} AND d.created_at < ${ts(cur.end)}`,
    db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.deleted_at IS NULL AND d.status IN ('PENDING_REVIEW','PENDING_SIGNATURE')`,
    db.$queryRaw<{ open: number; ack: number; total: number }[]>`SELECT count(*) FILTER (WHERE c.status IN ('SENT','ESCALATED'))::int AS open, count(*) FILTER (WHERE c."acknowledgedAt" IS NOT NULL)::int AS ack, count(*)::int AS total FROM critical_result_alerts c WHERE c.ordering_facility_id = ${f}::uuid AND c.created_at >= ${ts(cur.start)} AND c.created_at < ${ts(cur.end)}`,
    db.$queryRaw<{ avg: number | null; n: number }[]>`SELECT round(avg(r.rating)::numeric, 2)::float AS avg, count(*)::int AS n FROM facility_reviews r WHERE r.facility_id = ${f}::uuid AND r.moderation_status = 'APPROVED' AND r.created_at >= ${ts(cur.start)} AND r.created_at < ${ts(cur.end)}`,
    db.$queryRaw<{ label: string; missing: number; total: number }[]>`
      SELECT 'Discharged admissions without a discharge summary' AS label, count(*) FILTER (WHERE a.epicrisis IS NULL OR btrim(a.epicrisis) = '')::int AS missing, count(*)::int AS total FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.discharge_date >= ${ts(cur.start)} AND a.discharge_date < ${ts(cur.end)}
      UNION ALL SELECT 'Discharged admissions without a final diagnosis', count(*) FILTER (WHERE a.final_diagnosis_name IS NULL OR btrim(a.final_diagnosis_name) = '')::int, count(*)::int FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.discharge_date >= ${ts(cur.start)} AND a.discharge_date < ${ts(cur.end)}
      UNION ALL SELECT 'Emergency encounters without a triage time', count(*) FILTER (WHERE e.triaged_at IS NULL)::int, count(*)::int FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.type = 'EMERGENCY_DEPARTMENT' AND e.status NOT IN ('CANCELLED','DID_NOT_ATTEND') AND e.registered_at >= ${ts(cur.start)} AND e.registered_at < ${ts(cur.end)}
      UNION ALL SELECT 'Collected specimens without a collection time (received)', count(*) FILTER (WHERE s.collected_at IS NULL)::int, count(*)::int FROM specimens s WHERE s.facility_id = ${f}::uuid AND s.received_at >= ${ts(cur.start)} AND s.received_at < ${ts(cur.end)}
      UNION ALL SELECT 'Nursing tasks without a due time', count(*) FILTER (WHERE t.due_at IS NULL)::int, count(*)::int FROM nursing_task t WHERE t.facility_id = ${f}::uuid AND t.created_at >= ${ts(cur.start)} AND t.created_at < ${ts(cur.end)}
      UNION ALL SELECT 'Admissions without a linked encounter (cannot be classed emergency/planned)', count(*) FILTER (WHERE e.id IS NULL)::int, count(*)::int FROM admissions a LEFT JOIN encounters e ON e.admission_id = a.id WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(cur.start)} AND a.admission_date < ${ts(cur.end)}`,
  ]);
  const docTrend = await bucketedCounts(Prisma.sql`FROM clinical_documents d WHERE d.facility_id = ${f}::uuid AND d.deleted_at IS NULL AND d.status <> 'ENTERED_IN_ERROR' AND d.finalized_at IS NOT NULL`, Prisma.sql`d.finalized_at`, cur, granularity, ctx.scope.calendar);
  let kpis: KpiValue[] = [
    makeKpi("doc_completion", figRatio(docs.finalised, docs.created), null, { drill: "quality.documents" }),
    makeKpi("doc_unsigned", fig(pendingDocs.n), null, { drill: "quality.documents" }),
    makeKpi("critical_alerts_open", fig(alerts.open), null, { drill: "lab.critical", note: `${alerts.ack} of ${alerts.total} alerts raised in the period were acknowledged.` }),
    makeKpi("patient_rating", fig(rating.avg, { sampleSize: rating.n }), null),
  ];
  kpis = await attachTargets(f, kpis);
  const sections: Section[] = [
    { id: "docs-trend", title: "Documents finalised", question: "Is documentation keeping pace?", visual: { type: "line", unit: "count", series: [{ name: "Finalised", points: docTrend }] } },
    { id: "data-quality", title: "Data completeness", question: "How much recorded activity is missing fields the analytics depend on?", visual: { type: "table", columns: [{ key: "label", label: "Check" }, { key: "missing", label: "Missing", align: "right" }, { key: "total", label: "Records", align: "right" }, { key: "pct", label: "% missing", align: "right" }], rows: dq.map((r) => ({ label: r.label, missing: r.missing, total: r.total, pct: r.total > 0 ? round((r.missing / r.total) * 100, 1) : null })), footnote: "Missing values are excluded from averages and rates, never treated as zero." } },
  ];
  const tg = targetsSection(kpis); if (tg) sections.push(tg);
  return {
    kpis, sections,
    gaps: [
      gap("Patient safety incidents, medication errors, adverse events, falls, pressure injuries, infection indicators", "No structured incident or adverse-event register exists."),
      gap("Patient complaints and complaint resolution time", "Complaints are not recorded against facilities."),
      gap("Critical-result notification time for diagnostic findings, specimen rejection reasons trend, report corrections", "Partially recorded; see laboratory and diagnostic dashboards."),
      gap("Infection-prevention, patient flow efficiency composites, service availability, equipment downtime (hospital)", "Not recorded as structured data."),
    ],
  };
}

/* ───────────────────────── clinical staff activity ───────────────────────── */

export async function doctorsDashboard(ctx: Ctx): Promise<Part> {
  const cur = ctx.range.current;
  const f = ctx.scope.facility.id;
  const rows = await db.$queryRaw<{ name: string; role: string; med_orders: number; lab_orders: number; admissions: number; docs: number; docs_final: number; doc_hours: number | null; open_docs: number; patients: number }[]>`
    SELECT st.full_name AS name, st."facilityRole"::text AS role,
      (SELECT count(*) FROM medication_order m WHERE m.facility_id = st.facility_id AND m.prescriber_id = st.user_id AND m.status <> 'DRAFT' AND m.created_at >= ${ts(cur.start)} AND m.created_at < ${ts(cur.end)})::int AS med_orders,
      (SELECT count(*) FROM lab_orders o WHERE o.requesting_facility_id = st.facility_id AND o.ordered_by_id = st.user_id AND o.created_at >= ${ts(cur.start)} AND o.created_at < ${ts(cur.end)})::int AS lab_orders,
      (SELECT count(*) FROM admissions a JOIN doctor_profiles dp ON dp.id = a.admitting_doctor_id WHERE a.facility_id = st.facility_id AND dp.user_id = st.user_id AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(cur.start)} AND a.admission_date < ${ts(cur.end)})::int AS admissions,
      (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = st.facility_id AND d.author_id = st.user_id AND d.deleted_at IS NULL AND d.created_at >= ${ts(cur.start)} AND d.created_at < ${ts(cur.end)})::int AS docs,
      (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = st.facility_id AND d.author_id = st.user_id AND d.deleted_at IS NULL AND d.finalized_at >= ${ts(cur.start)} AND d.finalized_at < ${ts(cur.end)})::int AS docs_final,
      (SELECT round((avg(${minutesDiff(Prisma.sql`d.finalized_at`, Prisma.sql`d.created_at`)}) / 60.0)::numeric, 1)::float FROM clinical_documents d WHERE d.facility_id = st.facility_id AND d.author_id = st.user_id AND d.deleted_at IS NULL AND d.finalized_at >= ${ts(cur.start)} AND d.finalized_at < ${ts(cur.end)} AND d.finalized_at >= d.created_at) AS doc_hours,
      (SELECT count(*) FROM clinical_documents d WHERE d.facility_id = st.facility_id AND d.author_id = st.user_id AND d.deleted_at IS NULL AND d.status IN ('DRAFT','PENDING_REVIEW','PENDING_SIGNATURE'))::int AS open_docs,
      (SELECT count(DISTINCT x.patient_id) FROM (
        SELECT m.patient_id FROM medication_order m WHERE m.facility_id = st.facility_id AND m.prescriber_id = st.user_id AND m.created_at >= ${ts(cur.start)} AND m.created_at < ${ts(cur.end)}
        UNION SELECT o.patient_id FROM lab_orders o WHERE o.requesting_facility_id = st.facility_id AND o.ordered_by_id = st.user_id AND o.created_at >= ${ts(cur.start)} AND o.created_at < ${ts(cur.end)}
        UNION SELECT d.patient_id FROM clinical_documents d WHERE d.facility_id = st.facility_id AND d.author_id = st.user_id AND d.created_at >= ${ts(cur.start)} AND d.created_at < ${ts(cur.end)}) x)::int AS patients
    FROM facility_staff st WHERE st.facility_id = ${f}::uuid AND st.status = 'ACTIVE' AND st.user_id IS NOT NULL AND st."facilityRole" IN ('DOCTOR','SURGEON','RADIOLOGIST','DIAGNOSTIC_SPECIALIST','PHARMACIST','DEPARTMENT_HEAD')
    ORDER BY st.full_name`;
  const totals = rows.reduce((t, r) => ({ med: t.med + r.med_orders, lab: t.lab + r.lab_orders, adm: t.adm + r.admissions, docs: t.docs + r.docs }), { med: 0, lab: 0, adm: 0, docs: 0 });
  const allHours = rows.filter((r) => r.doc_hours !== null).map((r) => r.doc_hours as number);
  const kpis: KpiValue[] = [
    { key: "staff_clinicians", label: "Active clinical staff", value: rows.length, unit: "count", betterWhen: "NEUTRAL" },
    { key: "staff_med_orders", label: "Medication orders written", value: totals.med, unit: "count", betterWhen: "NEUTRAL" },
    { key: "staff_lab_orders", label: "Laboratory requests made", value: totals.lab, unit: "count", betterWhen: "NEUTRAL" },
    { key: "staff_admissions", label: "Admissions as admitting doctor", value: totals.adm, unit: "count", betterWhen: "NEUTRAL" },
    { key: "staff_documents", label: "Clinical documents authored", value: totals.docs, unit: "count", betterWhen: "NEUTRAL" },
    { key: "staff_doc_hours", label: "Mean time to finalise a document", value: allHours.length ? round(allHours.reduce((s, v) => s + v, 0) / allHours.length, 1) : null, unit: "hours", betterWhen: "LOWER", sampleSize: allHours.length, note: "Mean of clinician means." },
  ];
  const sections: Section[] = [
    { id: "activity", title: "Clinician activity (alphabetical — not a ranking)", question: "How is recorded clinical work distributed, and where is documentation outstanding?", visual: { type: "table", columns: [{ key: "name", label: "Clinician" }, { key: "role", label: "Role" }, { key: "patients", label: "Patients", align: "right" }, { key: "med", label: "Medication orders", align: "right" }, { key: "lab", label: "Lab requests", align: "right" }, { key: "adm", label: "Admissions", align: "right" }, { key: "docs", label: "Docs authored", align: "right" }, { key: "hours", label: "Hours to finalise", align: "right" }, { key: "open", label: "Docs outstanding", align: "right" }], rows: rows.map((r) => ({ name: r.name, role: r.role.replaceAll("_", " ").toLowerCase(), patients: r.patients, med: r.med_orders, lab: r.lab_orders, adm: r.admissions, docs: r.docs, hours: r.doc_hours, open: r.open_docs })), footnote: `Volume reflects workload, specialty and case mix, not quality. Nobody is ranked or compared on volume or outcomes. Figures over fewer than ${MIN_RELIABLE_SAMPLE} records are not stable.` } },
  ];
  return {
    kpis, sections,
    gaps: [
      gap("Consultations, appointments and follow-up completion for facility clinicians", "Consultations and appointments belong to the doctor's own Medic1905 practice (see My performance) and are not linked to a facility."),
      gap("Outcomes by clinician (mortality, readmission, complications)", "Deliberately not attributed to individuals: outcomes depend on case mix and shared team care."),
      gap("Average consultation duration and results-review time", "Actual consultation start/end and result review are not timestamped."),
      gap("Procedures performed and referrals issued by clinician", "Not recorded per clinician at facility level."),
    ],
  };
  void summariseDurations;
}

/* ───────────────────────── departments ───────────────────────── */

export async function departmentsDashboard(ctx: Ctx): Promise<Part> {
  const cur = ctx.range.current;
  const prev = ctx.range.previous;
  const f = ctx.scope.facility.id;
  const deptIds = ctx.scope.departmentIds;
  const scopeSql = deptIds ? Prisma.sql` AND d.id IN (${Prisma.join(deptIds.map((i) => Prisma.sql`${i}::uuid`))})` : Prisma.empty;
  const prevStart = prev?.start ?? cur.start, prevEnd = prev?.end ?? cur.start;
  const rows = await db.$queryRaw<{ id: string; name: string; head: string | null; staff: number; enc: number; enc_prev: number; adm: number; adm_prev: number; open_enc: number; stalled: number; alos: number | null; docs_open: number; revenue: number | null }[]>`
    SELECT d.id::text AS id, d.name, (SELECT l.full_name FROM facility_staff l WHERE l.id = d.lead_staff_id) AS head,
      (SELECT count(*) FROM facility_staff s WHERE s.facility_id = d.facility_id AND s.status = 'ACTIVE' AND (s.department_id = d.id OR d.id::text = ANY(s.department_ids)))::int AS staff,
      (SELECT count(*) FROM encounters e WHERE e.facility_id = d.facility_id AND e.department = d.name AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(cur.start)} AND e.registered_at < ${ts(cur.end)})::int AS enc,
      (SELECT count(*) FROM encounters e WHERE e.facility_id = d.facility_id AND e.department = d.name AND e.status <> 'CANCELLED' AND e.registered_at >= ${ts(prevStart)} AND e.registered_at < ${ts(prevEnd)})::int AS enc_prev,
      (SELECT count(*) FROM admissions a JOIN wards w ON w.facility_id = a.facility_id AND w.name = a.ward WHERE w.department_id = d.id AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(cur.start)} AND a.admission_date < ${ts(cur.end)})::int AS adm,
      (SELECT count(*) FROM admissions a JOIN wards w ON w.facility_id = a.facility_id AND w.name = a.ward WHERE w.department_id = d.id AND a.status <> 'CANCELLED' AND a.admission_date >= ${ts(prevStart)} AND a.admission_date < ${ts(prevEnd)})::int AS adm_prev,
      (SELECT count(*) FROM encounters e WHERE e.facility_id = d.facility_id AND e.department = d.name AND e.closed_at IS NULL)::int AS open_enc,
      (SELECT count(*) FROM encounters e WHERE e.facility_id = d.facility_id AND e.department = d.name AND e.closed_at IS NULL AND e.status_changed_at < ${ts(new Date(ctx.now.getTime() - 24 * 3_600_000))})::int AS stalled,
      (SELECT round(avg(extract(epoch FROM (a.discharge_date - a.admission_date)) / 86400.0)::numeric, 1)::float FROM admissions a JOIN wards w ON w.facility_id = a.facility_id AND w.name = a.ward WHERE w.department_id = d.id AND a.status = 'DISCHARGED' AND a.discharge_date > a.admission_date AND a.discharge_date >= ${ts(cur.start)} AND a.discharge_date < ${ts(cur.end)}) AS alos,
      (SELECT count(*) FROM clinical_documents c WHERE c.facility_id = d.facility_id AND c.department = d.name AND c.deleted_at IS NULL AND c.status IN ('DRAFT','PENDING_REVIEW','PENDING_SIGNATURE'))::int AS docs_open,
      ${ctx.scope.canViewFinancial ? Prisma.sql`(SELECT sum(p.amount)::float FROM payments p JOIN facility_bookings b ON b.id = p.facility_booking_id JOIN facility_services s ON s.id = b.service_id WHERE s.department_id = d.id AND p.status = 'SUCCESSFUL' AND p.paid_at >= ${ts(cur.start)} AND p.paid_at < ${ts(cur.end)})` : Prisma.sql`NULL::float`} AS revenue
    FROM facility_departments d WHERE d.facility_id = ${f}::uuid AND d.active${scopeSql} ORDER BY d.name`;
  const targets = await db.analyticsPerformanceTarget.findMany({ where: { facilityId: f, metricKey: "alos", scopeKey: { in: rows.map((r) => r.id) } } });
  const change = (c: number, p: number) => (prev && p > 0 ? `${c - p >= 0 ? "+" : ""}${round(((c - p) / p) * 100, 1)}%` : prev ? "—" : "");
  const cols: { key: string; label: string; align?: "left" | "right" }[] = [
    { key: "name", label: "Department" }, { key: "head", label: "Head" }, { key: "staff", label: "Active staff", align: "right" },
    { key: "enc", label: "Encounters", align: "right" }, { key: "encChange", label: "vs previous", align: "right" },
    { key: "adm", label: "Admissions", align: "right" }, { key: "admChange", label: "vs previous", align: "right" },
    { key: "open", label: "Open now", align: "right" }, { key: "stalled", label: "Stalled >24h", align: "right" },
    { key: "alos", label: "Avg stay (days)", align: "right" }, { key: "target", label: "Stay target", align: "right" }, { key: "docs", label: "Documents outstanding", align: "right" },
  ];
  if (ctx.scope.canViewFinancial) cols.push({ key: "revenue", label: "Revenue", align: "right" });
  const kpis: KpiValue[] = [
    { key: "dept_count", label: "Active departments", value: rows.length, unit: "count", betterWhen: "NEUTRAL" },
    { key: "dept_staff", label: "Assigned active staff", value: rows.reduce((s, r) => s + r.staff, 0), unit: "count", betterWhen: "NEUTRAL" },
    { key: "dept_open", label: "Open encounters", value: rows.reduce((s, r) => s + r.open_enc, 0), unit: "count", betterWhen: "NEUTRAL" },
    { key: "dept_stalled", label: "Stalled more than 24 hours", value: rows.reduce((s, r) => s + r.stalled, 0), unit: "count", betterWhen: "LOWER" },
  ];
  const sections: Section[] = [
    { id: "departments", title: "Department performance", question: "How does each department's workload, stay length and backlog compare with the previous period?", visual: { type: "table", columns: cols, rows: rows.map((r) => ({ name: r.name, head: r.head ?? "Not assigned", staff: r.staff, enc: r.enc, encChange: change(r.enc, r.enc_prev), adm: r.adm, admChange: change(r.adm, r.adm_prev), open: r.open_enc, stalled: r.stalled, alos: r.alos, target: targets.find((t) => t.scopeKey === r.id) ? `${targets.find((t) => t.scopeKey === r.id)!.direction === "AT_MOST" ? "≤" : "≥"} ${Number(targets.find((t) => t.scopeKey === r.id)!.targetValue)}` : null, docs: r.docs_open, revenue: r.revenue === null ? null : round(r.revenue, 2) })), footnote: "Departments differ in specialty and case mix; compare each with its own history and targets rather than ranking them. Encounters are matched to departments by department name, admissions by the ward's department." } },
    { id: "enc-bars", title: "Encounters by department", question: "Where is the workload concentrated?", visual: { type: "bars", unit: "count", items: rows.map((r) => ({ label: r.name, value: r.enc, previous: prev ? r.enc_prev : undefined })) } },
  ];
  return { kpis, sections, gaps: [gap("Department staffing levels against targets, department quality indicators, operational problems log", "Staffing targets, department-level quality data and an issues register are not recorded.")] };
}
