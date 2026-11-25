/**
 * Pure statistical helpers shared by every dashboard.
 *
 * Two rules run through all of them:
 *  1. Missing is not zero. A rate with no denominator, or an average over no records, is `null`
 *     and is shown as "no data", never as 0.
 *  2. A rate always travels with its numerator and denominator so the reader can judge sample size.
 */

export interface Ratio {
  numerator: number;
  denominator: number;
  /** Percentage 0–100, or null when the denominator is 0. */
  percent: number | null;
}

export function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, percent: denominator > 0 ? round((numerator / denominator) * 100, 1) : null };
}

export function round(value: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export interface Change {
  current: number | null;
  previous: number | null;
  /** current − previous, null when either side is missing. */
  delta: number | null;
  /** Percentage change, null when previous is missing or zero (a % of zero is undefined). */
  percent: number | null;
  direction: "UP" | "DOWN" | "FLAT" | "UNKNOWN";
}

export function change(current: number | null, previous: number | null): Change {
  if (current === null || previous === null) return { current, previous, delta: null, percent: null, direction: "UNKNOWN" };
  const delta = round(current - previous, 2);
  const percent = previous === 0 ? null : round(((current - previous) / Math.abs(previous)) * 100, 1);
  return { current, previous, delta, percent, direction: delta > 0 ? "UP" : delta < 0 ? "DOWN" : "FLAT" };
}

export function mean(values: readonly number[]): number | null {
  return values.length ? round(values.reduce((s, v) => s + v, 0) / values.length, 2) : null;
}

export function percentile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(rank);
  const hi = Math.ceil(rank);
  return round(sorted[lo] + (sorted[hi] - sorted[lo]) * (rank - lo), 2);
}

export const median = (values: readonly number[]): number | null => percentile(values, 50);

export interface DurationSummary {
  count: number;
  mean: number | null;
  median: number | null;
  p90: number | null;
}

export function summariseDurations(values: readonly number[]): DurationSummary {
  const clean = values.filter((v) => Number.isFinite(v) && v >= 0);
  return { count: clean.length, mean: mean(clean), median: median(clean), p90: percentile(clean, 90) };
}

/** Minutes between two instants, or null if either is missing or the order is impossible. */
export function minutesBetween(from: Date | null | undefined, to: Date | null | undefined): number | null {
  if (!from || !to) return null;
  const ms = to.getTime() - from.getTime();
  return ms >= 0 ? ms / 60_000 : null;
}

/** Rows below this size are not reported in sensitive breakdowns (age group, cause of death). */
export const SMALL_CELL_THRESHOLD = 5;

/** Below this many cases a rate is shown with a "small sample" warning and never used to compare people. */
export const MIN_RELIABLE_SAMPLE = 20;

export function suppressSmall<T extends { count: number }>(rows: readonly T[], threshold = SMALL_CELL_THRESHOLD): { rows: (T | { label: string; count: null; suppressed: true })[]; suppressed: number } {
  let suppressed = 0;
  const out = rows.map((row) => {
    if (row.count > 0 && row.count < threshold) {
      suppressed += 1;
      return { ...(row as object), count: null, suppressed: true } as unknown as T;
    }
    return row;
  });
  return { rows: out, suppressed };
}

export const AGE_BANDS = ["0–4", "5–17", "18–39", "40–59", "60–79", "80+", "Unknown"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

export function ageBand(dateOfBirth: Date | null | undefined, at: Date): AgeBand {
  if (!dateOfBirth) return "Unknown";
  let age = at.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const beforeBirthday = at.getUTCMonth() < dateOfBirth.getUTCMonth() || (at.getUTCMonth() === dateOfBirth.getUTCMonth() && at.getUTCDate() < dateOfBirth.getUTCDate());
  if (beforeBirthday) age -= 1;
  if (age < 0) return "Unknown";
  if (age < 5) return "0–4";
  if (age < 18) return "5–17";
  if (age < 40) return "18–39";
  if (age < 60) return "40–59";
  if (age < 80) return "60–79";
  return "80+";
}

/** Whole-number-safe conversion for Prisma Decimal / bigint / string results. */
export function num(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") return Number(value);
  if (typeof value === "object" && "toNumber" in (value as object)) return (value as { toNumber(): number }).toNumber();
  return Number(value);
}

export function numOrNull(value: unknown): number | null {
  return value === null || value === undefined ? null : num(value);
}

export type TargetDirection = "AT_LEAST" | "AT_MOST";
export type TargetStatus = "MET" | "NEAR" | "MISSED" | "NO_DATA";

/** Within 10% of the target on the wrong side counts as "near". */
export function evaluateTarget(actual: number | null, target: number, direction: TargetDirection): { status: TargetStatus; gap: number | null; progressPercent: number | null } {
  if (actual === null) return { status: "NO_DATA", gap: null, progressPercent: null };
  const met = direction === "AT_LEAST" ? actual >= target : actual <= target;
  const gap = round(actual - target, 2);
  let progress: number | null = null;
  if (target !== 0) progress = round(direction === "AT_LEAST" ? (actual / target) * 100 : (target / Math.max(actual, 1e-9)) * 100, 1);
  if (met) return { status: "MET", gap, progressPercent: progress === null ? null : Math.min(progress, 100) };
  const near = target !== 0 && Math.abs(actual - target) / Math.abs(target) <= 0.1;
  return { status: near ? "NEAR" : "MISSED", gap, progressPercent: progress === null ? null : Math.min(progress, 100) };
}
