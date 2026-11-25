import { resolveRange, type CalendarSettings, type PeriodPreset } from "./periods";

export const SCHEDULES = ["NONE", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"] as const;
export type Schedule = (typeof SCHEDULES)[number];

/** The completed period a scheduled run reports on. */
export const SCHEDULE_PRESET: Record<Exclude<Schedule, "NONE">, PeriodPreset> = {
  WEEKLY: "LAST_WEEK", MONTHLY: "LAST_MONTH", QUARTERLY: "LAST_QUARTER", ANNUAL: "LAST_YEAR",
};
const CURRENT_PRESET: Record<Exclude<Schedule, "NONE">, PeriodPreset> = {
  WEEKLY: "THIS_WEEK", MONTHLY: "THIS_MONTH", QUARTERLY: "THIS_QUARTER", ANNUAL: "THIS_YEAR",
};

/** Reports run at 06:00 local time on the first day after a period closes. */
export function nextRunAt(schedule: Schedule, calendar: CalendarSettings, from: Date): Date | null {
  if (schedule === "NONE") return null;
  const current = resolveRange({ preset: CURRENT_PRESET[schedule], compare: "NONE" }, calendar, from).current;
  return new Date(current.end.getTime() + 6 * 3_600_000);
}
