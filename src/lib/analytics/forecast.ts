/**
 * Statistical forecasting and anomaly flags.
 *
 * Everything here is a PREDICTION or a RECOMMENDATION produced from the facility's own history with
 * transparent arithmetic (weekday-adjusted moving average, residual-based intervals, z-scores). It
 * never diagnoses, changes a record, or judges an individual member of staff, and the interface
 * labels it as such. Fewer than two weeks of history produces no forecast rather than a guess.
 */
import { Prisma } from "@prisma/client";
import { db, bucketedCounts, ts } from "./sql";
import { fig, gap, type Ctx } from "./core";
import { localDateOf, parseIsoDate, addDays, toIsoDate, type ResolvedPeriod, localMidnight } from "./periods";
import { mean, round } from "./stats";
import type { DashboardPayload, KpiValue, Section } from "./types";

export const HISTORY_DAYS = 56;
export const HORIZON_DAYS = 14;
export const MIN_HISTORY_DAYS = 14;

export interface Forecast {
  forecast: number[];
  lower: number[];
  upper: number[];
  /** Mean daily value over the last 28 days. */
  level: number;
  /** Relative standard error of the weekday model (0 = perfect). */
  noise: number;
}

/** Day-of-week index for an ISO date, 0 = Sunday. */
const dow = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

/**
 * Weekday-adjusted level forecast. `days` are consecutive ISO dates (oldest first) with `values`.
 * Returns null when there is too little history.
 */
export function forecastDaily(days: readonly string[], values: readonly number[], horizon = HORIZON_DAYS): Forecast | null {
  if (days.length !== values.length || values.length < MIN_HISTORY_DAYS) return null;
  const recent = values.slice(-28);
  const level = recent.reduce((s, v) => s + v, 0) / recent.length;
  const overall = values.reduce((s, v) => s + v, 0) / values.length;
  const byDow = Array.from({ length: 7 }, () => [] as number[]);
  days.forEach((d, i) => byDow[dow(d)].push(values[i]));
  const factor = byDow.map((a) => (a.length && overall > 0 ? a.reduce((s, v) => s + v, 0) / a.length / overall : 1));
  // In-sample residuals of the same model give an honest interval width.
  const fitted = days.map((d) => level * factor[dow(d)]);
  const residuals = values.map((v, i) => v - fitted[i]);
  const sd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length - 1));
  const last = days[days.length - 1];
  const out: Forecast = { forecast: [], lower: [], upper: [], level: round(level, 2), noise: level > 0 ? round(sd / level, 2) : 0 };
  for (let i = 1; i <= horizon; i++) {
    const day = toIsoDate(addDays(parseIsoDate(last), i));
    const point = Math.max(0, level * factor[dow(day)]);
    out.forecast.push(round(point, 1));
    out.lower.push(round(Math.max(0, point - 1.28 * sd), 1));
    out.upper.push(round(point + 1.28 * sd, 1));
  }
  return out;
}

export interface Anomaly { index: number; value: number; expected: number; z: number }

/** Points more than `z` standard deviations above the trailing-window mean (one-sided: unusually high). */
export function flagHigh(values: readonly (number | null)[], window = 8, z = 2): Anomaly[] {
  const out: Anomaly[] = [];
  for (let i = window; i < values.length; i++) {
    const v = values[i];
    if (v === null) continue;
    const base = values.slice(i - window, i).filter((x): x is number => x !== null);
    if (base.length < Math.ceil(window / 2)) continue;
    const m = base.reduce((s, x) => s + x, 0) / base.length;
    const sd = Math.sqrt(base.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, base.length - 1));
    if (sd === 0) continue;
    const score = (v - m) / sd;
    if (score > z) out.push({ index: i, value: v, expected: round(m, 2), z: round(score, 1) });
  }
  return out;
}

async function dailyHistory(source: Prisma.Sql, col: Prisma.Sql, ctx: Ctx) {
  const today = localDateOf(ctx.now, ctx.scope.calendar.timeZone);
  const start = addDays(today, -HISTORY_DAYS);
  const period: ResolvedPeriod = {
    start: localMidnight(start, ctx.scope.calendar.timeZone), end: localMidnight(today, ctx.scope.calendar.timeZone),
    startDate: toIsoDate(start), endDate: toIsoDate(addDays(today, -1)), label: "history",
  };
  const rows = await bucketedCounts(source, col, period, "day", ctx.scope.calendar);
  return { days: rows.map((r) => r.x), values: rows.map((r) => r.y), lastDate: period.endDate };
}

function forecastSection(id: string, title: string, question: string, hist: { days: string[]; values: number[] }, fc: Forecast | null): Section {
  if (!fc) return { id, title, question, visual: { type: "table", columns: [{ key: "msg", label: "Forecast" }], rows: [{ msg: `Not enough history yet (needs ${MIN_HISTORY_DAYS} days of records).` }] } };
  const lastDays = hist.days.slice(-21);
  const lastVals = hist.values.slice(-21);
  const future = fc.forecast.map((_, i) => toIsoDate(addDays(parseIsoDate(hist.days[hist.days.length - 1]), i + 1)));
  return {
    id, title, question,
    visual: { type: "line", unit: "count", series: [
      { name: "Recorded", points: lastDays.map((x, i) => ({ x, y: lastVals[i] })) },
      { name: "Predicted", dashed: true, points: future.map((x, i) => ({ x, y: fc.forecast[i] })) },
      { name: "Likely upper bound", dashed: true, points: future.map((x, i) => ({ x, y: fc.upper[i] })) },
    ] },
    note: `Prediction, not a fact: 28-day level ${fc.level}/day adjusted for day of week. Typical day-to-day noise is ±${Math.round(fc.noise * 100)}% of the level; the upper bound covers about 90% of days.`,
  };
}

export async function forecastDashboard(ctx: Ctx): Promise<Pick<DashboardPayload, "kpis" | "sections" | "gaps">> {
  const f = ctx.scope.facility.id;
  const kind = ctx.scope.kind;
  const sections: Section[] = [];
  const kpis: KpiValue[] = [];
  const recs: Record<string, string | number | null>[] = [];

  if (kind === "HOSPITAL") {
    const adm = await dailyHistory(Prisma.sql`FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status <> 'CANCELLED'`, Prisma.sql`a.admission_date`, ctx);
    const dis = await dailyHistory(Prisma.sql`FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED'`, Prisma.sql`a.discharge_date`, ctx);
    const ed = await dailyHistory(Prisma.sql`FROM encounters e WHERE e.facility_id = ${f}::uuid AND e.type = 'EMERGENCY_DEPARTMENT' AND e.status <> 'CANCELLED'`, Prisma.sql`e.registered_at`, ctx);
    const fa = forecastDaily(adm.days, adm.values), fd = forecastDaily(dis.days, dis.values), fe = forecastDaily(ed.days, ed.values);
    sections.push(forecastSection("admissions", "Admission demand", "How many admissions should we plan for over the next two weeks?", adm, fa));
    sections.push(forecastSection("emergency", "Emergency workload", "How busy will the emergency department be?", ed, fe));
    if (fa) kpis.push({ key: "fc_admissions_week", label: "Predicted admissions, next 7 days", value: round(fa.forecast.slice(0, 7).reduce((s, v) => s + v, 0), 0), unit: "count", betterWhen: "NEUTRAL", note: "Prediction from the last 8 weeks." });
    if (fe) kpis.push({ key: "fc_ed_week", label: "Predicted ED arrivals, next 7 days", value: round(fe.forecast.slice(0, 7).reduce((s, v) => s + v, 0), 0), unit: "count", betterWhen: "NEUTRAL", note: "Prediction from the last 8 weeks." });
    // Bed demand: today's occupancy, plus expected admissions, minus expected discharges and exits.
    const [beds] = await db.$queryRaw<{ occupied: number; in_service: number }[]>`SELECT count(*) FILTER (WHERE b.status = 'OCCUPIED')::int AS occupied, count(*) FILTER (WHERE b.status <> 'MAINTENANCE')::int AS in_service FROM beds b WHERE b.facility_id = ${f}::uuid`;
    if (fa && fd && beds.in_service > 0) {
      let occ = beds.occupied;
      const proj: { x: string; y: number }[] = [];
      for (let i = 0; i < 7; i++) {
        occ = Math.min(beds.in_service, Math.max(0, occ + fa.forecast[i] - fd.forecast[i]));
        proj.push({ x: toIsoDate(addDays(parseIsoDate(adm.lastDate), i + 1)), y: round((occ / beds.in_service) * 100, 1) });
      }
      sections.push({ id: "beds", title: "Projected bed occupancy (next 7 days)", question: "Will we run out of beds?", visual: { type: "line", unit: "percent", series: [{ name: "Projected occupancy %", dashed: true, points: proj }] }, note: "Prediction: today's occupied beds plus predicted admissions minus predicted discharges. It ignores planned discharges, transfers and deaths, so treat it as direction, not a bed plan." });
      const peak = Math.max(...proj.map((p) => p.y));
      if (peak >= 90) recs.push({ type: "Recommendation", finding: `Projected occupancy reaches ${peak}% within a week.`, basis: "Admission and discharge forecasts above", action: "Review planned discharges and surge capacity." });
    }
    // Unusual mortality for clinical review: weekly deaths vs trailing 8-week baseline.
    const weekly = await db.$queryRaw<{ week: string; deaths: number }[]>`SELECT to_char(date_trunc('week', a.discharge_date), 'YYYY-MM-DD') AS week, count(*) FILTER (WHERE a.disposition = 'DECEASED')::int AS deaths FROM admissions a WHERE a.facility_id = ${f}::uuid AND a.status = 'DISCHARGED' AND a.discharge_date >= ${ts(new Date(ctx.now.getTime() - 26 * 7 * 86_400_000))} GROUP BY 1 ORDER BY 1`;
    const flags = flagHigh(weekly.map((w) => w.deaths), 8, 2);
    for (const a of flags.slice(-3)) recs.push({ type: "Recommendation", finding: `Week of ${weekly[a.index].week}: ${a.value} inpatient deaths against about ${a.expected} expected from the previous 8 weeks.`, basis: `z = ${a.z}; counts only, not adjusted for case mix`, action: "Refer for routine clinical review. This is a statistical flag, not evidence of poor care." });
  }

  if (kind === "LABORATORY" || kind === "HOSPITAL") {
    const lab = await dailyHistory(Prisma.sql`FROM lab_orders o WHERE o.performing_facility_id = ${f}::uuid`, Prisma.sql`o.created_at`, ctx);
    const fl = forecastDaily(lab.days, lab.values);
    if (lab.values.some((v) => v > 0)) sections.push(forecastSection("lab", "Laboratory workload", "How many requests should the laboratory expect?", lab, fl));
    if (fl) kpis.push({ key: "fc_lab_week", label: "Predicted lab requests, next 7 days", value: round(fl.forecast.slice(0, 7).reduce((s, v) => s + v, 0), 0), unit: "count", betterWhen: "NEUTRAL", note: "Prediction from the last 8 weeks." });
    const tat = await db.$queryRaw<{ day: string; v: number }[]>`SELECT to_char(date_trunc('day', r.verified_at), 'YYYY-MM-DD') AS day, round(avg(extract(epoch FROM (r.verified_at - o.created_at)) / 60.0)::numeric, 1)::float AS v FROM lab_results r JOIN lab_orders o ON o.id = r.lab_order_id WHERE o.performing_facility_id = ${f}::uuid AND r.verified_at >= ${ts(new Date(ctx.now.getTime() - 56 * 86_400_000))} AND r.verified_at >= o.created_at GROUP BY 1 ORDER BY 1`;
    for (const a of flagHigh(tat.map((t) => t.v), 14, 2).slice(-3)) recs.push({ type: "Recommendation", finding: `${tat[a.index].day}: mean turnaround ${a.value} min against about ${a.expected} min recently.`, basis: `z = ${a.z}`, action: "Check staffing, analyser downtime and specimen backlog for that day." });
    const [rg] = await db.$queryRaw<{ low: number }[]>`SELECT count(*) FILTER (WHERE r.quantity <= r.min_stock_level)::int AS low FROM lab_reagents r WHERE r.facility_id = ${f}::uuid`;
    if (rg.low > 0) recs.push({ type: "Recommendation", finding: `${rg.low} reagent(s) are at or below minimum stock.`, basis: "Current balances", action: "Reorder. Consumption forecasting is unavailable because usage is not recorded." });
    const due = await db.$queryRaw<{ name: string; due: Date }[]>`SELECT e.name, e.next_service_due_at AS due FROM lab_equipment e WHERE e.facility_id = ${f}::uuid AND e.next_service_due_at IS NOT NULL AND e.next_service_due_at < ${ts(new Date(ctx.now.getTime() + 30 * 86_400_000))} ORDER BY 2 LIMIT 5`;
    for (const e of due) recs.push({ type: "Recommendation", finding: `${e.name} is due for service ${e.due < ctx.now ? "(overdue)" : "within 30 days"}.`, basis: "Scheduled service date", action: "Book maintenance." });
  }

  if (kind === "DIAGNOSTIC_CENTRE" || kind === "HOSPITAL") {
    const dx = await dailyHistory(Prisma.sql`FROM facility_bookings b JOIN facility_services s ON s.id = b.service_id WHERE s.facility_id = ${f}::uuid AND s.category IN ('IMAGING','PROCEDURE') AND b.status <> 'CANCELLED'`, Prisma.sql`b.created_at`, ctx);
    if (dx.values.some((v) => v > 0)) sections.push(forecastSection("dx", "Diagnostic appointment demand", "How many examinations will be requested?", dx, forecastDaily(dx.days, dx.values)));
  }

  if (kind === "PHARMACY" || kind === "HOSPITAL") {
    const rx = await dailyHistory(Prisma.sql`FROM medication_order m WHERE m.facility_id = ${f}::uuid AND m.status <> 'DRAFT'`, Prisma.sql`m.created_at`, ctx);
    if (rx.values.some((v) => v > 0)) sections.push(forecastSection("rx", "Medication order demand", "How many orders will pharmacy receive?", rx, forecastDaily(rx.days, rx.values)));
    const exp = await db.$queryRaw<{ name: string; batch: string; qty: number; expires: Date }[]>`SELECT b.medication_name AS name, b.batch_number AS batch, b.quantity AS qty, b.expires_at AS expires FROM pharmacy_stock_batches b WHERE b.facility_id = ${f}::uuid AND b.quantity > 0 AND b.expires_at < ${ts(new Date(ctx.now.getTime() + 90 * 86_400_000))} ORDER BY b.expires_at LIMIT 8`;
    for (const e of exp) recs.push({ type: "Recommendation", finding: `${e.name} batch ${e.batch} (${e.qty} units) ${e.expires < ctx.now ? "has expired" : `expires ${toIsoDate(localDateOf(e.expires, ctx.scope.calendar.timeZone))}`}.`, basis: "Stock batch expiry date", action: e.expires < ctx.now ? "Quarantine and write off." : "Use first, transfer or return." });
  }

  if (recs.length) sections.unshift({ id: "recs", title: "Findings for review", question: "What should management look at?", visual: { type: "table", columns: [{ key: "type", label: "Type" }, { key: "finding", label: "Finding" }, { key: "basis", label: "Basis" }, { key: "action", label: "Suggested follow-up" }], rows: recs, footnote: "Automatically generated recommendations and predictions. They are not verified facts and never diagnose, alter records or judge individual staff." } });
  void mean; void fig;
  return {
    kpis, sections,
    gaps: [
      gap("Staffing demand forecast and ward staffing pressure", "Rosters and acuity are not recorded."),
      gap("Reagent consumption forecast, equipment maintenance prediction, pharmacy stock-out prediction", "Consumption and stock movements are not recorded as transactions; only dates and balances are available."),
      gap("Appointment scheduling optimisation and repeat-examination anomalies (diagnostic)", "No slot, capacity or repeat-examination data."),
    ],
  };
}
