import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { HHMM } from "@/lib/clinic-time";
import { recordDoseStatus } from "@/lib/medication-reminders";

/**
 * Manage one reminder (edit, pause, remove) and record dose statuses.
 * The patient can only touch their own reminders; clinicians need an active
 * assignment. Recording a dose as taken is always explicit — opening the
 * notification only acknowledges it.
 */

const patchSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  times: z.array(z.string().regex(HHMM)).min(1).max(8).optional(),
  endDate: z.coerce.date().nullable().optional(),
  active: z.boolean().optional(),
  snoozeMinutes: z.number().int().min(5).max(120).optional(),
});

async function loadOwnedReminder(user: { id: string; role: string }, reminderId: string) {
  const reminder = await prisma.medicationReminder.findUnique({ where: { id: reminderId } });
  if (!reminder) throw Object.assign(new Error("Reminder not found"), { status: 404 });
  if (user.role === "PATIENT") {
    const own = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
    if (reminder.patientId !== own.id) throw Object.assign(new Error("Reminder not found"), { status: 404 });
  } else if (user.role === "DOCTOR") {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
    const assignment = doctor
      ? await prisma.patientAssignment.findFirst({ where: { patientId: reminder.patientId, doctorId: doctor.id }, select: { id: true } })
      : null;
    if (!assignment) throw Object.assign(new Error("Reminder not found"), { status: 404 });
  }
  return reminder;
}

export const PATCH = withAuth<{ id: string }>(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const reminder = await loadOwnedReminder(user, id);
  const body = await parseBody(req, patchSchema);

  const updated = await prisma.medicationReminder.update({
    where: { id: reminder.id },
    data: {
      ...(body.label ? { label: body.label } : {}),
      ...(body.times ? { times: body.times } : {}),
      ...(body.endDate !== undefined ? { endDate: body.endDate } : {}),
      ...(body.active !== undefined ? { active: body.active } : {}),
      ...(body.snoozeMinutes !== undefined ? { snoozeMinutes: body.snoozeMinutes } : {}),
    },
  });
  return NextResponse.json({ reminder: updated });
});

export const DELETE = withAuth<{ id: string }>(["PATIENT", "DOCTOR", "ADMIN"], async (_req: NextRequest, { params, user }) => {
  const { id } = await params;
  const reminder = await loadOwnedReminder(user, id);
  await prisma.medicationReminder.update({ where: { id: reminder.id }, data: { active: false } });
  return NextResponse.json({ ok: true });
});

// POST /api/patient/reminders/[id] — record a dose status for a dose event.
// Body: { doseEventId, status: ACKNOWLEDGED | TAKEN | SKIPPED }
const doseSchema = z.object({
  doseEventId: z.string().uuid(),
  status: z.enum(["ACKNOWLEDGED", "TAKEN", "SKIPPED"]),
});

export const POST = withAuth<{ id: string }>(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const reminder = await loadOwnedReminder(user, id);
  const body = await parseBody(req, doseSchema);

  const dose = await prisma.doseEvent.findUnique({ where: { id: body.doseEventId } });
  if (!dose || dose.reminderId !== reminder.id) {
    return NextResponse.json({ error: "Dose not found" }, { status: 404 });
  }
  const updated = await recordDoseStatus(body.doseEventId, body.status, user.id, user.role === "PATIENT" ? "PATIENT" : "CLINICIAN");
  return NextResponse.json({ dose: updated });
});
