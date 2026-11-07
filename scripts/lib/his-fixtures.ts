import type { FacilityStaffRole, PrismaClient } from "@prisma/client";
import { acceptanceRoster } from "../../src/lib/his/acceptance-config.ts";
import { permissionsForRole } from "../../src/lib/facility-staff.ts";

export interface AcceptanceManifest {
  version: 1;
  runId: string;
  mode: "clerk-test" | "local-database-only";
  baseUrl: string;
  expiresAt: string;
  instanceId: string | null;
  databaseHost: string;
  databaseName: string;
  users: { hospital: "a" | "b"; role: string; email: string; clerkId: string; userId: string }[];
  facilities: { hospital: "a" | "b"; id: string; patientId: string; caseNumber: string; encounterIds: string[] }[];
  incomplete?: boolean;
  createdIdentities?: { id: string; email: string }[];
  rollbackFailures?: string[];
}

const roles: Record<string, FacilityStaffRole> = {
  owner: "OWNER", author: "DOCTOR", reviewer: "DEPARTMENT_HEAD", nurse: "NURSE", pharmacist: "PHARMACIST", lab: "LAB_SCIENTIST",
  radiologist: "RADIOLOGIST", records: "MEDICAL_RECORDS_OFFICER", insurance: "INSURANCE_OFFICER", receptionist: "RECEPTIONIST",
};

/**
 * Regulated clinical permissions (mirrors src/lib/organization/privileges.ts).
 * These require a separately authorized privilege backed by a verified,
 * current credential, so the acceptance fixtures grant synthetic ones —
 * clearly labelled and expiring with the run — for every regulated
 * permission the fixture role already holds by default. No fixture gains a
 * permission its role does not normally have.
 */
const REGULATED_PERMISSIONS = [
  "VERIFY_RESULTS", "RELEASE_RESULTS", "REVIEW_DOCUMENTS", "SIGN_DOCUMENTS", "APPROVE_DOCUMENTS",
  "ORDER_MEDICATIONS", "REVIEW_MEDICATIONS", "ADMINISTER_MEDICATIONS",
] as const;

/**
 * The acceptance "reviewer" is a department head with clinical approval
 * duties. Under the tenant-scoped workforce model, organisational leadership
 * is not a professional qualification: the department-head role itself no
 * longer carries document approval or template management. The fixtures
 * therefore set the reviewer up the way the model intends — an explicit
 * custom access level for the non-regulated template/document workflow
 * permissions, and separately authorized, expiring clinical privileges
 * backed by a synthetic verified credential for the regulated ones.
 */
const REVIEWER_OVERRIDES = {
  add: [
    "REGISTER_PATIENTS", "MANAGE_REFERRALS", "VIEW_PATIENT_DOCUMENTS", "AUTHOR_DOCUMENTS",
    "REVIEW_DOCUMENTS", "SIGN_DOCUMENTS", "APPROVE_DOCUMENTS", "VERIFY_RESULTS", "RELEASE_DOCUMENTS",
    "MANAGE_DOCUMENT_TEMPLATES", "MANAGE_ENCOUNTERS", "UPLOAD_MEDIA", "ORDER_MEDICATIONS",
  ],
  remove: [],
} as const;
const REVIEWER_PRIVILEGES = ["VERIFY_RESULTS", "REVIEW_DOCUMENTS", "SIGN_DOCUMENTS", "APPROVE_DOCUMENTS", "ORDER_MEDICATIONS"] as const;

/** This is deliberately separate from the production reference-data seed. */
export async function createAcceptanceFixtures(
  db: PrismaClient, manifest: AcceptanceManifest, identities: Map<string, string>,
) {
  // Fail closed if this is not a synthetic-only database. No patient contents
  // are read, exported, logged or changed by the check.
  if (await db.patient.count({ where: { caseNumber: { not: { startsWith: "QA-" } } } })) {
    throw new Error("Refusing a database containing non-acceptance patient records");
  }
  const roster = acceptanceRoster(manifest.runId);
  await db.$transaction(async (tx) => {
    for (const hospital of ["a", "b"] as const) {
      const users: AcceptanceManifest["users"] = [];
      for (const identity of roster.filter((r) => r.hospital === hospital)) {
        const clerkId = identities.get(identity.email);
        if (!clerkId) throw new Error("Missing test identity");
        const user = await tx.user.create({ data: {
          clerkId, email: identity.email, name: identity.name, role: identity.role === "owner" ? "LAB_SCIENTIST" : "PATIENT",
          accountType: identity.role === "owner" ? "HOSPITAL" : "PATIENT", status: "ACTIVE", onboardingComplete: true,
          // No real person's terms acceptance or clinical licence is fabricated.
          termsAcceptedAt: null, termsVersion: null, testAccountExpiresAt: new Date(manifest.expiresAt),
        } });
        users.push({ hospital, role: identity.role, email: identity.email, clerkId, userId: user.id });
      }
      const owner = users.find((u) => u.role === "owner")!;
      const facility = await tx.labStaffProfile.create({ data: {
        userId: owner.userId, laboratoryName: `SYNTHETIC ACCEPTANCE ${manifest.runId} ${hospital.toUpperCase()}`,
        kind: "HOSPITAL", departments: ["Emergency", "General medicine", "Laboratory", "Radiology", "Records"],
        verificationStatus: "VERIFIED", isPublished: false,
        about: "DISPOSABLE SYNTHETIC TEST FIXTURE. Not a real hospital; not for clinical use. Credentials and clinical privileges are synthetic fixtures, not practitioner licences.",
      } });
      const department = await tx.facilityDepartment.create({ data: { facilityId: facility.id, name: "General medicine", slug: "general-medicine", equipment: [] } });
      await tx.hospitalSettings.create({ data: { facilityId: facility.id, independentTemplateApproval: true } });
      for (const user of users.filter((u) => u.role !== "patient")) {
        const isReviewer = user.role === "reviewer";
        const staff = await tx.facilityStaff.create({ data: {
          facilityId: facility.id, userId: user.userId, email: user.email, fullName: `SYNTHETIC ${user.role}`,
          facilityRole: roles[user.role], status: "ACTIVE", departmentId: department.id,
          accessLevel: isReviewer ? "CUSTOM" : "STANDARD",
          permissionOverrides: isReviewer ? REVIEWER_OVERRIDES : undefined,
          professionalTitle: "Synthetic acceptance fixture; not a licensed practitioner", publicProfileVisible: false, profileConsent: false,
        } });
        // Regulated clinical permissions stay separately authorized: back each
        // one the staff member holds with a synthetic verified credential and
        // an expiring privilege, mirroring the production grant workflow.
        const regulated = isReviewer
          ? [...REVIEWER_PRIVILEGES]
          : permissionsForRole(roles[user.role]).filter((p) => (REGULATED_PERMISSIONS as readonly string[]).includes(p));
        if (regulated.length) {
          const credential = await tx.staffCredential.create({ data: {
            staffId: staff.id, type: "PROFESSIONAL_CERTIFICATION",
            number: `QA-${manifest.runId}-${hospital}-${user.role}`,
            authority: "SYNTHETIC ACCEPTANCE FIXTURE; not a real licensing authority",
            expiryDate: new Date(manifest.expiresAt), verificationStatus: "VERIFIED", renewalStatus: "CURRENT",
            verifiedAt: new Date(), restrictions: "Synthetic acceptance fixture credential; not a practitioner licence",
          } });
          for (const permission of regulated) {
            await tx.clinicalPrivilege.create({ data: {
              staffId: staff.id, credentialId: credential.id, permission, grantedById: owner.userId,
              reason: `Synthetic acceptance run ${manifest.runId}; not a real clinical authorization`,
              expiresAt: new Date(manifest.expiresAt),
            } });
          }
        }
      }
      const caseNumber = `QA-${manifest.runId.toUpperCase()}-${hospital.toUpperCase()}`;
      const patient = await tx.patient.create({ data: {
        userId: users.find((u) => u.role === "patient")!.userId, caseNumber,
        firstName: "Synthetic", lastName: `Acceptance ${hospital.toUpperCase()}`, dateOfBirth: new Date("1990-01-01T00:00:00Z"), gender: "OTHER",
      } });
      // Recorded allergies for the pharmacy safety checks (synthetic values).
      await tx.medicalHistory.create({ data: { patientId: patient.id, allergies: ["Penicillin"] } });
      const encounterIds: string[] = [];
      for (const [suffix, type, priority] of [["ED", "EMERGENCY_DEPARTMENT", "EMERGENCY"], ["OP", "SCHEDULED_OUTPATIENT", "ELECTIVE"]] as const) {
        const encounter = await tx.encounter.create({ data: {
          facilityId: facility.id, patientId: patient.id, encounterNumber: `QA-${manifest.runId}-${hospital}-${suffix}`,
          type, priority, status: suffix === "ED" ? "AWAITING_TRIAGE" : "REGISTERED", createdById: owner.userId, department: "General medicine",
        } });
        encounterIds.push(encounter.id);
      }
      manifest.users.push(...users);
      manifest.facilities.push({ hospital, id: facility.id, patientId: patient.id, caseNumber, encounterIds });
    }
  }, { timeout: 30_000 });
  return manifest;
}
