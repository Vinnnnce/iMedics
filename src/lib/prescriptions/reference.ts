import { prisma } from "@/lib/prisma";

/**
 * Medication reference service.
 *
 * Classification data comes from the platform's curated `medication_references`
 * table (seeded from public-domain drug references and reviewable by admins).
 * Drug–drug interaction checks call the U.S. National Library of Medicine's
 * RxNav APIs (https://rxnav.nlm.nih.gov/REST/), a free, publicly funded service.
 *
 * IMPORTANT: NLM retired the RxNav Drug–Drug Interaction API on January 2,
 * 2024 — its endpoints now return 404. Until an appropriately licensed
 * interaction source is configured by the operator, `checkRxNavInteractions`
 * therefore reports `available: false` on every call, and the prescriber sees
 * an explicit "interaction information unavailable — review manually" alert.
 * Name→RxCUI resolution (rxcui.json) remains live and is used for medication
 * matching. The code never treats an unreachable interaction service as "no
 * interactions": callers must show "information unavailable" instead of
 * inventing clinical data.
 */

export interface MedicationReferenceDTO {
  id: string;
  rxCui: string | null;
  name: string;
  activeIngredient: string | null;
  drugClass: string | null;
  pharmacologicalClass: string | null;
  antibioticClass: string | null;
  antimicrobialSpectrum: string[];
  commonRoutes: string[];
  formulations: string[];
  interactionSource: string | null;
  verified: boolean;
  notes: string | null;
}

export interface InteractionResult {
  available: boolean;
  source: string;
  interactions: { description: string; severity: string; involved: string[] }[];
}

/** Search the curated local reference by name (prefix or substring). */
export async function searchMedicationReference(query: string, take = 15): Promise<MedicationReferenceDTO[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const rows = await prisma.medicationReference.findMany({
    where: { name: { contains: q, mode: "insensitive" } },
    orderBy: [{ verified: "desc" }, { name: "asc" }],
    take,
  });
  return rows.map(toDTO);
}

export async function getMedicationReference(id: string): Promise<MedicationReferenceDTO | null> {
  const row = await prisma.medicationReference.findUnique({ where: { id } });
  return row ? toDTO(row) : null;
}

function toDTO(row: {
  id: string; rxCui: string | null; name: string; activeIngredient: string | null;
  drugClass: string | null; pharmacologicalClass: string | null; antibioticClass: string | null;
  antimicrobialSpectrum: string[]; commonRoutes: string[]; formulations: string[];
  interactionSource: string | null; verified: boolean; notes: string | null;
}): MedicationReferenceDTO {
  return {
    id: row.id,
    rxCui: row.rxCui,
    name: row.name,
    activeIngredient: row.activeIngredient,
    drugClass: row.drugClass,
    pharmacologicalClass: row.pharmacologicalClass,
    antibioticClass: row.antibioticClass,
    antimicrobialSpectrum: row.antimicrobialSpectrum,
    commonRoutes: row.commonRoutes,
    formulations: row.formulations,
    interactionSource: row.interactionSource,
    verified: row.verified,
    notes: row.notes,
  };
}

/** RxNav returns severity as a "high|moderate|low" band. */
interface RxNavInteraction {
  interactionTypeGroup: { interactionType: { interactionPair: { description: string; severity: string; interactionConcept: { minConceptItem: { name: string } }[] }[] }[] }[];
}

/**
 * Check drug–drug interactions through RxNav for the given RxNorm CUIs.
 * Returns `available: false` (never throws) when the service cannot be reached,
 * so the prescriber sees an explicit "unavailable" state instead of silence.
 */
export async function checkRxNavInteractions(rxCuis: string[]): Promise<InteractionResult> {
  const unique = [...new Set(rxCuis.filter(Boolean))];
  if (unique.length < 2) return { available: true, source: "rxnav", interactions: [] };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcuis=${encodeURIComponent(unique.join("+"))}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) return { available: false, source: "rxnav", interactions: [] };
    const data = (await response.json()) as RxNavInteraction;
    const interactions = (data.interactionTypeGroup ?? []).flatMap((g) =>
      (g.interactionType ?? []).flatMap((t) =>
        (t.interactionPair ?? []).map((pair) => ({
          description: pair.description,
          severity: pair.severity,
          involved: (pair.interactionConcept ?? []).map((c) => c.minConceptItem.name),
        })),
      ),
    );
    return { available: true, source: "rxnav", interactions };
  } catch {
    return { available: false, source: "rxnav", interactions: [] };
  }
}

/**
 * Resolve an RxNorm CUI by exact/normalized name via the NLM RxNav API.
 * Returns null when the service is unavailable or the term is unknown.
 */
export async function matchRxNormCui(name: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const response = await fetch(
      `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);
    if (!response.ok) return null;
    const data = (await response.json()) as { idGroup?: { rxnormId?: string[] } };
    return data.idGroup?.rxnormId?.[0] ?? null;
  } catch {
    return null;
  }
}

export { ANTIBIOTIC_CLASSES, SPECTRUM_TAGS, spectrumLabel } from "./reference-shared";

