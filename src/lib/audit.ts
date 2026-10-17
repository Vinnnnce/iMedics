import type { Prisma, Role } from "@prisma/client";
import { prisma } from "./prisma";

interface AuditInput {
  userId?: string | null;
  actorRole?: Role | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Prisma.InputJsonValue;
  req?: Request;
  /** Facility the action concerns, when applicable. */
  facilityId?: string | null;
  /** Patient the action concerns, when applicable. */
  patientId?: string | null;
  /** "SUCCESS" (default) or "FAILURE". */
  outcome?: "SUCCESS" | "FAILURE";
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
        actorRole: input.actorRole ?? null,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId ?? null,
        details: input.details ?? {},
        ipAddress: input.req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        userAgent: input.req?.headers.get("user-agent") ?? null,
        facilityId: input.facilityId ?? null,
        patientId: input.patientId ?? null,
        outcome: input.outcome ?? "SUCCESS",
      },
    });
  } catch (error) {
    console.error("Audit log write failed", { kind: error instanceof Error ? error.name : "UnknownError" });
  }
}
