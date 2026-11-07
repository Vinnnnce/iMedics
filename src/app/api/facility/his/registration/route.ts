/**
 * Advanced patient registration & admission workspace API.
 *
 * GET  — admission dashboard: today's registrations, queue breakdown and
 *        recent registration activity for the facility.
 * POST — complete a registration: existing patient (exact case number + DOB),
 *        new patient (after duplicate review) or temporary emergency record;
 *        creates the encounter, optional admission, insurance coverage and
 *        consent acknowledgements in one audited transaction.
 *
 * Facility-scoped: all queries are filtered by the caller's facility id.
 * New-patient creation is blocked while unacknowledged possible duplicates
 * exist (HTTP 409 with the review list).
 */
import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { requireHisAccess, findPatientByIdentity } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { nextSequence, formatNumber } from "@/lib/his/numbering";
import {
  registrationSchema,
  admissionTypeConfig,
  findPotentialDuplicates,
  validateConsents,
  computeBmi,
  isMinor,
} from "@/lib/his/registration";
import { generateCaseNumber } from "@/lib/case-number";

/* ------------------------------------------------------------------ */
/* GET — registration dashboard                                        */
/* ------------------------------------------------------------------ */

export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const facilityId = access.facility.id;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const [
    todaysEncounters,
    activeAdmissions,
    drafts,
    recentRegistrations,
    pendingCoverage,
  ] = await Promise.all([
    prisma.encounter.findMany({
      where: { facilityId, registeredAt: { gte: start } },
      select: { patientId: true, status: true, type: true, priority: true, isEmergency: true, consents: true },
    }),
    prisma.admission.count({ where: { facilityId, status: "ACTIVE" } }),
    prisma.registrationDraft.findMany({
      where: { facilityId, status: "DRAFT" },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: { id: true, label: true, updatedAt: true, createdBy: { select: { name: true } } },
    }),
    prisma.encounter.findMany({
      where: { facilityId },
      orderBy: { registeredAt: "desc" },
      take: 15,
      select: {
        id: true, encounterNumber: true, type: true, priority: true, status: true, registeredAt: true,
        isEmergency: true, department: true, consents: true,
        patient: { select: { id: true, caseNumber: true, firstName: true, lastName: true, unidentified: true, createdAt: true } },
      },
    }),
    prisma.encounter.count({
      where: { facilityId, coverage: { eligibility: { in: ["NOT_VERIFIED", "PENDING"] } }, status: { in: ["REGISTERED", "AWAITING_TRIAGE"] } },
    }),
  ]);

  // New vs returning: patients created today vs earlier.
  const patientIds = [...new Set(todaysEncounters.map((e) => e.patientId))];
  const patients = patientIds.length
    ? await prisma.patient.findMany({
        where: { id: { in: patientIds } },
        select: { id: true, createdAt: true },
      })
    : [];
  const createdToday = new Set(patients.filter((p) => p.createdAt >= start).map((p) => p.id));

  const byStatus = new Map<string, number>();
  for (const e of todaysEncounters) byStatus.set(e.status, (byStatus.get(e.status) ?? 0) + 1);

  return NextResponse.json({
    today: {
      registrations: todaysEncounters.length,
      newPatients: [...createdToday].length,
      returningPatients: todaysEncounters.length - [...createdToday].length,
      emergency: todaysEncounters.filter((e) => e.isEmergency).length,
      byStatus: Object.fromEntries(byStatus),
    },
    activeAdmissions,
    pendingInsuranceVerification: pendingCoverage,
    awaitingTriage: byStatus.get("AWAITING_TRIAGE") ?? 0,
    drafts: drafts.map((d) => ({
      id: d.id,
      label: d.label,
      updatedAt: d.updatedAt,
      createdBy: d.createdBy?.name ?? "Unknown",
    })),
    recentRegistrations: recentRegistrations.map((e) => ({
      id: e.id,
      encounterNumber: e.encounterNumber,
      caseNumber: e.patient.caseNumber,
      patientName: e.patient.unidentified
        ? "Unidentified (temporary)"
        : `${e.patient.firstName} ${e.patient.lastName}`.trim(),
      type: e.type,
      priority: e.priority,
      status: e.status,
      department: e.department,
      isEmergency: e.isEmergency,
      registeredAt: e.registeredAt,
      consentsRecorded: Array.isArray(e.consents),
    })),
  });
});

/* ------------------------------------------------------------------ */
/* POST — complete a registration                                       */
/* ------------------------------------------------------------------ */

export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const body = await parseBody(req, registrationSchema);
  const facilityId = access.facility.id;

  // Consent policy check (emergency defers non-critical consents).
  const consentProblems = validateConsents(body.consents, { emergency: body.emergency || body.admissionType === "EMERGENCY_DEPARTMENT" });
  if (consentProblems.length && !body.emergency) {
    throw badRequest(consentProblems.join("; "));
  }

  // Existing patients: exact identity match only.
  if (body.patient.mode === "EXISTING") {
    const patient = await findPatientByIdentity(body.patient.caseNumber, body.patient.dateOfBirth);
    if (!patient) throw notFound("No patient matches that case number and date of birth");
    return completeRegistration(access, user, req, body, patient.id, false);
  }

  if (body.patient.mode === "TEMPORARY") {
    return completeRegistration(access, user, req, body, null, true);
  }

  // New patient: duplicate review gate.
  const data = body.patient.data;
  if (isMinor(data.dateOfBirth) && !data.guardian && !body.emergency) {
    throw badRequest("Guardian or authorised representative details are required for minors");
  }

  const acknowledged = body.patient.mode === "NEW" ? body.patient.acknowledgedDuplicateIds : [];
  const duplicates = await findPotentialDuplicates(prisma, facilityId, data);
  const blocking = duplicates.filter((d) => !acknowledged.includes(d.id));
  if (blocking.length > 0) {
    throw conflict("Possible duplicate patient records must be reviewed before creating a new patient");
  }
  return completeRegistration(access, user, req, body, null, false);
});

/* Shared completion path: patient (if new), encounter, admission, coverage. */
async function completeRegistration(
  access: import("@/lib/his/access").HisAccess,
  user: { id: string; name: string },
  req: Request,
  body: import("zod").infer<typeof registrationSchema>,
  existingPatientId: string | null,
  temporary: boolean,
) {
  const facilityId = access.facility.id;
  const config = admissionTypeConfig(body.admissionType);

  const result = await prisma.$transaction(async (tx) => {
    let patientId = existingPatientId;

    if (temporary) {
      const year = new Date().getUTCFullYear();
      const seq = await nextSequence(tx, facilityId, "reg-temp", year);
      const patient = await tx.patient.create({
        data: {
          caseNumber: formatNumber("REGTEMP", year, seq),
          firstName: "Unidentified",
          lastName: (body.patient.mode === "TEMPORARY" ? body.patient.temporaryLabel : "Patient").slice(0, 60),
          gender: "OTHER",
          dateOfBirth: new Date(), // provisional; corrected on reconciliation
          unidentified: true,
        },
        select: { id: true },
      });
      patientId = patient.id;
    } else if (body.patient.mode === "NEW") {
      const data = body.patient.data;
      const patient = await tx.patient.create({
        data: {
          caseNumber: await generateCaseNumber(),
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName ?? null,
          preferredName: data.preferredName ?? null,
          gender: data.gender,
          dateOfBirth: new Date(`${data.dateOfBirth}T00:00:00.000Z`),
          occupation: data.occupation ?? null,
          phone: data.phone ?? null,
          altPhone: data.altPhone ?? null,
          email: data.email ?? null,
          preferredContactMethod: data.preferredContactMethod ?? null,
          maritalStatus: data.maritalStatus ?? null,
          nationality: data.nationality ?? null,
          preferredLanguage: data.preferredLanguage ?? null,
          identityNumber: data.identityNumber ?? null,
          identityVerified: data.identityVerified,
          addressLine1: data.addressLine1 ?? null,
          addressLine2: data.addressLine2 ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          country: data.country ?? null,
          postalCode: data.postalCode ?? null,
          ecName: data.emergencyContacts[0]?.name ?? null,
          ecRelationship: data.emergencyContacts[0]?.relationship ?? null,
          ecPhone: data.emergencyContacts[0]?.phone ?? null,
          ecAddress: data.emergencyContacts[0]?.address ?? null,
          guardianName: data.guardian?.name ?? null,
          guardianRelationship: data.guardian?.relationship ?? null,
          guardianPhone: data.guardian?.phone ?? null,
          guardianAuthority: data.guardian?.authority ?? null,
        },
        select: { id: true, caseNumber: true },
      });
      patientId = patient.id;
    }
    if (!patientId) throw badRequest("Patient could not be resolved");

    // Admission for inpatient types (the one-to-one FK lives on encounters).
    const year = new Date().getUTCFullYear();
    let admissionId: string | null = null;
    let admissionNumber: string | null = null;
    if (config.inpatient) {
      const aseq = await nextSequence(tx, facilityId, "admission", year);
      const admission = await tx.admission.create({
        data: {
          patientId,
          facilityId,
          admissionDate: new Date(),
          reason: body.reasonForAdmission ?? null,
          workingDiagnosis: body.assessment?.provisionalDiagnosis ?? null,
          currentWardId: body.wardId ?? null,
          currentBedId: body.bedId ?? null,
          admittingDoctorId: body.admittingDoctorId ?? null,
          status: "ACTIVE",
        },
        select: { id: true },
      });
      admissionId = admission.id;
      admissionNumber = formatNumber("ADM", year, aseq);
    }

    // Coverage (insurance) policy record — created before the encounter because
    // encounter coverage linkage is immutable after creation (identity trigger).
    let coverageId: string | null = null;
    if (body.coverage) {
      const coverage = await tx.payerCoverage.create({
        data: {
          facilityId,
          patientId,
          category: body.coverage.category,
          providerName: body.coverage.providerName ?? null,
          planName: body.coverage.planName ?? null,
          memberNumber: body.coverage.memberNumber ?? null,
          coverageStart: body.coverage.coverageStart ? new Date(`${body.coverage.coverageStart}T00:00:00.000Z`) : null,
          coverageEnd: body.coverage.coverageEnd ? new Date(`${body.coverage.coverageEnd}T00:00:00.000Z`) : null,
          // Eligibility is never assumed: starts NOT_VERIFIED until the payer confirms.
          eligibility: "NOT_VERIFIED",
          authorizationNumber: body.coverage.authorizationNumber ?? null,
          preauthRequired: body.coverage.preauthRequired ?? false,
          copayKobo: body.coverage.copayKobo ?? null,
          outOfPocketKobo: body.coverage.outOfPocketKobo ?? null,
          benefitNotes: body.coverage.benefitNotes ?? null,
          createdById: user.id,
        },
        select: { id: true },
      });
      coverageId = coverage.id;
    }

    // Encounter + vitals + consents.
    const seq = await nextSequence(tx, facilityId, "encounter", year);
    const vitals = body.assessment?.vitals;
    const observations = body.assessment
      ? {
          vitals: vitals
            ? {
                ...vitals,
                bmi: computeBmi(vitals),
                recordedAt: new Date().toISOString(),
                recordedBy: (user.name ?? "").trim() || "Registration desk",
              }
            : undefined,
          presentingComplaint: body.assessment.presentingComplaint,
          historyOfComplaint: body.assessment.historyOfComplaint,
          provisionalDiagnosis: body.assessment.provisionalDiagnosis,
          examinationFindings: body.assessment.examinationFindings,
        }
      : undefined;

    const encounter = await tx.encounter.create({
      data: {
        facilityId,
        patientId,
        encounterNumber: formatNumber("ENC", year, seq),
        type: config.encounterType,
        priority: body.emergency ? "EMERGENCY" : "ROUTINE",
        status: body.emergency ? "AWAITING_TRIAGE" : "REGISTERED",
        isEmergency: body.emergency || body.admissionType === "EMERGENCY_DEPARTMENT",
        department: body.department ?? null,
        clinicianName: body.clinicianName ?? null,
        chiefComplaint: body.assessment?.presentingComplaint ?? body.reasonForAdmission ?? null,
        knownAllergies: body.knownAllergies ?? null,
        arrivalMode: body.arrivalMode ?? null,
        referralSource: body.referralSource ?? null,
        initialObservations: observations ?? undefined,
        admissionId: admissionId ?? undefined,
        coverageId: coverageId ?? undefined,
        // Payer category snapshot — the DB enforces it matches the linked coverage.
        payerCategory: body.coverage?.category,
        consents: body.consents.length
          ? body.consents.map((c) => ({
              ...c,
              capturedByName: c.capturedByName ?? ((user.name ?? "").trim() || "Registration desk"),
              capturedAt: c.capturedAt ?? new Date().toISOString(),
            }))
          : undefined,
        createdById: user.id,
        events: {
          create: {
            toStatus: body.emergency ? "AWAITING_TRIAGE" : "REGISTERED",
            priority: body.emergency ? "EMERGENCY" : "ROUTINE",
            actorId: user.id,
            note: `Registration (${body.admissionType.replace(/_/g, " ").toLowerCase()})`,
          },
        },
      },
      select: { id: true, encounterNumber: true, status: true, patientId: true },
    });

    // Draft lifecycle: mark completed, link produced records.
    if (body.draftId) {
      await tx.registrationDraft.update({
        where: { id: body.draftId, facilityId, status: "DRAFT" },
        data: { status: "COMPLETED", patientId, encounterId: encounter.id },
      }).catch(() => undefined);
    }

    return { encounter, admissionId, admissionNumber, coverageId, patientId };
  });

  await auditHis(access, "REGISTRATION_COMPLETED", "Encounter", result.encounter.id, req, {
    patientId: result.patientId,
    details: {
      admissionType: body.admissionType,
      patientMode: body.patient.mode,
      temporary,
      coverage: body.coverage ? { category: body.coverage.category, provider: body.coverage.providerName ?? null } : null,
      consents: body.consents.map((c) => ({ key: c.key, status: c.status, version: c.version })),
      admissionId: result.admissionId,
      draftId: body.draftId ?? null,
    },
  });

  return NextResponse.json(
    {
      encounter: result.encounter,
      admissionId: result.admissionId,
      admissionNumber: result.admissionNumber,
      coverageId: result.coverageId,
      message: `Registration complete — encounter ${result.encounter.encounterNumber}`,
    },
    { status: 201 },
  );
}
