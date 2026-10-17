/**
 * Backfill: create unified care-episode cases (CareCase) for EXISTING records.
 *
 * The migration 20261016123650_patient_portal_cases adds the schema; new
 * records get cases automatically at creation time (consultations, lab orders,
 * facility bookings). This script associates pre-existing records WITHOUT
 * inventing relationships:
 *
 *  - One CONSULTATION case per existing consultation. Prescriptions written on
 *    that consultation and payments for its appointment link to the same case
 *    (both relationships are recorded in the data).
 *  - One LABORATORY case per existing lab order (an order is a distinct
 *    clinical episode).
 *  - One DIAGNOSTIC case per existing facility booking, linking its payment
 *    where the relationship is recorded.
 *
 * Records are only ever linked through foreign keys that already exist in the
 * data — nothing is inferred from dates, patient overlap or guesswork. The
 * script is idempotent: re-running it skips anything already associated.
 *
 * Usage:
 *   npx tsx scripts/backfill-cases.ts [--dry-run]  (set DATABASE_URL)
 *
 * Requires DIRECT_URL in the environment (or DATABASE_URL for the prisma
 * client).
 */
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { setDefaultAutoSelectFamily } from "node:net";

function createClient() {
  setDefaultAutoSelectFamily(false);
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

import { derivedStatusForConsultation, derivedStatusForLabOrder, derivedStatusForFacilityBooking } from "../src/lib/cases";

const prisma = createClient();
const dryRun = process.argv.includes("--dry-run");

function counterId(type: "CONSULTATION" | "LABORATORY" | "DIAGNOSTIC" | "REPORT" | "HOSPITAL", year: number): string {
  const codes = { CONSULTATION: "C", LABORATORY: "L", DIAGNOSTIC: "D", REPORT: "R", HOSPITAL: "H" } as const;
  return `${codes[type]}-${year}`;
}

async function allocateCaseNumber(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  type: "CONSULTATION" | "LABORATORY" | "DIAGNOSTIC",
): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await tx.careCaseCounter.upsert({
    where: { id: counterId(type, year) },
    create: { id: counterId(type, year), sequence: 1 },
    update: { sequence: { increment: 1 } },
  });
  return `MED1905-${counterId(type, year).split("-")[0]}-${year}-${String(counter.sequence).padStart(5, "0")}`;
}

async function main() {
  const summary = { consultations: 0, labOrders: 0, facilityBookings: 0, prescriptionsLinked: 0, paymentsLinked: 0 };

  // --- Consultations (batched; idempotent — only unlinked records are selected) ---
  for (let batch = 0; batch < 100; batch += 1) {
    const consultations = await prisma.consultation.findMany({
      where: { caseId: null },
      select: {
        id: true, patientId: true, doctorId: true, status: true, finalizedAt: true,
        followUpDate: true, chiefComplaint: true, diagnosis: true,
      },
      take: 500,
    });
    if (consultations.length === 0) break;

    for (const c of consultations) {
      const doctor = await prisma.doctorProfile.findUnique({ where: { id: c.doctorId }, select: { specialty: true } });
      const status = derivedStatusForConsultation(c.status, c.finalizedAt, c.followUpDate);
      // Release policy: a DRAFT consultation's clinical text is never copied
      // onto the case — the patient can see the case.
      const finalized = c.status === "FINALIZED" && c.finalizedAt;
      if (dryRun) {
        summary.consultations += 1;
        continue;
      }
      await prisma.$transaction(async (tx) => {
        const caseNumber = await allocateCaseNumber(tx, "CONSULTATION");
        const careCase = await tx.careCase.create({
          data: {
            caseNumber,
            type: "CONSULTATION",
            patientId: c.patientId,
            primaryDoctorId: c.doctorId,
            specialty: doctor?.specialty ?? null,
            presentingComplaint: finalized ? c.chiefComplaint : null,
            diagnosisSummary: finalized ? c.diagnosis : null,
            followUpDate: finalized ? c.followUpDate : null,
            status,
            closedAt: status === "CLOSED" ? (c.finalizedAt ?? new Date()) : null,
          },
        });
        await tx.careCaseEvent.create({
          data: {
            caseId: careCase.id,
            status,
            note: finalized
              ? "Case created by backfill from existing consultation"
              : "Case created by backfill from a draft consultation (clinical text withheld)",
          },
        });
        await tx.consultation.update({ where: { id: c.id }, data: { caseId: careCase.id } });
        // Prescriptions written on this consultation join the same episode.
        const rx = await tx.prescription.updateMany({
          where: { consultationId: c.id, caseId: null },
          data: { caseId: careCase.id },
        });
        summary.prescriptionsLinked += rx.count;
        // Payments for this consultation's appointment (relationship recorded in data).
        const appointment = await tx.consultation
          .findUnique({ where: { id: c.id }, select: { appointmentId: true } })
          .then((cc) => cc?.appointmentId ?? null);
        if (appointment) {
          const pays = await tx.payment.updateMany({
            where: { appointmentId: appointment, caseId: null },
            data: { caseId: careCase.id },
          });
          summary.paymentsLinked += pays.count;
        }
        summary.consultations += 1;
      });
    }
  }

  // --- Lab orders (batched) ---
  for (let batch = 0; batch < 100; batch += 1) {
    const labOrders = await prisma.labOrder.findMany({
      where: { caseId: null },
      select: { id: true, patientId: true, orderedById: true, status: true, clinicalNotes: true },
      take: 500,
    });
    if (labOrders.length === 0) break;

    for (const o of labOrders) {
    const doctorProfile = await prisma.doctorProfile.findUnique({
      where: { userId: o.orderedById },
      select: { id: true, specialty: true },
    });
    const status = derivedStatusForLabOrder(o.status);
    if (dryRun) {
      summary.labOrders += 1;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const caseNumber = await allocateCaseNumber(tx, "LABORATORY");
      const careCase = await tx.careCase.create({
        data: {
          caseNumber,
          type: "LABORATORY",
          patientId: o.patientId,
          primaryDoctorId: doctorProfile?.id ?? null,
          specialty: doctorProfile?.specialty ?? null,
          presentingComplaint: o.clinicalNotes,
          status,
        },
      });
      await tx.careCaseEvent.create({
        data: { caseId: careCase.id, status, note: "Case created by backfill from existing lab order" },
      });
      await tx.labOrder.update({ where: { id: o.id }, data: { caseId: careCase.id } });
      summary.labOrders += 1;
    });
    }
  }

  // --- Facility bookings (batched) ---
  for (let batch = 0; batch < 100; batch += 1) {
    const bookings = await prisma.facilityBooking.findMany({
      where: { caseId: null },
      select: { id: true, patientId: true, status: true, serviceName: true },
      take: 500,
    });
    if (bookings.length === 0) break;

    for (const b of bookings) {
    const status = derivedStatusForFacilityBooking(b.status);
    if (dryRun) {
      summary.facilityBookings += 1;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const caseNumber = await allocateCaseNumber(tx, "DIAGNOSTIC");
      const careCase = await tx.careCase.create({
        data: {
          caseNumber,
          type: "DIAGNOSTIC",
          patientId: b.patientId,
          presentingComplaint: b.serviceName,
          status,
        },
      });
      await tx.careCaseEvent.create({
        data: { caseId: careCase.id, status, note: `Case created by backfill from facility booking: ${b.serviceName}` },
      });
      await tx.facilityBooking.update({ where: { id: b.id }, data: { caseId: careCase.id } });
      const pays = await tx.payment.updateMany({
        where: { facilityBookingId: b.id, caseId: null },
        data: { caseId: careCase.id },
      });
      summary.paymentsLinked += pays.count;
      summary.facilityBookings += 1;
    });
    }
  }

  console.log(dryRun ? "DRY RUN — no changes written." : "Backfill complete.");
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
