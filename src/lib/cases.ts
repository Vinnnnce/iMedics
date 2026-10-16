import type { Prisma, CareCaseType, CareCaseStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";

/**
 * Unified care-episode cases.
 *
 * Conventions (docs/SPECIFICATION.md, "Unified case management"):
 * - The patient's permanent MC- number stays on `Patient` — it is the record ID,
 *   never an episode identifier.
 * - Episode case numbers follow `MED1905-<TYPE>-<YEAR>-<SEQUENCE>` where TYPE
 *   is a single letter (C, L, D, R, H) and SEQUENCE is a per-type-per-year
 *   counter allocated inside a transaction, so numbers are unique and gap-free
 *   per allocation order.
 * - Numbers are generated on the server only. A case number never grants
 *   access: authorization always checks the patient/doctor relationships.
 * - The current status is denormalised on `CareCase`; every transition is
 *   appended to `CareCaseEvent` and validated against the transition table
 *   below so history cannot be silently rewritten.
 */

export const CASE_NUMBER_PREFIX = "MED1905";

const CASE_TYPE_CODES: Record<CareCaseType, string> = {
  CONSULTATION: "C",
  LABORATORY: "L",
  DIAGNOSTIC: "D",
  REPORT: "R",
  HOSPITAL: "H",
};

export function caseTypeCode(type: CareCaseType): string {
  return CASE_TYPE_CODES[type];
}

export function isCareCaseType(value: string): value is CareCaseType {
  return value in CASE_TYPE_CODES;
}

/** Builds the counter id used by the allocation transaction. */
function counterId(type: CareCaseType, year: number): string {
  return `${CASE_TYPE_CODES[type]}-${year}`;
}

/**
 * Allocates the next case number for a type. Must run inside a transaction:
 * the upsert takes a row lock on the counter, so concurrent creators serialise
 * on the same row and receive distinct sequences. The unique constraint on
 * `case_number` is the final guard — on the (unexpected) conflict path the
 * transaction is retried by the caller.
 */
async function allocateCaseNumber(
  tx: Prisma.TransactionClient,
  type: CareCaseType,
): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.careCaseCounter.upsert({
    where: { id: counterId(type, year) },
    create: { id: counterId(type, year), sequence: 1 },
    update: { sequence: { increment: 1 } },
  });
  return `${CASE_NUMBER_PREFIX}-${CASE_TYPE_CODES[type]}-${year}-${String(counter.sequence).padStart(5, "0")}`;
}

export type CreateCareCaseInput = {
  type: CareCaseType;
  patientId: string;
  primaryDoctorId?: string | null;
  specialty?: string | null;
  presentingComplaint?: string | null;
  diagnosisSummary?: string | null;
  followUpDate?: Date | null;
  status?: CareCaseStatus;
  actorId?: string | null;
  note?: string | null;
};

/**
 * Creates a care case with a server-generated case number inside an existing
 * transaction (counter allocation, case insert and initial status event are
 * atomic). `createCareCase` wraps this in its own transaction for standalone
 * use.
 */
export async function createCareCaseInTx(
  tx: Prisma.TransactionClient,
  input: CreateCareCaseInput,
): Promise<{ id: string; caseNumber: string }> {
  const status = input.status ?? "OPEN";
  const caseNumber = await allocateCaseNumber(tx, input.type);
  const careCase = await tx.careCase.create({
    data: {
      caseNumber,
      type: input.type,
      patientId: input.patientId,
      primaryDoctorId: input.primaryDoctorId ?? null,
      specialty: input.specialty ?? null,
      presentingComplaint: input.presentingComplaint ?? null,
      diagnosisSummary: input.diagnosisSummary ?? null,
      followUpDate: input.followUpDate ?? null,
      closedAt: status === "CLOSED" || status === "ARCHIVED" ? new Date() : null,
      status,
    },
    select: { id: true, caseNumber: true },
  });
  await tx.careCaseEvent.create({
    data: {
      caseId: careCase.id,
      status,
      note: input.note ?? "Case created",
      actorId: input.actorId ?? null,
    },
  });
  return careCase;
}

/**
 * Creates a care case with a server-generated case number. The whole
 * operation (counter allocation, case insert, initial status event) is a
 * single transaction: either the case exists with its event history, or
 * nothing is written.
 */
export async function createCareCase(input: CreateCareCaseInput): Promise<{ id: string; caseNumber: string }> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => createCareCaseInTx(tx, input));
    } catch (error) {
      // Unique violation on the case number — the row lock should prevent
      // this, but retry rather than surface a spurious 500 to the caller.
      if (isUniqueViolation(error) && attempt < 4) continue;
      throw error;
    }
  }
  throw conflict("Could not allocate a case number, please retry.");
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code?: string }).code === "P2002",
  );
}

/**
 * Validated status transitions. Doctors and admins may move a case forward or
 * close it; ARCHIVED is terminal (only reachable from CLOSED) so a closed
 * clinical episode is never silently resurrected. Patients do not change case
 * status — their actions (payments, uploads, messages) are recorded as events
 * without touching the clinical status.
 */
const ALLOWED_TRANSITIONS: Record<CareCaseStatus, CareCaseStatus[]> = {
  OPEN: ["AWAITING_CONSULTATION", "AWAITING_INVESTIGATION", "AWAITING_RESULT", "UNDER_REVIEW", "TREATMENT_ONGOING", "FOLLOW_UP_REQUIRED", "CLOSED"],
  AWAITING_CONSULTATION: ["AWAITING_INVESTIGATION", "UNDER_REVIEW", "TREATMENT_ONGOING", "CLOSED"],
  AWAITING_INVESTIGATION: ["AWAITING_RESULT", "UNDER_REVIEW", "CLOSED"],
  AWAITING_RESULT: ["RESULT_AVAILABLE", "UNDER_REVIEW", "CLOSED"],
  RESULT_AVAILABLE: ["UNDER_REVIEW", "TREATMENT_ONGOING", "FOLLOW_UP_REQUIRED", "CLOSED"],
  UNDER_REVIEW: ["AWAITING_INVESTIGATION", "AWAITING_RESULT", "TREATMENT_ONGOING", "FOLLOW_UP_REQUIRED", "CLOSED"],
  TREATMENT_ONGOING: ["AWAITING_INVESTIGATION", "FOLLOW_UP_REQUIRED", "CLOSED"],
  FOLLOW_UP_REQUIRED: ["AWAITING_CONSULTATION", "AWAITING_INVESTIGATION", "TREATMENT_ONGOING", "CLOSED"],
  CLOSED: ["ARCHIVED", "FOLLOW_UP_REQUIRED"],
  ARCHIVED: [],
};

export function canTransitionCareCase(from: CareCaseStatus, to: CareCaseStatus): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function careCaseTransitionsFrom(status: CareCaseStatus): CareCaseStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

/** Appends a status event and updates the denormalised status, atomically. */
export async function transitionCareCase(
  caseId: string,
  to: CareCaseStatus,
  actorId: string,
  note?: string | null,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const careCase = await tx.careCase.findUnique({
      where: { id: caseId },
      select: { id: true, status: true, caseNumber: true, patientId: true },
    });
    if (!careCase) throw notFound("Case not found.");
    if (careCase.status === to) return;
    if (!canTransitionCareCase(careCase.status, to)) {
      throw badRequest(`Case ${careCase.caseNumber} cannot move from ${careCase.status} to ${to}.`);
    }
    await tx.careCase.update({
      where: { id: caseId },
      data: {
        status: to,
        closedAt: to === "CLOSED" || to === "ARCHIVED" ? new Date() : null,
      },
    });
    await tx.careCaseEvent.create({
      data: {
        caseId,
        status: to,
        note: note ?? null,
        actorId,
      },
    });
    await tx.auditLog.create({
      data: {
        userId: actorId,
        action: "care_case_transition",
        resourceType: "care_case",
        resourceId: caseId,
        details: {
          caseNumber: careCase.caseNumber,
          patientId: careCase.patientId,
          from: careCase.status,
          to,
        },
      },
    });
  });
}

/**
 * Derives a sensible case status from an existing record so the backfill does
 * not invent clinical judgement: a finalised consultation with a future
 * follow-up date is FOLLOW_UP_REQUIRED, otherwise CLOSED; anything unfinished
 * stays OPEN. This is a mechanical mapping from recorded facts only.
 */
export function derivedStatusForConsultation(
  status: "DRAFT" | "FINALIZED",
  finalizedAt: Date | null,
  followUpDate: Date | null,
): CareCaseStatus {
  if (status !== "FINALIZED" || !finalizedAt) return "OPEN";
  if (followUpDate && followUpDate.getTime() > Date.now()) return "FOLLOW_UP_REQUIRED";
  return "CLOSED";
}

export function derivedStatusForLabOrder(
  status: "ORDERED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED",
): CareCaseStatus {
  switch (status) {
    case "ORDERED":
      return "AWAITING_RESULT";
    case "IN_PROGRESS":
      return "AWAITING_RESULT";
    case "COMPLETED":
      return "RESULT_AVAILABLE";
    case "CANCELLED":
      return "CLOSED";
  }
}

export function derivedStatusForFacilityBooking(
  status: "REQUESTED" | "CONFIRMED" | "COMPLETED" | "CANCELLED",
): CareCaseStatus {
  switch (status) {
    case "REQUESTED":
    case "CONFIRMED":
      // The investigation has been requested/confirmed but not yet performed.
      return "AWAITING_INVESTIGATION";
    case "COMPLETED":
    case "CANCELLED":
      return "CLOSED";
  }
}

/** Case-type badge copy shared by patient and clinician views. */
export const CARE_CASE_TYPE_LABELS: Record<CareCaseType, string> = {
  CONSULTATION: "Consultation",
  LABORATORY: "Laboratory analysis",
  DIAGNOSTIC: "Diagnostic investigation",
  REPORT: "Clinical report",
  HOSPITAL: "Hospital admission",
};

export const CARE_CASE_STATUS_LABELS: Record<CareCaseStatus, string> = {
  OPEN: "Open",
  AWAITING_CONSULTATION: "Awaiting consultation",
  AWAITING_INVESTIGATION: "Awaiting investigation",
  AWAITING_RESULT: "Awaiting result",
  RESULT_AVAILABLE: "Result available",
  UNDER_REVIEW: "Under review",
  TREATMENT_ONGOING: "Treatment ongoing",
  FOLLOW_UP_REQUIRED: "Follow-up required",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
};

/** Server-side query builder for the patient case list (listCasesForPatient). */
export type CaseListFilters = {
  type?: CareCaseType[];
  status?: CareCaseStatus[];
  q?: string;
};

export function caseListWhere(patientId: string, filters: CaseListFilters): Prisma.CareCaseWhereInput {
  const where: Prisma.CareCaseWhereInput = { patientId };
  const and: Prisma.CareCaseWhereInput[] = [];
  if (filters.type?.length) where.type = { in: filters.type };
  if (filters.status?.length) where.status = { in: filters.status };
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      and.push({
        OR: [
          { caseNumber: { contains: q, mode: "insensitive" } },
          { presentingComplaint: { contains: q, mode: "insensitive" } },
          { diagnosisSummary: { contains: q, mode: "insensitive" } },
        ],
      });
    }
  }
  if (and.length) where.AND = and;
  return where;
}
