import { readFileSync } from "node:fs";
import type { PrismaClient } from "@prisma/client";
import { normalizeCode } from "./search.ts";

/** One row of an ICD-10 data file (see prisma/data/icd10-who-2019.json). */
export interface Icd10Row {
  code: string;
  description: string;
  chapter?: string | null;
  chapterTitle?: string | null;
  block?: string | null;
  parent?: string | null;
  selectable: boolean;
}

export interface ImportOptions {
  file: string;
  edition: string;
  jurisdiction: string;
  label: string;
  sourceUrl?: string;
  /** Make this release the one clinicians pick from. */
  activate?: boolean;
}

const CHUNK = 2000;

/**
 * Import (or re-import) one ICD-10 release. Safe to repeat: the release's codes are replaced atomically.
 * Existing diagnoses keep their own code + description snapshot, so updates never rewrite clinical records.
 * The first release ever imported is activated automatically.
 */
export async function importIcd10(prisma: PrismaClient, options: ImportOptions) {
  const rows = JSON.parse(readFileSync(options.file, "utf8")) as Icd10Row[];
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("The ICD-10 data file is empty");
  const seen = new Set<string>();
  for (const row of rows) {
    if (!row.code || !row.description) throw new Error(`Invalid ICD-10 row: ${JSON.stringify(row)}`);
    if (seen.has(row.code)) throw new Error(`Duplicate ICD-10 code in file: ${row.code}`);
    seen.add(row.code);
  }

  return prisma.$transaction(
    async (tx) => {
      const anyActive = await tx.codeSystemRelease.findFirst({ where: { system: "ICD10", isActive: true }, select: { id: true } });
      const release = await tx.codeSystemRelease.upsert({
        where: { system_edition_jurisdiction: { system: "ICD10", edition: options.edition, jurisdiction: options.jurisdiction } },
        create: {
          system: "ICD10",
          edition: options.edition,
          jurisdiction: options.jurisdiction,
          label: options.label,
          sourceUrl: options.sourceUrl,
          codeCount: rows.length,
        },
        update: { label: options.label, sourceUrl: options.sourceUrl, codeCount: rows.length, importedAt: new Date() },
      });

      await tx.icd10Code.deleteMany({ where: { releaseId: release.id } });
      for (let i = 0; i < rows.length; i += CHUNK) {
        await tx.icd10Code.createMany({
          data: rows.slice(i, i + CHUNK).map((r) => ({
            releaseId: release.id,
            code: r.code,
            codeNormalized: normalizeCode(r.code),
            description: r.description,
            chapter: r.chapter ?? null,
            chapterTitle: r.chapterTitle ?? null,
            block: r.block ?? null,
            parentCode: r.parent ?? null,
            isSelectable: r.selectable,
          })),
        });
      }

      const activate = options.activate ?? !anyActive;
      if (activate) {
        await tx.codeSystemRelease.updateMany({ where: { system: "ICD10", id: { not: release.id } }, data: { isActive: false } });
        await tx.codeSystemRelease.update({ where: { id: release.id }, data: { isActive: true } });
      }
      return { releaseId: release.id, codes: rows.length, active: activate || release.isActive };
    },
    { timeout: 120_000, maxWait: 20_000 },
  );
}
