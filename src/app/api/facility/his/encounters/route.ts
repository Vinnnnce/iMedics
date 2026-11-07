import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { findPatientByIdentity, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { BOARDS, boardFilter, initialStatus, isOverdue, minutesSince, sortQueue } from "@/lib/his/encounters";
import { formatNumber, nextSequence } from "@/lib/his/numbering";

const TYPES = ["EMERGENCY_DEPARTMENT", "UNSCHEDULED_OUTPATIENT", "SCHEDULED_OUTPATIENT", "PLANNED_INPATIENT", "EMERGENCY_INPATIENT", "DAY_SURGERY", "PLANNED_PROCEDURE", "EMERGENCY_PROCEDURE", "OBSERVATION", "TRANSFER_IN", "FOLLOW_UP", "OTHER"] as const;
const PRIORITIES = ["EMERGENCY", "URGENT", "SEMI_URGENT", "ROUTINE", "ELECTIVE"] as const;
const PAYERS = ["PUBLIC_INSURANCE", "PRIVATE_INSURANCE", "EMPLOYER_SPONSORED", "GOVERNMENT_SUBSIDIZED", "INTERNATIONAL_INSURANCE", "TRAVEL_INSURANCE", "SELF_PAY", "UNINSURED", "CHARITY", "OTHER"] as const;

const listSchema = z.object({
  board: z.enum(BOARDS).default("all"),
  department: z.string().max(120).optional(),
  clinician: z.string().max(160).optional(),
  triageCategory: z.string().max(60).optional(),
  payer: z.enum(PAYERS).optional(),
  status: z.string().max(40).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  patientId: z.string().uuid().optional(),
});

const createSchema = z.object({
  caseNumber: z.string().trim().min(6).max(30),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(TYPES),
  priority: z.enum(PRIORITIES).default("ROUTINE"),
  department: z.string().trim().max(120).optional(),
  clinicianName: z.string().trim().max(160).optional(),
  chiefComplaint: z.string().trim().max(2000).optional(),
});

// GET /api/facility/his/encounters — live operational queues (priority-sorted).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const q = parseQuery(req, listSchema);
  const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { overdueMinutes: true } });
  const rows = await prisma.encounter.findMany({
    where: {
      facilityId: access.facility.id,
      ...boardFilter(q.board),
      ...(q.department ? { department: { contains: q.department, mode: "insensitive" as const } } : {}),
      ...(q.clinician ? { clinicianName: { contains: q.clinician, mode: "insensitive" as const } } : {}),
      ...(q.triageCategory ? { triageCategory: q.triageCategory } : {}),
      ...(q.payer ? { payerCategory: q.payer } : {}),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.from || q.to ? { registeredAt: { ...(q.from ? { gte: new Date(q.from) } : {}), ...(q.to ? { lte: new Date(`${q.to}T23:59:59Z`) } : {}) } } : {}),
    },
    take: 300,
    orderBy: { registeredAt: "asc" },
    include: { patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true } }, coverage: { select: { eligibility: true } } },
  });
  const threshold = settings?.overdueMinutes ?? 60;
  const now = new Date();
  const encounters = sortQueue(rows).map((e) => ({
    ...e,
    minutesSinceRegistration: minutesSince(e.registeredAt, now),
    minutesSinceUpdate: minutesSince(e.statusChangedAt, now),
    overdue: isOverdue(e.statusChangedAt, e.status, threshold, now),
  }));
  return NextResponse.json({ encounters, overdueMinutes: threshold });
});

// POST /api/facility/his/encounters — register a patient visit after exact identity verification.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, createSchema);
  const patient = await findPatientByIdentity(body.caseNumber, body.dateOfBirth);
  if (!patient) throw notFound("No patient matches that case number and date of birth");
  const facilityId = access.facility.id;
  const coverage = await prisma.payerCoverage.findFirst({ where: { facilityId, patientId: patient.id, active: true }, orderBy: { rank: "asc" }, select: { id: true, category: true } });
  const status = initialStatus(body.type);
  const encounter = await prisma.$transaction(async (tx) => {
    const year = new Date().getUTCFullYear();
    const seq = await nextSequence(tx, facilityId, "encounter", year);
    return tx.encounter.create({
      data: {
        facilityId, patientId: patient.id, encounterNumber: formatNumber("ENC", year, seq), type: body.type, priority: body.priority, status,
        department: body.department ?? null, clinicianName: body.clinicianName ?? null, chiefComplaint: body.chiefComplaint ?? null,
        coverageId: coverage?.id ?? null, payerCategory: coverage?.category ?? null, createdById: user.id,
        events: { create: { toStatus: status, priority: body.priority, actorId: user.id, note: "Registered" } },
      },
      select: { id: true, encounterNumber: true, status: true },
    });
  });
  await auditHis(access, "HIS_ENCOUNTER_REGISTERED", "Encounter", encounter.id, req, { patientId: patient.id });
  return NextResponse.json({ encounter }, { status: 201 });
});
