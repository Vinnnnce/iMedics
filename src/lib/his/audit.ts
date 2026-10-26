import type { Prisma } from "@prisma/client";
import { writeAudit } from "@/lib/audit";
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

export function documentEvent(
  tx: Prisma.TransactionClient,
  documentId: string,
  action: string,
  actorId: string | null,
  note?: string | null,
  snapshot?: Prisma.InputJsonValue,
) {
  return tx.clinicalDocumentEvent.create({ data: { documentId, action, actorId, note: note ?? null, ...(snapshot !== undefined ? { snapshot } : {}) } });
}
