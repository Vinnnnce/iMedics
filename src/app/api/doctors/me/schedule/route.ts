import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { HHMM, hhmmToMinutes } from "@/lib/clinic-time";
import { writeAudit } from "@/lib/audit";

// GET /api/doctors/me/schedule — the doctor's published weekly availability
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const slots = await prisma.doctorSchedule.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });
  return NextResponse.json({ slots });
});

const windowSchema = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
    startTime: z.string().regex(HHMM, "Use HH:MM"),
    endTime: z.string().regex(HHMM, "Use HH:MM"),
    slotMinutes: z.number().int().min(10).max(120).default(30),
  })
  .refine((w) => hhmmToMinutes(w.endTime) - hhmmToMinutes(w.startTime) >= w.slotMinutes, {
    message: "Each window must be at least one slot long",
  });

const scheduleSchema = z.object({ slots: z.array(windowSchema).max(50) });

// PUT /api/doctors/me/schedule — replace the weekly availability (clinic time, WAT).
// Appointments that are already booked are not affected.
export const PUT = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const { slots } = await parseBody(req, scheduleSchema);

  // Windows on the same day must not overlap.
  const sorted = [...slots].sort(
    (a, b) => a.dayOfWeek - b.dayOfWeek || hhmmToMinutes(a.startTime) - hhmmToMinutes(b.startTime),
  );
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev.dayOfWeek === cur.dayOfWeek && hhmmToMinutes(cur.startTime) < hhmmToMinutes(prev.endTime)) {
      throw badRequest("Availability windows on the same day must not overlap");
    }
  }

  await prisma.$transaction([
    prisma.doctorSchedule.deleteMany({ where: { doctorId: doctor.id } }),
    prisma.doctorSchedule.createMany({ data: sorted.map((slot) => ({ ...slot, doctorId: doctor.id })) }),
  ]);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "SCHEDULE_UPDATED",
    resourceType: "DoctorProfile",
    resourceId: doctor.id,
    req,
  });

  return NextResponse.json({ success: true, slots: sorted });
});
