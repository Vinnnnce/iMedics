import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVerifiedDoctorProfile, findAccessiblePatient } from "@/lib/access";
import { extensionAudit } from "@/lib/workspace/extensions";
import { notFound } from "@/lib/errors";
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const b = await parseBody(req, z.object({ consultationId: z.uuid(), dueAt: z.iso.datetime().refine(v => Date.parse(v) > Date.now(), "Choose a future date") }));
  const doctor = await getVerifiedDoctorProfile(user);
  const consultation = await prisma.consultation.findFirst({ where: { id: b.consultationId, doctorId: doctor.id }, select: { id: true, patientId: true, patient: { select: { userId: true } } } });
  if (!consultation?.patient.userId) throw notFound("Consultation not found");
  await findAccessiblePatient(user, consultation.patientId, { write: true });
  await extensionAudit(user, "WORKSPACE_FOLLOWUP_SCHEDULED", b.consultationId);
  await prisma.$executeRaw`INSERT INTO workspace_followups(id, owner_id, recipient_id, consultation_id, due_at)
    VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${consultation.patient.userId}::uuid, ${b.consultationId}::uuid, ${new Date(b.dueAt)})
    ON CONFLICT(consultation_id, due_at) DO NOTHING`;
  return Response.json({ success: true });
});
