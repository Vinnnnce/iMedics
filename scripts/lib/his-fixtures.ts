import type { FacilityStaffRole, PrismaClient } from "@prisma/client";
import { acceptanceRoster } from "../../src/lib/his/acceptance-config.ts";

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
  owner: "OWNER", author: "DOCTOR", reviewer: "DEPARTMENT_HEAD", nurse: "NURSE", lab: "LAB_SCIENTIST",
  radiologist: "RADIOLOGIST", records: "MEDICAL_RECORDS_OFFICER", insurance: "INSURANCE_OFFICER", receptionist: "RECEPTIONIST",
};

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
        about: "DISPOSABLE SYNTHETIC TEST FIXTURE. Not a real hospital; not for clinical use. No practitioner credentials asserted.",
      } });
      const department = await tx.facilityDepartment.create({ data: { facilityId: facility.id, name: "General medicine", slug: "general-medicine", equipment: [] } });
      await tx.hospitalSettings.create({ data: { facilityId: facility.id, independentTemplateApproval: true } });
      for (const user of users.filter((u) => u.role !== "patient")) {
        await tx.facilityStaff.create({ data: {
          facilityId: facility.id, userId: user.userId, email: user.email, fullName: `SYNTHETIC ${user.role}`,
          facilityRole: roles[user.role], status: "ACTIVE", departmentId: department.id,
          professionalTitle: "Synthetic acceptance fixture; not a licensed practitioner", publicProfileVisible: false, profileConsent: false,
        } });
      }
      const caseNumber = `QA-${manifest.runId.toUpperCase()}-${hospital.toUpperCase()}`;
      const patient = await tx.patient.create({ data: {
        userId: users.find((u) => u.role === "patient")!.userId, caseNumber,
        firstName: "Synthetic", lastName: `Acceptance ${hospital.toUpperCase()}`, dateOfBirth: new Date("1990-01-01T00:00:00Z"), gender: "OTHER",
      } });
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
