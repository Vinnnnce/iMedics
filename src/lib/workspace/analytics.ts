import { z } from "zod";
export const analyticsRangeSchema = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional() });
export function analyticsRange(input: { from?: string; to?: string }, now = new Date()) {
  const end = input.to ? new Date(`${input.to}T00:00:00Z`) : new Date(now.toISOString().slice(0, 10));
  end.setUTCDate(end.getUTCDate() + 1);
  const start = input.from ? new Date(`${input.from}T00:00:00Z`) : new Date(end.getTime() - 30 * 86400000);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || end.getTime() - start.getTime() > 366 * 86400000) throw new Error("Choose an ordered date range of up to 366 days");
  return { start, end, calendarHours: (end.getTime() - start.getTime()) / 3600000 };
}
export function percentile(values: number[], fraction: number) {
  if (!values.length) return null;
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  return sorted[Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1))];
}
