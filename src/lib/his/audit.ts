import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
import { queueDocumentWorkflowNotifications } from "./notifications";
import type { HisAccess } from "./access";

/** Platform audit entry for HIS actions, always tagged with the facility (and patient when known). */
export function auditHis(
  access: Pick<HisAccess, "user" | "facility">,
  action: string,
  resourceType: string,
  resourceId: string | null,
  req: Request,
  extra: { patientId?: string | null; details?: Prisma.InputJsonValue } = {},
) {
  return writeAudit({
    userId: access.user.id,
    actorRole: access.user.role,
    facilityId: access.facility.id,
    patientId: extra.patientId ?? null,
    action,
    resourceType,
    resourceId,
    details: extra.details ?? {},
    req,
  });
}

export async function documentEvent(
  tx: Prisma.TransactionClient,
  documentId: string,
  action: string,
  actorId: string | null,
  note?: string | null,
  snapshot?: Prisma.InputJsonValue,
) {
  const document = await tx.clinicalDocument.findUniqueOrThrow({
    where: { id: documentId }, select: { facilityId: true, patientId: true },
  });
  const event = await tx.clinicalDocumentEvent.create({ data: { documentId, action, actorId, note: note ?? null, ...(snapshot !== undefined ? { snapshot } : {}) } });
  // Unlike the supplementary request log, this is deliberately fail-closed:
  // failure rolls back the document transition and its signature/event.
  await tx.auditLog.create({ data: {
    userId: actorId, facilityId: document.facilityId, patientId: document.patientId,
    action: `HIS_DOCUMENT_${action}`, resourceType: "ClinicalDocument", resourceId: documentId,
    details: { eventId: event.id },
  } });
  await queueDocumentWorkflowNotifications(tx, documentId, action, actorId);
  return event;
}
