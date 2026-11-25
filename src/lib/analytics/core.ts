import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getMetric } from "./registry";
import { change, evaluateTarget, round, type TargetDirection } from "./stats";
import type { AnalyticsScope } from "./scope";
import type { ResolvedRange } from "./periods";
import type { DataGap, KpiValue, Section } from "./types";

export interface Ctx {
  scope: AnalyticsScope;
  range: ResolvedRange;
  /** Resolved department filter (null = whole facility). */
  dept: { wardIds: string[]; wardNames: string[]; departmentNames: string[] } | null;
  now: Date;
}

export interface Figure {
  value: number | null;
  numerator?: number;
  denominator?: number;
  sampleSize?: number;
  currency?: string;
  note?: string;
}

export type Figures = Record<string, Figure>;

export const fig = (value: number | null, extra: Omit<Figure, "value"> = {}): Figure => ({ value, ...extra });

export function figRatio(numerator: number, denominator: number): Figure {
  return { value: denominator > 0 ? round((numerator / denominator) * 100, 1) : null, numerator, denominator, sampleSize: denominator };
}

/** Build a KPI from the registry definition, a current figure and (optionally) the baseline figure. */
export function makeKpi(key: string, current: Figure, previous?: Figure | null, extra: Partial<KpiValue> = {}): KpiValue {
  const def = getMetric(key);
  if (!def) throw new Error(`Unregistered analytics metric "${key}"`);
  return {
    key,
    label: def.name,
    value: current.value,
    unit: def.unit,
    betterWhen: def.betterWhen,
    ...(current.numerator !== undefined ? { numerator: current.numerator, denominator: current.denominator } : {}),
    ...(current.sampleSize !== undefined ? { sampleSize: current.sampleSize } : {}),
    ...(current.currency ? { currency: current.currency } : {}),
    ...(current.note ? { note: current.note } : {}),
    ...(previous ? { change: change(current.value, previous.value) } : {}),
    ...(def.caveat && !extra.note && !current.note ? { note: def.caveat } : {}),
    ...extra,
  };
}

/** Attach facility targets to KPIs whose metric is targetable. */
export async function attachTargets(facilityId: string, kpis: KpiValue[], departmentId?: string | null): Promise<KpiValue[]> {
  const keys = kpis.filter((k) => getMetric(k.key)?.targetable).map((k) => k.key);
  if (!keys.length) return kpis;
  const rows = await prisma.analyticsPerformanceTarget.findMany({
    where: { facilityId, metricKey: { in: keys }, scopeKey: { in: departmentId ? ["FACILITY", departmentId] : ["FACILITY"] } },
  });
  return kpis.map((k) => {
    const candidates = rows.filter((r) => r.metricKey === k.key);
    const row = candidates.find((r) => departmentId && r.scopeKey === departmentId) ?? candidates.find((r) => r.scopeKey === "FACILITY");
    if (!row) return k;
    const target = Number(row.targetValue);
    const direction = row.direction as TargetDirection;
    const ev = evaluateTarget(k.value, target, direction);
    return { ...k, target: { value: target, direction, status: ev.status, progressPercent: ev.progressPercent } };
  });
}

export function targetsSection(kpis: KpiValue[]): Section | null {
  const items = kpis.filter((k) => k.target).map((k) => ({
    key: k.key, label: k.label, actual: k.value, target: k.target!.value, unit: k.unit, direction: k.target!.direction,
    status: k.target!.status, progressPercent: k.target!.progressPercent,
  }));
  if (!items.length) return null;
  return { id: "targets", title: "Performance against targets", question: "Where are we meeting or missing the targets this facility set for itself?", visual: { type: "progress", items } };
}

export function gap(indicator: string, reason: string): DataGap {
  return { indicator, reason };
}

/** SQL fragment restricting admissions alias `a` to the viewer's departments (ward names). */
export function admissionDeptSql(ctx: Ctx, alias = "a"): Prisma.Sql {
  if (!ctx.dept) return Prisma.empty;
  const names = ctx.dept.wardNames.length ? Prisma.join(ctx.dept.wardNames.map((n) => Prisma.sql`${n}`)) : Prisma.sql`NULL`;
  return Prisma.sql` AND ${Prisma.raw(alias)}.ward IN (${names})`;
}

/** SQL fragment restricting encounters alias `e` to the viewer's departments (department name). */
export function encounterDeptSql(ctx: Ctx, alias = "e"): Prisma.Sql {
  if (!ctx.dept) return Prisma.empty;
  const names = ctx.dept.departmentNames.length ? Prisma.join(ctx.dept.departmentNames.map((n) => Prisma.sql`${n}`)) : Prisma.sql`NULL`;
  return Prisma.sql` AND ${Prisma.raw(alias)}.department IN (${names})`;
}

export const ADMISSION_EMERGENCY_SQL = Prisma.sql`(e.type IN ('EMERGENCY_DEPARTMENT','EMERGENCY_INPATIENT') OR e.is_emergency = true)`;

/** Wards whose name marks them as ICU or HDU (Medic1905 wards carry no unit-type field). */
export function wardClass(name: string, code?: string | null): "ICU" | "HDU" | "GENERAL" {
  const text = `${name} ${code ?? ""}`;
  if (/\b(icu|itu|intensive care|nicu|picu)\b/i.test(text)) return "ICU";
  if (/\b(hdu|high[- ]dependency)\b/i.test(text)) return "HDU";
  return "GENERAL";
}
