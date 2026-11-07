import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, notFound } from "@/lib/errors";
import { findPatientByIdentity, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { minutesSince, sortQueue } from "@/lib/his/encounters";
import { formatNumber, nextSequence } from "@/lib/his/numbering";

/**
 * Emergency Department module (clinical).
 *
 * Built on the central patient record and encounter: every emergency
 * activity links to a patient and an encounter. Unidentified patients get
 * a temporary record that is later reconciled via case number + DOB.
 */

const ARRIVAL_MODES = ["AMBULANCE", "WALK_IN", "REFERRAL", "TRANSFER"] as const;

const registerSchema = z.object({
  mode: z.enum(["EXISTING", "UNIDENTIFIED"]),
  // Existing-patient identification (exact match required).
  caseNumber: z.string().trim().min(6).max(30).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Unidentified temporary label, e.g. "John DOE #2" or "MOTORCYCLE M30".
  temporaryLabel: z.string().trim().min(2).max(80).optional(),
  arrivalMode: z.enum(ARRIVAL_MODES).default("WALK_IN"),
  referralSource: z.string().trim().max(160).optional(),
  presentingComplaint: z.string().trim().max(2000).optional(),
  knownAllergies: z.string().trim().max(1000).optional(),
  // JSON vitals captured at registration (temperature, pulse, bp, spo2...).
  initialObservations: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(["EMERGENCY", "URGENT", "SEMI_URGENT", "ROUTINE", "ELECTIVE"]).default("EMERGENCY"),
  clinicianName: z.string().trim().max(160).optional(),
});

// GET /api/facility/his/emergency — the live ED board + capacity snapshot.
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const facilityId = access.facility.id;

  const now = new Date();
  const rows = await prisma.encounter.findMany({
    where: {
      facilityId,
      isEmergency: true,
      status: { notIn: ["DISCHARGED", "TRANSFERRED", "CANCELLED", "DID_NOT_ATTEND"] },
    },
    include: {
      patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, unidentified: true, dateOfBirth: true } },
    },
    take: 300,
  });
  const queue = sortQueue(rows).map((e) => ({
    id: e.id,
    encounterNumber: e.encounterNumber,
    status: e.status,
    priority: e.priority,
    triageCategory: e.triageCategory,
    triagedAt: e.triagedAt,
    arrivalMode: e.arrivalMode,
    presentingComplaint: e.chiefComplaint,
    clinicianName: e.clinicianName,
    department: e.department,
    reassessmentDueAt: e.reassessmentDueAt,
    temporaryLabel: e.temporaryLabel,
    registeredAt: e.registeredAt,
    minutesWaiting: minutesSince(e.registeredAt, now),
    patient: e.patient,
  }));

  const critical = queue.filter((e) => e.priority === "EMERGENCY" || (e.triageCategory ?? "").toLowerCase().includes("resus"));
  const awaitingTriage = queue.filter((e) => e.status === "AWAITING_TRIAGE" || e.status === "REGISTERED");
  const overdueReassessment = queue.filter((e) => e.reassessmentDueAt && e.reassessmentDueAt < now);

  const [beds, ambulanceLastHour, admissionsPending] = await Promise.all([
    prisma.bed.groupBy({ by: ["status"], where: { facilityId }, _count: { _all: true } }),
    prisma.encounter.count({
      where: { facilityId, isEmergency: true, arrivalMode: "AMBULANCE", registeredAt: { gte: new Date(now.getTime() - 3_600_000) } },
    }),
    prisma.encounter.count({
      where: { facilityId, isEmergency: true, status: "AWAITING_ADMISSION" },
    }),
  ]);
  const bedCounts = Object.fromEntries(beds.map((b) => [b.status, b._count._all]));

  return NextResponse.json({
    queue,
    kpis: {
      active: queue.length,
      critical: critical.length,
      awaitingTriage: awaitingTriage.length,
      overdueReassessment: overdueReassessment.length,
      ambulanceLastHour,
      admissionsPending,
    },
    beds: {
      available: bedCounts.AVAILABLE ?? 0,
      occupied: bedCounts.OCCUPIED ?? 0,
      reserved: bedCounts.RESERVED ?? 0,
      cleaning: bedCounts.CLEANING ?? 0,
      maintenance: bedCounts.MAINTENANCE ?? 0,
      isolation: bedCounts.ISOLATION ?? 0,
    },
  });
});

// POST /api/facility/his/emergency — rapid ED registration.
// Existing patients are matched on case number + date of birth (exact).
// Unidentified patients get a temporary patient record, clearly flagged,
// later reconciled into their real record without duplication.
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, registerSchema);
  const facilityId = access.facility.id;

  let patientId: string;
  let temporary = false;

  if (body.mode === "EXISTING") {
    if (!body.caseNumber || !body.dateOfBirth) {
      throw badRequest("Case number and date of birth are required to register an existing patient");
    }
    const patient = await findPatientByIdentity(body.caseNumber, body.dateOfBirth);
    if (!patient) throw notFound("No patient matches that case number and date of birth");
    patientId = patient.id;
  } else {
    if (!body.temporaryLabel) throw badRequest("A temporary label is required for unidentified patients");
    temporary = true;
  }

  const encounter = await prisma.$transaction(async (tx) => {
    let pid = patientId;
    if (temporary) {
      const year = new Date().getUTCFullYear();
      const seq = await nextSequence(tx, facilityId, "ed-temp", year);
      const caseNumber = formatNumber("EDTEMP", year, seq);
      const patient = await tx.patient.create({
        data: {
          caseNumber,
          firstName: "Unidentified",
          lastName: (body.temporaryLabel ?? "Patient").slice(0, 60),
          gender: "OTHER",
          dateOfBirth: new Date(), // provisional; corrected on reconciliation
          unidentified: true,
        },
        select: { id: true },
      });
      pid = patient.id;
    }
    const year = new Date().getUTCFullYear();
    const seq = await nextSequence(tx, facilityId, "encounter", year);
    return tx.encounter.create({
      data: {
        facilityId,
        patientId: pid,
        encounterNumber: formatNumber("ENC", year, seq),
        type: "EMERGENCY_DEPARTMENT",
        priority: body.priority,
        status: "AWAITING_TRIAGE",
        isEmergency: true,
        arrivalMode: body.arrivalMode,
        referralSource: body.referralSource ?? null,
        chiefComplaint: body.presentingComplaint ?? null,
        knownAllergies: body.knownAllergies ?? null,
        initialObservations: (body.initialObservations as object) ?? undefined,
        temporaryLabel: temporary ? body.temporaryLabel : null,
        clinicianName: body.clinicianName ?? null,
        createdById: user.id,
        events: { create: { toStatus: "AWAITING_TRIAGE", priority: body.priority, actorId: user.id, note: `Emergency arrival (${body.arrivalMode})` } },
      },
      select: { id: true, encounterNumber: true, status: true, patientId: true },
    });
  });

  await auditHis(access, "ED_PATIENT_REGISTERED", "Encounter", encounter.id, req, {
    patientId: encounter.patientId,
    details: { mode: body.mode, arrivalMode: body.arrivalMode, temporaryLabel: body.temporaryLabel ?? null },
  });
  return NextResponse.json({ encounter }, { status: 201 });
});
