import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVerifiedDoctorProfile, findAccessiblePatient } from "@/lib/access";
import { extensionAudit } from "@/lib/workspace/extensions";
import { notFound } from "@/lib/errors";
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  await getVerifiedDoctorProfile(user);
  await extensionAudit(user, "WORKSPACE_FOLLOWUPS_READ");
  return Response.json(await prisma.$queryRaw`SELECT id, consultation_id, due_at, delivered_at
    FROM workspace_followups WHERE owner_id = ${user.id}::uuid ORDER BY due_at DESC LIMIT 100`);
});
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const b = await parseBody(req, z.object({ consultationId: z.uuid(), dueAt: z.iso.datetime().refine(v => Date.parse(v) > Date.now(), "Choose a future date") }));
  const doctor = await getVerifiedDoctorProfile(user);
  const consultation = await prisma.consultation.findFirst({ where: { id: b.consultationId, doctorId: doctor.id, status: "FINALIZED" }, select: { id: true, patientId: true, patient: { select: { userId: true } } } });
  if (!consultation?.patient.userId) throw notFound("Consultation not found");
  await findAccessiblePatient(user, consultation.patientId, { write: true });
  await extensionAudit(user, "WORKSPACE_FOLLOWUP_SCHEDULED", b.consultationId);
  await prisma.$executeRaw`INSERT INTO workspace_followups(id, owner_id, recipient_id, consultation_id, due_at)
    VALUES(${randomUUID()}::uuid, ${user.id}::uuid, ${consultation.patient.userId}::uuid, ${b.consultationId}::uuid, ${new Date(b.dueAt)})
    ON CONFLICT(consultation_id, due_at) DO NOTHING`;
  return Response.json({ success: true });
});
export const DELETE = withAuth(["DOCTOR"], async (req, { user }) => {
  const { id } = await parseBody(req, z.object({ id: z.uuid() }));
  await getVerifiedDoctorProfile(user);
  await prisma.$transaction(async tx => {
    const removed = await tx.$executeRaw`DELETE FROM workspace_followups WHERE id = ${id}::uuid AND owner_id = ${user.id}::uuid AND delivered_at IS NULL`;
    if (!removed) throw notFound("Pending follow-up not found");
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_FOLLOWUP_CANCELLED", resourceType: "Followup", resourceId: id } });
  });
  return Response.json({ success: true });
});
