import { z } from "zod";

export type SearchParams = Record<string, string | string[] | undefined>;

/** Take the first value of each query parameter, so a repeated parameter cannot break validation. */
export function firstValues(searchParams: SearchParams): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}

/** Empty strings from a submitted filter form mean "no filter". */
export const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === "all" ? undefined : v), schema.optional());

export const pageSchema = z.coerce.number().int().min(1).max(10_000).catch(1);

/** Build a link that keeps the current filters and changes some of them. */
export function withParams(base: string, current: Record<string, string | undefined>, changes: Record<string, string | undefined>): string {
  const merged = { ...current, ...changes };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
  const text = qs.toString();
  return text ? `${base}?${text}` : base;
}
