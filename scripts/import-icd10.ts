/**
 * Import an ICD-10 release into the database.
 *
 *   npm run icd10:import                       # bundled WHO 2019 release (activated if none is active yet)
 *   npm run icd10:import -- --file path.json --edition 2025 --jurisdiction WHO --label "ICD-10 WHO 2025" --activate
 *
 * To move to a newer edition, convert the new release to the same JSON shape
 * (see docs/ICD10.md), import it with --activate, and clinicians pick from it immediately.
 * Past consultations keep the code and description they were saved with.
 */
import { parseArgs } from "node:util";
import path from "node:path";
import pkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { importIcd10 } from "../src/lib/icd10/import.ts";

const { PrismaClient } = pkg;
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const { values } = parseArgs({
  options: {
    file: { type: "string", default: path.join(import.meta.dirname, "../prisma/data/icd10-who-2019.json") },
    edition: { type: "string", default: "2019" },
    jurisdiction: { type: "string", default: "WHO" },
    label: { type: "string", default: "ICD-10 (WHO, 2019 edition)" },
    "source-url": { type: "string", default: "https://icd.who.int/browse10/2019/en" },
    activate: { type: "boolean", default: false },
  },
});

importIcd10(prisma, {
  file: values.file,
  edition: values.edition,
  jurisdiction: values.jurisdiction,
  label: values.label,
  sourceUrl: values["source-url"],
  activate: values.activate ? true : undefined,
})
  .then((r) => console.log(`Imported ${r.codes} ICD-10 codes (${r.active ? "active" : "not active"}).`))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
