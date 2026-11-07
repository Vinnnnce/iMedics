import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { safeErrorMetadata } from "./safe-error";

interface AuditInput {
  userId?: string | null;
  facilityId?: string | null;
  patientId?: string | null;
  actorRole?: Role | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Prisma.InputJsonValue;
  req?: Request;
}

/**
 * Append an entry to the audit trail. A failure to write the log is reported
 * but never breaks the request that triggered it.
 */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        facilityId: input.facilityId ?? null,
        patientId: input.patientId ?? null,
        actorRole: input.actorRole ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        details: input.details ?? {},
        ipAddress: input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: input.req?.headers.get("user-agent") ?? null,
      },
    });
  } catch (error) {
    console.error("Audit log write failed:", safeErrorMetadata(error));
  }
}
