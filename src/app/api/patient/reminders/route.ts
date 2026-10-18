import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { HHMM } from "@/lib/clinic-time";
import { recordDoseStatus, adherenceSummary, todaysDoses, materialiseDoseEvents } from "@/lib/medication-reminders";

/**
 * Medication reminders for the signed-in patient (or a clinician acting for an
 * assigned patient). Reminders are created from prescription schedules or
 * manually; each reminder materialises dose events that the patient
 * acknowledges, marks taken, skipped or missed.
 */

const patientBody = z.object({ patientId: z.string().uuid().optional() });

async function resolvePatientId(user: { id: string; role: string }, patientId?: string): Promise<string> {
  if (patientId && user.role !== "PATIENT") {
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw Object.assign(new Error("Patient not found"), { status: 404 });
    if (user.role === "DOCTOR") {
      const doctor = await prisma.doctorProfile.findUnique({ where: { userId: user.id } });
      const assignment = doctor
        ? await prisma.patientAssignment.findFirst({ where: { patientId, doctorId: doctor.id }, select: { id: true } })
        : null;
      if (!assignment) throw Object.assign(new Error("Patient not found"), { status: 404 });
    }
    return patientId;
  }
  const own = await prisma.patient.findUniqueOrThrow({ where: { userId: user.id } });
  return own.id;
}

const reminderSchema = z.object({
  label: z.string().trim().min(1).max(200),
  times: z.array(z.string().regex(HHMM, "Times must use 24-hour HH:mm format")).min(1).max(8),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
  patientId: z.string().uuid().optional(),
});

// GET /api/patient/reminders — reminders, today's doses and adherence summary.
export const GET = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req, { user }) => {
  const { patientId } = parseQuery(req, patientBody);
  const id = await resolvePatientId(user, patientId);

  const [reminders, doses, adherence] = await Promise.all([
    prisma.medicationReminder.findMany({ where: { patientId: id, active: true }, orderBy: { createdAt: "desc" } }),
    todaysDoses(id),
    adherenceSummary(id),
  ]);
  return NextResponse.json({ reminders, doses, adherence });
});

// POST /api/patient/reminders — create a reminder (patient or clinician).
export const POST = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { user }) => {
  const body = await parseBody(req, reminderSchema);
  const patientId = await resolvePatientId(user, body.patientId);

  const reminder = await prisma.medicationReminder.create({
    data: {
      patientId,
      label: body.label,
      times: body.times,
      startDate: body.startDate,
      endDate: body.endDate ?? null,
      createdById: user.id,
    },
  });
  // Materialise today's doses immediately so the first reminder is on time.
  await materialiseDoseEvents({ ...reminder, patientId }, new Date(), new Date(Date.now() + 86_400_000));
  return NextResponse.json({ reminder }, { status: 201 });
});
