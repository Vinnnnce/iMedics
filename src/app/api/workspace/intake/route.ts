import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { patientScope } from "@/lib/access";
import { extensionAudit } from "@/lib/workspace/extensions";
import { notFound } from "@/lib/errors";

export const GET = withAuth(["PATIENT", "DOCTOR"], async (req, { user }) => {
  const id = z.uuid().parse(new URL(req.url).searchParams.get("appointmentId"));
  const scope = await patientScope(user);
  const appointment = await prisma.appointment.findFirst({ where: { id, patient: scope.where, ...(scope.doctorId ? { doctorId: scope.doctorId } : {}) }, select: { id: true } });
  if (!appointment) throw notFound("Appointment not found");
  await extensionAudit(user, "WORKSPACE_INTAKE_READ", id);
  return Response.json(await prisma.$queryRaw`SELECT reason, medications, allergies, consent_at FROM workspace_intakes WHERE appointment_id = ${id}::uuid`, { headers: { "Cache-Control": "no-store" } });
});
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const b = await parseBody(req, z.object({ appointmentId: z.uuid(), reason: z.string().trim().min(1).max(3000), medications: z.string().max(3000), allergies: z.string().max(3000), consent: z.literal(true) }));
  const appointment = await prisma.appointment.findFirst({ where: { id: b.appointmentId, patient: { userId: user.id, deletedAt: null } }, select: { id: true } });
  if (!appointment) throw notFound("Appointment not found");
  await extensionAudit(user, "WORKSPACE_INTAKE_SAVED", b.appointmentId);
  await prisma.$executeRaw`INSERT INTO workspace_intakes(id, owner_id, appointment_id, reason, medications, allergies, consent_at)
    VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${b.appointmentId}::uuid, ${b.reason}, ${b.medications}, ${b.allergies}, now())
    ON CONFLICT(appointment_id) DO UPDATE SET reason = EXCLUDED.reason, medications = EXCLUDED.medications, allergies = EXCLUDED.allergies, consent_at = now()
    WHERE workspace_intakes.owner_id = ${user.id}::uuid`;
  return Response.json({ success: true });
});
