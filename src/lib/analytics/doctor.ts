import { prisma } from "@/lib/prisma";
import { getVerifiedDoctorProfile } from "@/lib/access";
import type { User } from "@prisma/client";
import { DEFAULT_CALENDAR, resolveRange, type RangeInput } from "./periods";
import { doctorPlatformPerformance } from "./personal";
import type { DashboardPayload } from "./types";

/** Independent-practice performance for the signed-in doctor. Only ever the doctor's own records. */
export async function loadDoctorPerformance(user: User, input: RangeInput, now = new Date()): Promise<DashboardPayload> {
  const doctor = await getVerifiedDoctorProfile(user);
  // Doctors have no facility settings; the clinic time zone from their profile (if any) is not stored, so the platform default applies.
  const calendar = DEFAULT_CALENDAR;
  const range = resolveRange(input, calendar, now);
  const built = await doctorPlatformPerformance({ userId: user.id, doctorId: doctor.id, range });
  void prisma;
  return {
    dashboard: "my-performance", title: "My performance",
    facility: { id: doctor.id, name: "My practice", kind: "DOCTOR" },
    range: {
      preset: range.preset, compare: range.compare, likeForLike: range.likeForLike, timeZone: calendar.timeZone,
      current: { start: range.current.start.toISOString(), end: range.current.end.toISOString(), startDate: range.current.startDate, endDate: range.current.endDate, label: range.current.label },
      previous: range.previous ? { start: range.previous.start.toISOString(), end: range.previous.end.toISOString(), startDate: range.previous.startDate, endDate: range.previous.endDate, label: range.previous.label } : null,
    },
    ...built, computedAt: now.toISOString(), cached: false, departmentScoped: false,
  };
}
