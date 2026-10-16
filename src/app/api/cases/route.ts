import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { patientScope } from "@/lib/access";
import {
  CARE_CASE_STATUS_LABELS,
  CARE_CASE_TYPE_LABELS,
  caseListWhere,
  type CaseListFilters,
} from "@/lib/cases";

const listSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

function csvFilters<T extends string>(value: string | undefined, allowed: readonly T[]): T[] | undefined {
  if (!value) return undefined;
  const requested = value
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
  return requested.length ? requested : undefined;
}

const TYPES = ["CONSULTATION", "LABORATORY", "DIAGNOSTIC", "REPORT", "HOSPITAL"] as const;
const STATUSES = [
  "OPEN",
  "AWAITING_CONSULTATION",
  "AWAITING_INVESTIGATION",
  "AWAITING_RESULT",
  "RESULT_AVAILABLE",
  "UNDER_REVIEW",
  "TREATMENT_ONGOING",
  "FOLLOW_UP_REQUIRED",
  "CLOSED",
  "ARCHIVED",
] as const;

// GET /api/cases — the unified case list.
//  - patients: their own cases
//  - doctors: cases for patients in their care
//  - admins: all cases
// A case number never grants access; every query is scoped to the caller.
export const GET = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req, { user }) => {
  const { type, status, q, limit } = parseQuery(req, listSchema);
  const filters: CaseListFilters = {
    type: csvFilters(type, TYPES),
    status: csvFilters(status, STATUSES),
    q,
  };

  let where: Prisma.CareCaseWhereInput;
  const filtersWhere = caseListWhere("", filters);
  // caseListWhere always sets patientId — drop it and apply caller scoping instead.
  delete (filtersWhere as { patientId?: string }).patientId;
  const hasFilters = Object.keys(filtersWhere).length > 0;

  if (user.role === "PATIENT") {
    const patient = await prisma.patient.findFirst({
      where: { userId: user.id, deletedAt: null },
      select: { id: true },
    });
    where = patient
      ? { AND: [{ patientId: patient.id }, ...(hasFilters ? [filtersWhere] : [])] }
      : { id: "none" };
  } else if (user.role === "DOCTOR") {
    const scope = await patientScope(user);
    where = { AND: [{ patient: scope.where }, ...(hasFilters ? [filtersWhere] : [])] };
  } else {
    where = filtersWhere;
  }

  const cases = await prisma.careCase.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      caseNumber: true,
      type: true,
      status: true,
      specialty: true,
      presentingComplaint: true,
      diagnosisSummary: true,
      followUpDate: true,
      closedAt: true,
      createdAt: true,
      updatedAt: true,
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
      primaryDoctor: { select: { specialty: true, user: { select: { name: true } } } },
      _count: { select: { consultations: true, labOrders: true, prescriptions: true, payments: true, facilityBookings: true, events: true } },
    },
  });

  return NextResponse.json({
    cases: cases.map((c) => ({
      id: c.id,
      caseNumber: c.caseNumber,
      type: c.type,
      typeLabel: CARE_CASE_TYPE_LABELS[c.type],
      status: c.status,
      statusLabel: CARE_CASE_STATUS_LABELS[c.status],
      specialty: c.specialty,
      presentingComplaint: c.presentingComplaint,
      diagnosisSummary: c.diagnosisSummary,
      followUpDate: c.followUpDate,
      closedAt: c.closedAt,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      patient: c.patient
        ? { id: c.patient.id, name: `${c.patient.firstName} ${c.patient.lastName}`, recordNumber: c.patient.caseNumber }
        : null,
      primaryDoctor: c.primaryDoctor
        ? { name: c.primaryDoctor.user.name, specialty: c.primaryDoctor.specialty }
        : null,
      linkedCounts: {
        consultations: c._count.consultations,
        labOrders: c._count.labOrders,
        prescriptions: c._count.prescriptions,
        payments: c._count.payments,
        facilityBookings: c._count.facilityBookings,
      },
    })),
  });
});
