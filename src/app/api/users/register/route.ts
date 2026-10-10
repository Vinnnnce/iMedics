import { NextResponse } from "next/server";
import { z } from "zod";
import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { generateCaseNumber } from "@/lib/case-number";

const TERMS_VERSION = "2026-10";

const text = z.string().trim().max(500).optional();

const registerSchema = z.object({
  accountType: z.enum(["patient", "doctor", "laboratory", "diagnostic_centre", "hospital"]),
  termsAccepted: z.literal(true, { error: "You must accept the terms to continue" }),

  // Identity (all account types)
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  middleName: text,
  phone: text,
  gender: z.enum(["male", "female", "other"]),
  dateOfBirth: z.string().refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date of birth"),

  // Patient
  address: text,
  city: text,
  state: text,
  occupation: text,
  bloodGroup: text,
  genotype: text,
  allergies: text, // comma / newline separated
  chronicConditions: text, // comma / newline separated
  emergencyContactName: text,
  emergencyContactRelationship: text,
  emergencyContactPhone: text,

  // Doctor
  mdcnRegistrationNumber: text,
  mdcnLicenseNumber: text,
  yearOfRegistration: text,
  yearsOfExperience: text,
  specialty: text,
  affiliation: text,
  biography: text,

  // Laboratory / diagnostic centre / hospital
  organisationName: text,
  organisationType: text,
  cacRegistrationNumber: text,
  facilityLicenseNumber: text,
});

const ACCOUNT_TYPES: Record<z.infer<typeof registerSchema>["accountType"], AccountType> = {
  patient: "PATIENT",
  doctor: "DOCTOR",
  laboratory: "LABORATORY",
  diagnostic_centre: "DIAGNOSTIC_CENTRE",
  hospital: "HOSPITAL",
};

const toInt = (value?: string) => {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(n) ? n : null;
};

const toList = (value?: string) =>
  (value ?? "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * POST /api/users/register — complete registration after sign-up.
 *
 * Security rules:
 *  - The caller's role is NEVER taken from the request or from client-writable
 *    metadata. Everyone registers as PATIENT; doctors and lab staff stay
 *    PENDING until an admin verifies them and grants the role.
 *  - Identity (email) comes from the authenticated account, not the body.
 *  - Registration can be completed only once.
 */
export const POST = withAuth(null, async (req, { user }) => {
  const data = await parseBody(req, registerSchema);

  if (user.onboardingComplete) throw conflict("Registration has already been completed");

  const accountType = ACCOUNT_TYPES[data.accountType];
  const isPatient = accountType === "PATIENT";
  const gender = data.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER";
  const name = [data.firstName, data.lastName].join(" ");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        name,
        phone: data.phone,
        accountType,
        status: isPatient ? "ACTIVE" : "PENDING",
        onboardingComplete: true,
        termsAcceptedAt: new Date(),
        termsVersion: TERMS_VERSION,
      },
    });

    if (isPatient) {
      const allergies = toList(data.allergies).map((allergen) => ({ type: "unspecified", allergen }));
      const pastHistory = toList(data.chronicConditions).map((diagnosis) => ({ diagnosis }));

      await tx.patient.create({
        data: {
          caseNumber: generateCaseNumber(),
          userId: user.id,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName,
          gender,
          dateOfBirth: new Date(data.dateOfBirth),
          occupation: data.occupation,
          addressLine1: data.address,
          city: data.city,
          state: data.state,
          bloodGroup: data.bloodGroup,
          genotype: data.genotype,
          ecName: data.emergencyContactName,
          ecRelationship: data.emergencyContactRelationship,
          ecPhone: data.emergencyContactPhone,
          ...(allergies.length || pastHistory.length
            ? { medicalHistories: { create: { allergies, pastHistory } } }
            : {}),
        },
      });
    } else if (accountType === "DOCTOR") {
      await tx.doctorProfile.create({
        data: {
          userId: user.id,
          gender,
          licenseNumber: data.mdcnLicenseNumber,
          mdcnRegistrationNumber: data.mdcnRegistrationNumber,
          yearOfRegistration: toInt(data.yearOfRegistration),
          yearsOfExperience: toInt(data.yearsOfExperience),
          specialty: data.specialty,
          affiliation: data.affiliation,
          biography: data.biography,
        },
      });
    } else {
      await tx.labStaffProfile.create({
        data: {
          userId: user.id,
          laboratoryName: data.organisationName,
          position: data.organisationType,
          licenseIdNumber: data.facilityLicenseNumber,
          cacRegistrationNumber: data.cacRegistrationNumber,
          facilityLicenseNumber: data.facilityLicenseNumber,
        },
      });
    }
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "REGISTRATION_SUBMITTED",
    resourceType: "User",
    resourceId: user.id,
    details: { accountType, requiresVerification: !isPatient },
    req,
  });

  return NextResponse.json(
    { success: true, role: user.role, status: isPatient ? "ACTIVE" : "PENDING", requiresVerification: !isPatient },
    { status: 201 },
  );
});
