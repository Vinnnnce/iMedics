import { prisma } from "@/lib/prisma";
import { buildSearchText } from "./search";
import { SEED_ANALYTES, SEED_CATEGORIES, SEED_ITEMS, localCode } from "./seed-data";

export interface SeedSummary {
  categories: number;
  items: number;
  analytes: number;
}

/**
 * Idempotently load the starter catalogue. Existing rows are updated only in
 * the fields this seed owns (names, grouping, search text); anything a platform
 * administrator or facility changed in the standard-code or clinical fields is
 * preserved, and analytes are only created for items that have none.
 */
export async function seedInvestigationCatalogue(): Promise<SeedSummary> {
  const categoryIds = new Map<string, string>();
  for (const [index, c] of SEED_CATEGORIES.entries()) {
    const row = await prisma.investigation_categories.upsert({
      where: { domain_key: { domain: c.domain, key: c.key } },
      create: { domain: c.domain, key: c.key, name: c.name, description: c.description, icon: c.icon, sortOrder: index },
      update: { name: c.name, description: c.description, icon: c.icon, sortOrder: index },
      select: { id: true },
    });
    categoryIds.set(`${c.domain}:${c.key}`, row.id);
  }

  let items = 0;
  let analytes = 0;
  for (const s of SEED_ITEMS) {
    const categoryId = categoryIds.get(`${s.domain}:${s.category}`);
    if (!categoryId) throw new Error(`Seed item "${s.name}" references unknown category ${s.category}`);
    const code = localCode(s);
    const searchText = buildSearchText([s.name, s.abbreviation, s.synonyms, code, s.subcategory, s.discipline, s.specimen, s.modality, s.dicom]);
    const row = await prisma.investigation_catalogue_items.upsert({
      where: { code },
      create: {
        domain: s.domain,
        categoryId,
        subcategory: s.subcategory,
        code,
        name: s.name,
        abbreviation: s.abbreviation ?? null,
        synonyms: s.synonyms,
        dicomModality: s.dicom ?? null,
        clinicalDiscipline: s.discipline ?? null,
        specimenType: s.specimen ?? null,
        modality: s.modality ?? null,
        reportFormat: s.format,
        preparation: s.prep ?? null,
        turnaroundMinutes: s.tatMinutes ?? null,
        facilityTypes: s.domain === "LABORATORY" ? ["LABORATORY", "HOSPITAL"] : ["DIAGNOSTIC_CENTRE", "HOSPITAL"],
        searchText,
      },
      update: { categoryId, subcategory: s.subcategory, searchText },
      select: { id: true, name: true, _count: { select: { analytes: true } } },
    });
    items++;

    const defs = SEED_ANALYTES[s.name];
    if (defs && row._count.analytes === 0) {
      await prisma.investigation_Analytes.createMany({
        data: defs.map((a, i) => ({
          catalogueItemId: row.id,
          code: a.code,
          name: a.name,
          loincCode: a.loinc ?? null,
          ucumUnit: a.ucum ?? null,
          sortOrder: i,
        })),
      });
      analytes += defs.length;
    }
  }

  return { categories: SEED_CATEGORIES.length, items, analytes };
}

let seeded = false;

/** Seed the catalogue the first time it is read on an empty database. */
export async function ensureCatalogueSeeded(): Promise<void> {
  if (seeded) return;
  const count = await prisma.investigation_catalogue_items.count({ where: { source: "SYSTEM" } });
  if (count === 0) await seedInvestigationCatalogue();
  seeded = true;
}
