/**
 * Reference-data seed (safe to run in any environment, idempotent).
 *
 * Seeds the lab-test catalogue only. No demo users are created: accounts are
 * provisioned through Clerk, and the first admins come from ADMIN_EMAILS.
 *
 * Run with: npm run db:seed   (Node >= 22.12; reads .env via --env-file)
 */
import pkg from "@prisma/client";
import type { LabCategory } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = pkg;
// Prisma 7 connects through a driver adapter (DATABASE_URL is read from .env by `npm run db:seed`).
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

interface TestSeed {
  code: string;
  name: string;
  category: LabCategory;
  unit?: string;
  refLow?: number;
  refHigh?: number;
}

// Generic adult reference ranges. Individual laboratories may override them per result.
const LAB_TESTS: TestSeed[] = [
  { code: "HGB", name: "Haemoglobin", category: "BLOOD", unit: "g/dL", refLow: 12, refHigh: 17.5 },
  { code: "HCT", name: "Haematocrit", category: "BLOOD", unit: "%", refLow: 36, refHigh: 52 },
  { code: "WBC", name: "White blood cell count", category: "BLOOD", unit: "x10^9/L", refLow: 4, refHigh: 11 },
  { code: "PLT", name: "Platelet count", category: "BLOOD", unit: "x10^9/L", refLow: 150, refHigh: 400 },
  { code: "MCV", name: "Mean corpuscular volume", category: "BLOOD", unit: "fL", refLow: 80, refHigh: 100 },
  { code: "MP", name: "Malaria parasite", category: "BLOOD" },
  { code: "GLU", name: "Fasting glucose", category: "BLOOD", unit: "mg/dL", refLow: 70, refHigh: 99 },
  { code: "HBA1C", name: "Glycated haemoglobin (HbA1c)", category: "BLOOD", unit: "%", refLow: 4, refHigh: 5.6 },
  { code: "CREA", name: "Creatinine", category: "BLOOD", unit: "mg/dL", refLow: 0.6, refHigh: 1.3 },
  { code: "UREA", name: "Blood urea nitrogen", category: "BLOOD", unit: "mg/dL", refLow: 7, refHigh: 20 },
  { code: "NA", name: "Sodium", category: "BLOOD", unit: "mmol/L", refLow: 135, refHigh: 145 },
  { code: "K", name: "Potassium", category: "BLOOD", unit: "mmol/L", refLow: 3.5, refHigh: 5.1 },
  { code: "CL", name: "Chloride", category: "BLOOD", unit: "mmol/L", refLow: 98, refHigh: 107 },
  { code: "ALT", name: "Alanine aminotransferase", category: "BLOOD", unit: "U/L", refLow: 7, refHigh: 56 },
  { code: "AST", name: "Aspartate aminotransferase", category: "BLOOD", unit: "U/L", refLow: 10, refHigh: 40 },
  { code: "ALP", name: "Alkaline phosphatase", category: "BLOOD", unit: "U/L", refLow: 44, refHigh: 147 },
  { code: "TBIL", name: "Total bilirubin", category: "BLOOD", unit: "mg/dL", refLow: 0.1, refHigh: 1.2 },
  { code: "CHOL", name: "Total cholesterol", category: "BLOOD", unit: "mg/dL", refLow: 0, refHigh: 200 },
  { code: "LDL", name: "LDL cholesterol", category: "BLOOD", unit: "mg/dL", refLow: 0, refHigh: 130 },
  { code: "HDL", name: "HDL cholesterol", category: "BLOOD", unit: "mg/dL", refLow: 40, refHigh: 90 },
  { code: "TG", name: "Triglycerides", category: "BLOOD", unit: "mg/dL", refLow: 0, refHigh: 150 },
  { code: "TSH", name: "Thyroid-stimulating hormone", category: "BLOOD", unit: "mIU/L", refLow: 0.4, refHigh: 4 },
  { code: "CRP", name: "C-reactive protein", category: "BLOOD", unit: "mg/L", refLow: 0, refHigh: 10 },
  { code: "URINE_PH", name: "Urine pH", category: "URINE", refLow: 4.5, refHigh: 8 },
  { code: "URINE_SG", name: "Urine specific gravity", category: "URINE", refLow: 1.005, refHigh: 1.03 },
  { code: "STOOL_OCC", name: "Stool occult blood", category: "STOOL" },
  { code: "XRAY_CHEST", name: "Chest X-ray", category: "XRAY" },
  { code: "US_ABD", name: "Abdominal ultrasound", category: "ULTRASOUND" },
  { code: "CT_HEAD", name: "CT head", category: "CT" },
  { code: "MRI_BRAIN", name: "MRI brain", category: "MRI" },
];

async function main() {
  for (const test of LAB_TESTS) {
    await prisma.labTest.upsert({
      where: { code: test.code },
      create: test,
      update: { name: test.name, category: test.category, unit: test.unit, refLow: test.refLow, refHigh: test.refHigh },
    });
  }
  console.log(`Seeded ${LAB_TESTS.length} lab tests.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
