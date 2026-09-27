/**
 * Seed script for local development.
 * Creates demo users, a consultation report, notices and ads so the
 * admin dashboard and consultation tools have data to work with.
 * Safe to re-run: it skips seeding when users already exist.
 *
 * Usage: npx tsx prisma/seed.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log(`Database already has ${existing} users — skipping seed.`);
    return;
  }

  const users = [
    { name: "Admin User", email: "admin@medic1905.com", role: "ADMIN", status: "active", sex: null, dateOfBirth: null },
    { name: "Dr. Sarah Chen", email: "sarah.chen@medic1905.com", role: "DOCTOR", status: "active", sex: "female", dateOfBirth: new Date("1985-04-12") },
    { name: "Dr. Ahmed Hassan", email: "ahmed.hassan@medic1905.com", role: "DOCTOR", status: "active", sex: "male", dateOfBirth: new Date("1982-09-03") },
    { name: "Dr. Kevin Lee", email: "kevin.lee@medic1905.com", role: "DOCTOR", status: "suspended", sex: "male", dateOfBirth: new Date("1990-01-25") },
    { name: "John Mitchell", email: "john.mitchell@example.com", role: "PATIENT", status: "active", sex: "male", dateOfBirth: new Date("1988-06-18") },
    { name: "Jane Smith", email: "jane.smith@example.com", role: "PATIENT", status: "active", sex: "female", dateOfBirth: new Date("1984-11-02") },
    { name: "Robert Kim", email: "robert.kim@example.com", role: "PATIENT", status: "suspended", sex: "male", dateOfBirth: new Date("1971-03-30") },
    { name: "Emily Davis", email: "emily.davis@example.com", role: "PATIENT", status: "banned", sex: "female", dateOfBirth: new Date("1996-08-14") },
    { name: "Lisa Park", email: "lisa.park@medic1905.com", role: "LAB_SCIENTIST", status: "active", sex: "female", dateOfBirth: new Date("1993-02-09") },
    { name: "Mike Okafor", email: "mike.okafor@medic1905.com", role: "LAB_SCIENTIST", status: "active", sex: "male", dateOfBirth: new Date("1991-12-01") },
  ];

  const created = await Promise.all(
    users.map((u) =>
      prisma.user.create({
        data: {
          name: u.name,
          email: u.email,
          role: u.role as any,
          status: u.status,
          sex: u.sex,
          dateOfBirth: u.dateOfBirth,
          password: "",
        },
      })
    )
  );

  const doctor = created.find((u) => u.email === "sarah.chen@medic1905.com")!;
  const patient = created.find((u) => u.email === "john.mitchell@example.com")!;

  await prisma.consultation.create({
    data: {
      patientId: patient.id,
      doctorId: doctor.id,
      chiefComplaint: "Persistent headache for 5 days",
      historyPresentIllness:
        "Bilateral throbbing headache, worse in the morning, associated with mild photophobia. No fever or neck stiffness.",
      pastMedicalHistory: "Hypertension diagnosed 2023, on Amlodipine 5mg. No known allergies.",
      symptoms: [
        { name: "Headache", duration: "5 days", severity: "moderate" },
        { name: "Photophobia", duration: "2 days", severity: "mild" },
      ],
      vitals: {
        bloodPressure: "138/88 mmHg",
        heartRate: "78 bpm",
        temperature: "36.7 °C",
        respiratoryRate: "16 /min",
        spo2: "98 %",
        weight: "82 kg",
        height: "178 cm",
      },
      examination: "Alert, oriented. No focal neurological deficits. Fundi normal.",
      diagnosis: "Tension-type headache, poorly controlled hypertension",
      icdCode: "G44.2",
      differentialDiagnosis: "Migraine without aura; medication-overuse headache",
      labFindings: "CBC within normal limits. Creatinine 1.0 mg/dL.",
      imagingFindings: "No imaging indicated at this visit.",
      medications: [
        { name: "Amlodipine", dose: "10 mg", frequency: "once daily", duration: "30 days", instructions: "Take in the morning" },
        { name: "Paracetamol", dose: "500 mg", frequency: "as needed (max 3x daily)", duration: "7 days", instructions: "For headache relief" },
      ],
      treatmentPlan: "Increase antihypertensive dose. Lifestyle counseling on sodium intake and sleep hygiene.",
      recommendations: "Return immediately if sudden severe headache, vision changes or weakness occur.",
      followUpDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      notes: "Patient advised to monitor blood pressure at home twice weekly.",
      status: "finalized",
    },
  });

  await prisma.notice.createMany({
    data: [
      { text: "System maintenance scheduled for Oct 1, 2:00 AM WAT", active: true },
      { text: "New AI diagnostic tools available for doctors", active: true },
    ],
  });

  await prisma.ad.createMany({
    data: [
      { title: "Health Insurance Plans", content: "Get comprehensive coverage today", placement: "sidebar", active: true },
      { title: "Lab Test Discounts", content: "20% off all CBC tests this month", placement: "dashboard", active: false },
    ],
  });

  console.log("Seeded:", users.length, "users, 1 consultation, 2 notices, 2 ads.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
