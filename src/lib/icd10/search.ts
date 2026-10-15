/** Pure helpers for ICD-10 search. No database access, so they are trivially testable. */

/** Upper-case a code and drop dots/spaces/dashes so "a00.0", "A000" and "A00 0" all compare equal. */
export function normalizeCode(value: string): string {
  return value.replace(/[\s.\-]/g, "").toUpperCase();
}

/** Matches input that looks like (the start of) an ICD-10 code: a letter followed by digits, e.g. "I1", "E11.9", "a00". */
const CODE_LIKE = /^[A-Za-z][0-9][0-9A-Za-z.]*$/;

export interface ParsedQuery {
  /** Set when the query looks like a code; used for prefix matching on the normalized code. */
  codePrefix: string | null;
  /** Lower-case words that must all appear in the description. */
  tokens: string[];
}

export function parseSearchQuery(raw: string): ParsedQuery {
  const query = raw.trim().replace(/\s+/g, " ");
  const tokens = query
    .toLowerCase()
    .split(" ")
    .filter((t) => t.length > 0)
    .slice(0, 6);
  return { codePrefix: CODE_LIKE.test(query) ? normalizeCode(query) : null, tokens };
}

interface Rankable {
  code: string;
  description: string;
}

/** Lower is better: exact code, code prefix, description starts with the query, then everything else. */
export function rankResult(item: Rankable, parsed: ParsedQuery, raw: string): number {
  const codeNorm = normalizeCode(item.code);
  const q = raw.trim().toLowerCase();
  if (parsed.codePrefix && codeNorm === parsed.codePrefix) return 0;
  if (parsed.codePrefix && codeNorm.startsWith(parsed.codePrefix)) return 1;
  if (item.description.toLowerCase().startsWith(q)) return 2;
  return 3;
}

/** Format used everywhere a diagnosis is displayed: "I10 — Essential (primary) hypertension". */
export function formatDiagnosis(item: Rankable): string {
  return `${item.code} — ${item.description}`;
}
