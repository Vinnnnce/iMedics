/**
 * Reporting-period engine for every analytics dashboard.
 *
 * Rules (they are what keeps counts from being doubled or lost between periods):
 *  - A period is the half-open interval [start, end): `start` is local midnight of the first day,
 *    `end` is local midnight of the day after the last one. An event on the boundary belongs to
 *    exactly one period.
 *  - "Local" means the facility's configured IANA time zone, never the server's.
 *  - The first day of the week and the first month of the financial year come from facility settings.
 *    Quarters are counted from the start of the financial year.
 *  - Callers filter on the *event* timestamp (admission date, collection time, report release time),
 *    never on `updatedAt`.
 */

export type PeriodPreset =
  | "TODAY" | "YESTERDAY" | "THIS_WEEK" | "LAST_WEEK" | "THIS_MONTH" | "LAST_MONTH"
  | "THIS_QUARTER" | "LAST_QUARTER" | "THIS_YEAR" | "LAST_YEAR"
  | "THIS_FINANCIAL_YEAR" | "LAST_FINANCIAL_YEAR" | "CUSTOM";

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  "TODAY", "YESTERDAY", "THIS_WEEK", "LAST_WEEK", "THIS_MONTH", "LAST_MONTH", "THIS_QUARTER", "LAST_QUARTER",
  "THIS_YEAR", "LAST_YEAR", "THIS_FINANCIAL_YEAR", "LAST_FINANCIAL_YEAR", "CUSTOM",
] as const;

export const PERIOD_PRESET_LABEL: Record<PeriodPreset, string> = {
  TODAY: "Today", YESTERDAY: "Yesterday", THIS_WEEK: "This week", LAST_WEEK: "Last week",
  THIS_MONTH: "This month", LAST_MONTH: "Last month", THIS_QUARTER: "This quarter", LAST_QUARTER: "Last quarter",
  THIS_YEAR: "This year", LAST_YEAR: "Last year", THIS_FINANCIAL_YEAR: "This financial year",
  LAST_FINANCIAL_YEAR: "Last financial year", CUSTOM: "Custom range",
};

export type CompareMode =
  | "NONE" | "PREVIOUS_PERIOD" | "YEAR_OVER_YEAR" | "MONTH_OVER_MONTH" | "WEEK_OVER_WEEK" | "QUARTER_OVER_QUARTER" | "CUSTOM";

export const COMPARE_MODES: readonly CompareMode[] = [
  "NONE", "PREVIOUS_PERIOD", "YEAR_OVER_YEAR", "MONTH_OVER_MONTH", "WEEK_OVER_WEEK", "QUARTER_OVER_QUARTER", "CUSTOM",
] as const;

export const COMPARE_MODE_LABEL: Record<CompareMode, string> = {
  NONE: "No comparison", PREVIOUS_PERIOD: "Previous equivalent period", YEAR_OVER_YEAR: "Same period last year",
  MONTH_OVER_MONTH: "Month over month", WEEK_OVER_WEEK: "Week over week", QUARTER_OVER_QUARTER: "Quarter over quarter",
  CUSTOM: "Custom baseline",
};

export interface CalendarSettings {
  /** IANA zone, e.g. "Africa/Lagos". */
  timeZone: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekStartsOn: number;
  /** 1–12. */
  financialYearStartMonth: number;
}

export const DEFAULT_CALENDAR: CalendarSettings = { timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 };

/** A calendar date with no time or zone attached. */
export interface LocalDate { y: number; m: number; d: number }

export interface ResolvedPeriod {
  /** Inclusive instant. */
  start: Date;
  /** Exclusive instant. */
  end: Date;
  /** First and last local calendar day (inclusive), "YYYY-MM-DD". */
  startDate: string;
  endDate: string;
  label: string;
}

export interface ResolvedRange {
  preset: PeriodPreset;
  current: ResolvedPeriod;
  /** Null when no comparison was requested or the baseline cannot be derived. */
  previous: ResolvedPeriod | null;
  compare: CompareMode;
  /** True when the current period has not finished; the baseline is then cut to the same elapsed length. */
  likeForLike: boolean;
  calendar: CalendarSettings;
  generatedAt: string;
}

export class PeriodError extends Error {}

const DAY_MS = 86_400_000;

/* ───────────────────────── time-zone helpers ───────────────────────── */

const formatterCache = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

export function isValidTimeZone(timeZone: string): boolean {
  try { formatter(timeZone); return true; } catch { return false; }
}

/** Offset (ms) of `timeZone` from UTC at the given instant: local wall-clock minus UTC. */
export function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which local midnight of the given calendar date occurs in `timeZone`. */
export function localMidnight(date: LocalDate, timeZone: string): Date {
  const naive = Date.UTC(date.y, date.m - 1, date.d);
  let instant = naive - zoneOffsetMs(new Date(naive), timeZone);
  // Second pass settles days on which the offset changes (daylight saving).
  instant = naive - zoneOffsetMs(new Date(instant), timeZone);
  return new Date(instant);
}

/** The local calendar date an instant falls on in `timeZone`. */
export function localDateOf(instant: Date, timeZone: string): LocalDate {
  const parts = formatter(timeZone).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { y: get("year"), m: get("month"), d: get("day") };
}

/* ───────────────────────── calendar arithmetic ───────────────────────── */

const toUtc = (d: LocalDate) => Date.UTC(d.y, d.m - 1, d.d);
const fromUtc = (ms: number): LocalDate => { const t = new Date(ms); return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() }; };
export const addDays = (d: LocalDate, n: number): LocalDate => fromUtc(toUtc(d) + n * DAY_MS);
export const diffDays = (a: LocalDate, b: LocalDate): number => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
export const toIsoDate = (d: LocalDate): string => `${String(d.y).padStart(4, "0")}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;

export function parseIsoDate(value: string): LocalDate {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new PeriodError(`Invalid date "${value}"; expected YYYY-MM-DD`);
  const date = { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
  const check = fromUtc(toUtc(date));
  if (check.y !== date.y || check.m !== date.m || check.d !== date.d) throw new PeriodError(`Invalid calendar date "${value}"`);
  return date;
}

/** Add whole months, clamping nothing: callers only use the first day of a month. */
function addMonths(d: LocalDate, n: number): LocalDate {
  const index = d.y * 12 + (d.m - 1) + n;
  return { y: Math.floor(index / 12), m: (index % 12 + 12) % 12 + 1, d: d.d };
}

export const startOfWeek = (d: LocalDate, weekStartsOn: number): LocalDate => addDays(d, -((new Date(toUtc(d)).getUTCDay() - weekStartsOn + 7) % 7));
export const startOfMonth = (d: LocalDate): LocalDate => ({ y: d.y, m: d.m, d: 1 });

/** First day of the financial year containing `d`. */
export function startOfFinancialYear(d: LocalDate, fyStartMonth: number): LocalDate {
  return d.m >= fyStartMonth ? { y: d.y, m: fyStartMonth, d: 1 } : { y: d.y - 1, m: fyStartMonth, d: 1 };
}

/** First day of the financial quarter containing `d` (quarters run from the start of the financial year). */
export function startOfQuarter(d: LocalDate, fyStartMonth: number): LocalDate {
  const fy = startOfFinancialYear(d, fyStartMonth);
  const monthsIn = (d.y - fy.y) * 12 + (d.m - fy.m);
  return addMonths(fy, Math.floor(monthsIn / 3) * 3);
}

function validateCalendar(c: CalendarSettings): CalendarSettings {
  if (!isValidTimeZone(c.timeZone)) throw new PeriodError(`Unknown time zone "${c.timeZone}"`);
  if (!Number.isInteger(c.weekStartsOn) || c.weekStartsOn < 0 || c.weekStartsOn > 6) throw new PeriodError("weekStartsOn must be 0–6");
  if (!Number.isInteger(c.financialYearStartMonth) || c.financialYearStartMonth < 1 || c.financialYearStartMonth > 12) throw new PeriodError("financialYearStartMonth must be 1–12");
  return c;
}

/* ───────────────────────── period construction ───────────────────────── */

type Unit = "DAY" | "WEEK" | "MONTH" | "QUARTER" | "YEAR" | "FINANCIAL_YEAR" | "RANGE";

interface DateSpan { first: LocalDate; nextDay: LocalDate; unit: Unit }

function describe(span: DateSpan, calendar: CalendarSettings): string {
  const last = addDays(span.nextDay, -1);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const fmt = (d: LocalDate) => `${d.d} ${months[d.m - 1]} ${d.y}`;
  switch (span.unit) {
    case "DAY": return fmt(span.first);
    case "MONTH": return `${months[span.first.m - 1]} ${span.first.y}`;
    case "QUARTER": {
      const fy = startOfFinancialYear(span.first, calendar.financialYearStartMonth);
      const q = Math.floor(((span.first.y - fy.y) * 12 + (span.first.m - fy.m)) / 3) + 1;
      return `Q${q} ${calendar.financialYearStartMonth === 1 ? span.first.y : `FY${fy.y}/${String(fy.y + 1).slice(2)}`}`;
    }
    case "YEAR": return String(span.first.y);
    case "FINANCIAL_YEAR": return calendar.financialYearStartMonth === 1 ? String(span.first.y) : `FY${span.first.y}/${String(span.first.y + 1).slice(2)}`;
    default: return `${fmt(span.first)} – ${fmt(last)}`;
  }
}

function materialise(span: DateSpan, calendar: CalendarSettings): ResolvedPeriod {
  return {
    start: localMidnight(span.first, calendar.timeZone),
    end: localMidnight(span.nextDay, calendar.timeZone),
    startDate: toIsoDate(span.first),
    endDate: toIsoDate(addDays(span.nextDay, -1)),
    label: describe(span, calendar),
  };
}

function unitSpan(unit: Exclude<Unit, "RANGE">, anchor: LocalDate, calendar: CalendarSettings): DateSpan {
  switch (unit) {
    case "DAY": return { first: anchor, nextDay: addDays(anchor, 1), unit };
    case "WEEK": { const first = startOfWeek(anchor, calendar.weekStartsOn); return { first, nextDay: addDays(first, 7), unit }; }
    case "MONTH": { const first = startOfMonth(anchor); return { first, nextDay: addMonths(first, 1), unit }; }
    case "QUARTER": { const first = startOfQuarter(anchor, calendar.financialYearStartMonth); return { first, nextDay: addMonths(first, 3), unit }; }
    case "YEAR": { const first = { y: anchor.y, m: 1, d: 1 }; return { first, nextDay: { y: anchor.y + 1, m: 1, d: 1 }, unit }; }
    case "FINANCIAL_YEAR": { const first = startOfFinancialYear(anchor, calendar.financialYearStartMonth); return { first, nextDay: addMonths(first, 12), unit }; }
  }
}

/** Shift a calendar-unit span by whole units (negative = earlier). */
function shiftUnit(span: DateSpan, units: number, calendar: CalendarSettings): DateSpan {
  switch (span.unit) {
    case "DAY": return unitSpan("DAY", addDays(span.first, units), calendar);
    case "WEEK": return unitSpan("WEEK", addDays(span.first, units * 7), calendar);
    case "MONTH": return unitSpan("MONTH", addMonths(span.first, units), calendar);
    case "QUARTER": return unitSpan("QUARTER", addMonths(span.first, units * 3), calendar);
    case "YEAR": return unitSpan("YEAR", { y: span.first.y + units, m: 1, d: 1 }, calendar);
    case "FINANCIAL_YEAR": return unitSpan("FINANCIAL_YEAR", addMonths(span.first, units * 12), calendar);
    default: throw new PeriodError("A custom range has no calendar unit to shift");
  }
}

function presetSpan(preset: Exclude<PeriodPreset, "CUSTOM">, today: LocalDate, calendar: CalendarSettings): DateSpan {
  const current = (unit: Exclude<Unit, "RANGE">) => unitSpan(unit, today, calendar);
  const last = (unit: Exclude<Unit, "RANGE">) => shiftUnit(unitSpan(unit, today, calendar), -1, calendar);
  switch (preset) {
    case "TODAY": return current("DAY");
    case "YESTERDAY": return last("DAY");
    case "THIS_WEEK": return current("WEEK");
    case "LAST_WEEK": return last("WEEK");
    case "THIS_MONTH": return current("MONTH");
    case "LAST_MONTH": return last("MONTH");
    case "THIS_QUARTER": return current("QUARTER");
    case "LAST_QUARTER": return last("QUARTER");
    case "THIS_YEAR": return current("YEAR");
    case "LAST_YEAR": return last("YEAR");
    case "THIS_FINANCIAL_YEAR": return current("FINANCIAL_YEAR");
    case "LAST_FINANCIAL_YEAR": return last("FINANCIAL_YEAR");
  }
}

export interface RangeInput {
  preset?: PeriodPreset;
  /** Inclusive local dates, only for CUSTOM. */
  from?: string;
  to?: string;
  compare?: CompareMode;
  /** Inclusive local dates for compare = CUSTOM. */
  compareFrom?: string;
  compareTo?: string;
}

/** Longest custom range accepted, to keep queries bounded. */
export const MAX_RANGE_DAYS = 800;

export function resolveRange(input: RangeInput, calendarInput: CalendarSettings = DEFAULT_CALENDAR, now: Date = new Date()): ResolvedRange {
  const calendar = validateCalendar(calendarInput);
  const preset = input.preset ?? "THIS_MONTH";
  if (!PERIOD_PRESETS.includes(preset)) throw new PeriodError(`Unknown period "${preset}"`);
  const compare = input.compare ?? "PREVIOUS_PERIOD";
  if (!COMPARE_MODES.includes(compare)) throw new PeriodError(`Unknown comparison "${compare}"`);
  const today = localDateOf(now, calendar.timeZone);

  let span: DateSpan;
  if (preset === "CUSTOM") {
    if (!input.from || !input.to) throw new PeriodError("A custom range needs both from and to");
    const first = parseIsoDate(input.from);
    const lastDay = parseIsoDate(input.to);
    if (diffDays(first, lastDay) < 0) throw new PeriodError("The end date is before the start date");
    if (diffDays(first, lastDay) + 1 > MAX_RANGE_DAYS) throw new PeriodError(`A range may span at most ${MAX_RANGE_DAYS} days`);
    span = { first, nextDay: addDays(lastDay, 1), unit: "RANGE" };
  } else {
    span = presetSpan(preset, today, calendar);
  }
  const current = materialise(span, calendar);
  const lengthDays = diffDays(span.first, span.nextDay);
  const inProgress = now.getTime() < current.end.getTime() && now.getTime() >= current.start.getTime();

  let baseline: DateSpan | null = null;
  if (compare === "PREVIOUS_PERIOD") {
    baseline = span.unit === "RANGE"
      ? { first: addDays(span.first, -lengthDays), nextDay: span.first, unit: "RANGE" }
      : shiftUnit(span, -1, calendar);
  } else if (compare === "YEAR_OVER_YEAR") {
    baseline = { first: addMonths(span.first, -12), nextDay: addMonths(span.nextDay, -12), unit: span.unit === "RANGE" ? "RANGE" : span.unit };
  } else if (compare === "MONTH_OVER_MONTH") {
    baseline = { first: addMonths(span.first, -1), nextDay: addMonths(span.nextDay, -1), unit: "RANGE" };
  } else if (compare === "QUARTER_OVER_QUARTER") {
    baseline = { first: addMonths(span.first, -3), nextDay: addMonths(span.nextDay, -3), unit: "RANGE" };
  } else if (compare === "WEEK_OVER_WEEK") {
    baseline = { first: addDays(span.first, -7), nextDay: addDays(span.nextDay, -7), unit: "RANGE" };
  } else if (compare === "CUSTOM") {
    if (!input.compareFrom || !input.compareTo) throw new PeriodError("A custom baseline needs compareFrom and compareTo");
    const first = parseIsoDate(input.compareFrom);
    const lastDay = parseIsoDate(input.compareTo);
    if (diffDays(first, lastDay) < 0) throw new PeriodError("The baseline end date is before its start date");
    if (diffDays(first, lastDay) + 1 > MAX_RANGE_DAYS) throw new PeriodError(`A range may span at most ${MAX_RANGE_DAYS} days`);
    baseline = { first, nextDay: addDays(lastDay, 1), unit: "RANGE" };
  }

  let previous: ResolvedPeriod | null = null;
  let likeForLike = false;
  if (baseline) {
    if (inProgress) {
      // Compare month-to-date with the same number of days of the baseline, never with its full length.
      const elapsed = Math.max(1, diffDays(span.first, today) + 1);
      const baselineLength = diffDays(baseline.first, baseline.nextDay);
      if (elapsed < baselineLength) {
        baseline = { first: baseline.first, nextDay: addDays(baseline.first, elapsed), unit: "RANGE" };
        likeForLike = true;
      }
    }
    previous = materialise(baseline, calendar);
  }
  return { preset, current, previous, compare, likeForLike, calendar, generatedAt: now.toISOString() };
}

/* ───────────────────────── trend buckets ───────────────────────── */

export type Granularity = "day" | "week" | "month";

export function chooseGranularity(period: Pick<ResolvedPeriod, "startDate" | "endDate">): Granularity {
  const days = diffDays(parseIsoDate(period.startDate), parseIsoDate(period.endDate)) + 1;
  if (days <= 31) return "day";
  if (days <= 150) return "week";
  return "month";
}

/** Bucket start dates ("YYYY-MM-DD") covering the period, so empty buckets can be zero-filled. */
export function bucketStarts(period: Pick<ResolvedPeriod, "startDate" | "endDate">, granularity: Granularity, weekStartsOn: number): string[] {
  const first = parseIsoDate(period.startDate);
  const last = parseIsoDate(period.endDate);
  const out: string[] = [];
  let cursor = granularity === "day" ? first : granularity === "week" ? startOfWeek(first, weekStartsOn) : startOfMonth(first);
  while (diffDays(cursor, last) >= 0) {
    out.push(toIsoDate(cursor));
    cursor = granularity === "day" ? addDays(cursor, 1) : granularity === "week" ? addDays(cursor, 7) : addMonths(cursor, 1);
  }
  return out;
}

/** The bucket start date an instant belongs to, in the facility's zone. */
export function bucketOf(instant: Date, granularity: Granularity, calendar: CalendarSettings): string {
  const local = localDateOf(instant, calendar.timeZone);
  return toIsoDate(granularity === "day" ? local : granularity === "week" ? startOfWeek(local, calendar.weekStartsOn) : startOfMonth(local));
}
