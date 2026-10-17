import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { parseSearchQuery, rankResult } from "./search";

export const ICD10_SYSTEM = "ICD10";

/** The code-set release clinicians currently pick from, or null before the first import. */
export function getActiveIcd10Release() {
  return prisma.codeSystemRelease.findFirst({
    where: { system: ICD10_SYSTEM, isActive: true },
    select: { id: true, label: true, edition: true, jurisdiction: true, codeCount: true, importedAt: true },
  });
}

export interface Icd10Hit {
  code: string;
  description: string;
  chapter: string | null;
  block: string | null;
}

/**
 * Search selectable codes in the active release by code (prefix, dot-insensitive) or by diagnosis words.
 * Results are ranked: exact code, code prefix, description prefix, then other description matches.
 */
export async function searchIcd10(rawQuery: string, limit = 20): Promise<{ release: Awaited<ReturnType<typeof getActiveIcd10Release>>; results: Icd10Hit[] }> {
  const release = await getActiveIcd10Release();
  if (!release) return { release: null, results: [] };

  const parsed = parseSearchQuery(rawQuery);
  if (!parsed.codePrefix && parsed.tokens.length === 0) return { release, results: [] };

  const or: Prisma.Icd10CodeWhereInput[] = [];
  if (parsed.codePrefix) or.push({ codeNormalized: { startsWith: parsed.codePrefix } });
  if (parsed.tokens.length > 0) {
    or.push({ AND: parsed.tokens.map((t) => ({ description: { contains: t, mode: "insensitive" as const } })) });
  }

  const rows = await prisma.icd10Code.findMany({
    where: { releaseId: release.id, isSelectable: true, OR: or },
    select: { code: true, description: true, chapter: true, block: true },
    orderBy: { codeNormalized: "asc" },
    // Over-fetch so ranking can promote strong matches that sort late alphabetically.
    take: Math.max(limit * 5, 100),
  });

  const results = rows
    .map((row) => ({ row, rank: rankResult(row, parsed, rawQuery) }))
    .sort((a, b) => a.rank - b.rank || a.row.code.localeCompare(b.row.code))
    .slice(0, limit)
    .map(({ row }) => row);

  return { release, results };
}

export interface DiagnosisInput {
  code: string;
}

/** Resolve submitted codes against the active release. Unknown or non-selectable codes are reported, never guessed. */
export async function resolveDiagnoses(codes: string[]) {
  const release = await getActiveIcd10Release();
  if (!release) return { release: null, found: [], missing: codes };

  const unique = [...new Set(codes.map((c) => c.trim().toUpperCase()))];
  const found = await prisma.icd10Code.findMany({
    where: { releaseId: release.id, isSelectable: true, code: { in: unique } },
    select: { code: true, description: true },
  });
  const known = new Set(found.map((f) => f.code));
  return { release, found, missing: unique.filter((c) => !known.has(c)) };
}

/**
 * Resolve the one ICD-10 code chosen for a consultation into a diagnosis row (code + description snapshots).
 * Throws a message that is safe to show to the client when the code is unknown or not assignable.
 */
export async function buildDiagnosis(code: string | null | undefined) {
  if (!code) return null;
  const { release, found, missing } = await resolveDiagnoses([code]);
  if (!release) throw new Error("No ICD-10 code set has been imported yet. Ask an administrator to run the ICD-10 import.");
  if (missing.length > 0 || found.length === 0) throw new Error(`Unknown or non-assignable ICD-10 code: ${code.trim().toUpperCase()}`);
  return { releaseId: release.id, code: found[0].code, description: found[0].description };
}

/** Compatibility adapter for callers that still submit a selection array. */
export async function buildDiagnosisRows(selection: { code: string; isPrimary?: boolean }[]) {
  if (selection.length > 1) throw new Error("A consultation can have only one ICD-10 diagnosis.");
  if (selection.length === 0) return { rows: [], summary: null as string | null };
  const diagnosis = await buildDiagnosis(selection[0].code);
  return { rows: diagnosis ? [diagnosis] : [], summary: diagnosis?.description ?? null };
}
