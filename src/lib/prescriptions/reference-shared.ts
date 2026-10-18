/**
 * Client-safe medication reference constants. Kept separate from
 * `src/lib/prescriptions/reference.ts` so browser components can use them
 * without pulling in Prisma.
 */

/** Standard antibiotic class list offered to prescribers. */
export const ANTIBIOTIC_CLASSES = [
  "penicillins",
  "cephalosporins",
  "macrolides",
  "tetracyclines",
  "fluoroquinolones",
  "aminoglycosides",
  "glycopeptides",
  "lincosamides",
  "sulfonamides",
  "nitroimidazoles",
  "carbapenems",
  "oxazolidinones",
] as const;

/**
 * Antimicrobial spectrum tags (display + storage). Drug class and bacterial
 * coverage are separate concepts: a class does not imply coverage, and coverage
 * is recorded per drug. Tags are coarse labels, not susceptibility results.
 */
export const SPECTRUM_TAGS = [
  "GRAM_POSITIVE",
  "GRAM_NEGATIVE",
  "BROAD_SPECTRUM",
  "ANAEROBES",
  "ATYPICALS",
  "PSEUDOMONAS",
  "MRSA",
] as const;

export function spectrumLabel(tag: string): string {
  return {
    GRAM_POSITIVE: "Gram-positive",
    GRAM_NEGATIVE: "Gram-negative",
    BROAD_SPECTRUM: "Broad-spectrum",
    ANAEROBES: "Anaerobes",
    ATYPICALS: "Atypicals",
    PSEUDOMONAS: "Pseudomonas",
    MRSA: "MRSA coverage",
  }[tag] ?? tag;
}
