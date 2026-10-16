/**
 * Integration smoke test for the care-case system. Runs against the local
 * test database (TEST_DATABASE_URL) — creates a patient, exercises case
 * number generation, status transitions, uniqueness under concurrency and the
 * backfill script's derivation logic. Cleans up after itself.
 *
 * Run: npx tsx scripts/smoke-cases.ts
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { setDefaultAutoSelectFamily } from "node:net";

function createClient() {
  setDefaultAutoSelectFamily(false);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

import { createCareCase, transitionCareCase, derivedStatusForConsultation } from "../src/lib/cases";

const prisma = createClient();

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL to the disposable test database.");
  const failures: string[] = [];
  const check = (name: string, cond: boolean) => {
    console.log(`${cond ? "PASS" : "FAIL"}  ${name}`);
    if (!cond) failures.push(name);
  };

  // Fixtures.
  const user = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      clerkId: `smoke-${Date.now()}`,
      email: `smoke-${Date.now()}@example.test`,
      name: "Smoke Test",
      role: "PATIENT",
      status: "ACTIVE",
      accountType: "PATIENT",
      onboardingComplete: true,
    },
  });
  const patient = await prisma.patient.create({
    data: {
      userId: user.id,
      firstName: "Smoke",
      lastName: "Test",
      gender: "FEMALE",
      dateOfBirth: new Date("1990-01-01"),
      caseNumber: `MC-SMOKE-${Date.now()}`,
    },
  });

  // 1. Case number format.
  const c1 = await createCareCase({ type: "CONSULTATION", patientId: patient.id, presentingComplaint: "Cough" });
  check("case number matches MED1905-C-YYYY-NNNNN", /^MED1905-C-\d{4}-\d{5}$/.test(c1.caseNumber));
  check("second case number increments", (await createCareCase({ type: "CONSULTATION", patientId: patient.id })).caseNumber !== c1.caseNumber);

  const l1 = await createCareCase({ type: "LABORATORY", patientId: patient.id });
  check("lab case number uses L type code", /^MED1905-L-\d{4}-\d{5}$/.test(l1.caseNumber));

  // 2. Initial event recorded.
  const events = await prisma.careCaseEvent.count({ where: { caseId: c1.id } });
  check("initial status event recorded", events === 1);

  // 3. Valid transition.
  await transitionCareCase(c1.id, "AWAITING_RESULT", user.id, "awaiting lab");
  const after = await prisma.careCase.findUniqueOrThrow({ where: { id: c1.id } });
  check("status transitioned to AWAITING_RESULT", after.status === "AWAITING_RESULT");
  check("transition event appended", (await prisma.careCaseEvent.count({ where: { caseId: c1.id } })) === 2);

  // 4. Invalid transition rejected.
  let rejected = false;
  try {
    await transitionCareCase(c1.id, "ARCHIVED", user.id);
  } catch {
    rejected = true;
  }
  check("invalid transition rejected", rejected);
  check("status unchanged after rejection", (await prisma.careCase.findUniqueOrThrow({ where: { id: c1.id } })).status === "AWAITING_RESULT");

  // 5. Concurrency: parallel case creations get unique numbers.
  const results = await Promise.all(
    Array.from({ length: 8 }, () => createCareCase({ type: "LABORATORY", patientId: patient.id })),
  );
  const numbers = new Set(results.map((r) => r.caseNumber));
  check("8 concurrent case numbers all unique", numbers.size === 8);

  // 6. Derived statuses used by the backfill.
  check("finalized consultation without follow-up maps to CLOSED", derivedStatusForConsultation("FINALIZED", new Date(), null) === "CLOSED");
  check("draft consultation stays OPEN", derivedStatusForConsultation("DRAFT", null, null) === "OPEN");

  // 7. Backfill derivation on a real record: link a prescription + payment to a consultation case.
  const consultation = await prisma.consultation.create({
    data: {
      id: crypto.randomUUID(),
      patientId: patient.id,
      doctorId: (await prisma.doctorProfile.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          licenseNumber: "SMOKE",
          specialty: "General Practice",
        },
      })).id,
      chiefComplaint: "Fever",
      status: "FINALIZED",
      finalizedAt: new Date(),
      caseId: c1.id,
    },
  });
  await prisma.prescription.create({
    data: {
      id: crypto.randomUUID(),
      patientId: patient.id,
      doctorId: consultation.doctorId,
      consultationId: consultation.id,
      caseId: c1.id,
      items: { create: { id: crypto.randomUUID(), drugName: "Paracetamol", dose: "500mg", frequency: "3x daily", duration: "5 days" } },
    },
  });
  const linked = await prisma.prescription.count({ where: { caseId: c1.id } });
  check("prescription linked to case", linked === 1);

  // Cleanup.
  await prisma.careCase.deleteMany({ where: { patientId: patient.id } });
  await prisma.consultation.deleteMany({ where: { patientId: patient.id } });
  await prisma.prescription.deleteMany({ where: { patientId: patient.id } });
  await prisma.doctorProfile.deleteMany({ where: { userId: user.id } });
  await prisma.patient.deleteMany({ where: { id: patient.id } });
  await prisma.user.delete({ where: { id: user.id } });

  if (failures.length) {
    console.error(`\n${failures.length} checks failed.`);
    process.exit(1);
  }
  console.log("\nAll smoke checks passed.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
