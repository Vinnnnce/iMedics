import { NextResponse } from "next/server";
import { z } from "zod";
import type { AccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, conflict } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { generateCaseNumber } from "@/lib/case-number";
import { POLICY_RELEASE, policyCanBeAccepted } from "@/lib/legal/release";
import { recordPolicyReceipt } from "@/lib/legal/record";
import { notifyAdminsOfApplication } from "@/lib/admin/notify";
import {
  isFinalProfileImageKey,
  publicProfileImageUrl,
  verifyFinalProfileImage,
} from "@/lib/profile-images";

const TERMS_VERSION = POLICY_RELEASE.version;

const text = z.string().trim().max(500).optional();

const registerSchema = z.object({
  accountType: z.enum([
    "patient",
    "doctor",
    "laboratory",
    "diagnostic_centre",
    "hospital",
    "pharmacy",
  ]),
  termsAccepted: z.literal(true, {
    error: "You must accept the terms to continue",
  }),
  privacyAccepted: z.literal(true, { error: "Review the privacy information before continuing" }),
  policyVersion: z.literal(POLICY_RELEASE.version, { error: "Policies changed. Review the current version and try again." }),
  country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a two-letter country code").default("NG"),
  language: z.enum(["en", "ha", "ig", "yo"]).default("en"),

  // Identity (all account types)
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  middleName: text,
  phone: text,
  gender: z.enum(["male", "female", "other"]),
  dateOfBirth: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date of birth"),

  // Patient
  address: text,
  city: text,
  state: text,
  occupation: text,

  // Doctor
  mdcnRegistrationNumber: text,
  mdcnLicenseNumber: text,
  yearOfRegistration: text,
  yearsOfExperience: text,
  specialty: text,
  affiliation: text,
  biography: text,

  // Laboratory / diagnostic centre / hospital / pharmacy
  organisationName: text,
  organisationType: text,
  cacRegistrationNumber: text,
  facilityLicenseNumber: text,

  // Profile photo (doctors) / organisation logo (laboratory, diagnostic centre,
  // hospital). A final-prefix storage key uploaded and verified during sign-up.
  // Nullish-tolerant: the wizard sends `null` when no image was picked.
  profileImageKey: z.string().trim().min(1).max(300).nullish(),
});

const ACCOUNT_TYPES: Record<
  z.infer<typeof registerSchema>["accountType"],
  AccountType
> = {
  patient: "PATIENT",
  doctor: "DOCTOR",
  laboratory: "LABORATORY",
  diagnostic_centre: "DIAGNOSTIC_CENTRE",
  hospital: "HOSPITAL",
  pharmacy: "PHARMACY",
};

const toInt = (value?: string) => {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isInteger(n) ? n : null;
};

/**
 * POST /api/users/register — complete registration after sign-up.
 *
 * Security rules:
 *  - The caller's role is NEVER taken from the request or from client-writable
 *    metadata. Everyone registers as PATIENT; doctors and lab staff stay
 *    PENDING until an admin verifies them and grants the role.
 *  - Identity (email) comes from the authenticated account, not the body.
 *  - Registration can be completed only once.
 *  - Explicitly usable before the account is ready: this endpoint exists to
 *    take an account from "incomplete" to "complete" (or "pending review").
 */
export const POST = withAuth(
  null,
  async (req, { user }) => {
    const data = await parseBody(req, registerSchema);

    if (user.onboardingComplete)
      throw conflict("Registration has already been completed");

    const accountType = ACCOUNT_TYPES[data.accountType];
    const isPatient = accountType === "PATIENT";
    const gender = data.gender.toUpperCase() as "MALE" | "FEMALE" | "OTHER";
    const name = [data.firstName, data.lastName].join(" ");

    // Doctors must upload a profile photo; organisations must upload a logo.
    // Patients may attach one optionally (it then becomes their avatar).
    const profileImageKey = data.profileImageKey ?? undefined;
    const requiresProfileImage = !isPatient;
    if (requiresProfileImage && !profileImageKey) {
      throw badRequest(
        accountType === "DOCTOR"
          ? "A profile photo is required to complete your registration"
          : "An organisation logo is required to complete your registration",
      );
    }
    if (
      profileImageKey &&
      !isFinalProfileImageKey(profileImageKey, user.id)
    ) {
      throw badRequest("Invalid profile image");
    }
    if (profileImageKey) {
      // Re-verify the stored object before attaching it to the account.
      await verifyFinalProfileImage(profileImageKey);
    }
    const profileImageUrl = profileImageKey
      ? publicProfileImageUrl(profileImageKey)
      : null;

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: {
          name,
          phone: data.phone,
          country: data.country,
          language: data.language,
          accountType,
          status: isPatient ? "ACTIVE" : "PENDING",
          onboardingComplete: true,
          ...(policyCanBeAccepted() ? { termsAcceptedAt: new Date(), termsVersion: TERMS_VERSION } : {}),
          ...(profileImageUrl ? { avatarUrl: profileImageUrl } : {}),
        },
      });

      if (isPatient) {
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
            country: data.country,
            city: data.city,
            state: data.state,
          },
        });
      } else if (accountType === "DOCTOR") {
        await tx.doctorProfile.create({
          data: {
            userId: user.id,
            middleName: data.middleName || null,
            dateOfBirth: new Date(data.dateOfBirth),
            gender,
            location:
              [data.address, data.city, data.state, data.country]
                .filter(Boolean)
                .join(", ") || null,
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
            country: data.country,
            position: data.organisationType,
            licenseIdNumber: data.facilityLicenseNumber,
            addressLine: data.address || null,
            city: data.city || null,
            state: data.state || null,
            cacRegistrationNumber: data.cacRegistrationNumber,
            facilityLicenseNumber: data.facilityLicenseNumber,
            ...(profileImageUrl ? { logoUrl: profileImageUrl } : {}),
            // Denormalized organization type for module access scoping.
            ...(accountType === "HOSPITAL"
              ? { kind: "HOSPITAL" }
              : accountType === "DIAGNOSTIC_CENTRE"
                ? { kind: "DIAGNOSTIC_CENTRE" }
                : accountType === "PHARMACY"
                  ? { kind: "PHARMACY" }
                  : { kind: "LABORATORY" }),
          },
        });
      }
      await recordPolicyReceipt(tx, user.id, accountType);
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

    // Professionals wait for an admin: let the admins know there is something to review.
    if (!isPatient) await notifyAdminsOfApplication(user.id, false);

    return NextResponse.json(
      {
        success: true,
        role: user.role,
        status: isPatient ? "ACTIVE" : "PENDING",
        requiresVerification: !isPatient,
      },
      { status: 201 },
    );
  },
  { allowOnboarding: true },
);
