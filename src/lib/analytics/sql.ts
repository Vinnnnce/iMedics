import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bucketStarts, type CalendarSettings, type Granularity, type ResolvedPeriod } from "./periods";

/**
 * Raw-SQL helpers. Only identifiers written in this codebase are ever interpolated with
 * Prisma.raw; every value goes through a bound parameter.
 *
 * Timestamps in the database are `timestamp(3)` holding UTC wall-clock time. Parameters are passed as
 * ISO strings cast to `timestamp` so the server's own time zone can never shift them.
 */

export const db = prisma;

export const ts = (d: Date) => Prisma.sql`${d.toISOString().replace("Z", "")}::timestamp`;

/** `col` as facility-local wall-clock time. */
export const localTs = (col: Prisma.Sql, timeZone: string) => Prisma.sql`((${col} AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}::text)`;

export function bucketExpr(col: Prisma.Sql, granularity: Granularity, calendar: CalendarSettings): Prisma.Sql {
  const local = localTs(col, calendar.timeZone);
  if (granularity === "day") return Prisma.sql`to_char(date_trunc('day', ${local}), 'YYYY-MM-DD')`;
  if (granularity === "month") return Prisma.sql`to_char(date_trunc('month', ${local}), 'YYYY-MM-DD')`;
  return Prisma.sql`to_char(date_trunc('day', ${local}) - (((extract(dow from ${local})::int - ${calendar.weekStartsOn}::int + 7) % 7) * interval '1 day'), 'YYYY-MM-DD')`;
}

/**
 * Count rows per time bucket. `source` is a full `FROM … WHERE …` fragment (without the period filter);
 * `col` is the event timestamp inside it. Empty buckets are zero-filled.
 */
export async function bucketedCounts(
  source: Prisma.Sql,
  col: Prisma.Sql,
  period: ResolvedPeriod,
  granularity: Granularity,
  calendar: CalendarSettings,
): Promise<{ x: string; y: number }[]> {
  const bucket = bucketExpr(col, granularity, calendar);
  const rows = await db.$queryRaw<{ bucket: string; n: number }[]>`
    SELECT ${bucket} AS bucket, count(*)::int AS n
    ${source} AND ${col} >= ${ts(period.start)} AND ${col} < ${ts(period.end)}
    GROUP BY 1`;
  const map = new Map(rows.map((r) => [r.bucket, r.n]));
  return bucketStarts(period, granularity, calendar.weekStartsOn).map((x) => ({ x, y: map.get(x) ?? 0 }));
}

/** Average of an interval expression (in minutes) per bucket; buckets with no records are null, not 0. */
export async function bucketedAverageMinutes(
  source: Prisma.Sql,
  eventCol: Prisma.Sql,
  minutesExpr: Prisma.Sql,
  period: ResolvedPeriod,
  granularity: Granularity,
  calendar: CalendarSettings,
): Promise<{ x: string; y: number | null }[]> {
  const bucket = bucketExpr(eventCol, granularity, calendar);
  const rows = await db.$queryRaw<{ bucket: string; v: number | null }[]>`
    SELECT ${bucket} AS bucket, round(avg(${minutesExpr})::numeric, 1)::float AS v
    ${source} AND ${eventCol} >= ${ts(period.start)} AND ${eventCol} < ${ts(period.end)}
    GROUP BY 1`;
  const map = new Map(rows.map((r) => [r.bucket, r.v]));
  return bucketStarts(period, granularity, calendar.weekStartsOn).map((x) => ({ x, y: map.get(x) ?? null }));
}

export const minutesDiff = (later: Prisma.Sql, earlier: Prisma.Sql) => Prisma.sql`(extract(epoch from (${later} - ${earlier})) / 60.0)`;

export function inList(values: readonly string[]): Prisma.Sql {
  return values.length ? Prisma.join(values.map((v) => Prisma.sql`${v}`)) : Prisma.sql`NULL`;
}

export function uuidList(values: readonly string[]): Prisma.Sql {
  return values.length ? Prisma.join(values.map((v) => Prisma.sql`${v}::uuid`)) : Prisma.sql`NULL::uuid`;
}
