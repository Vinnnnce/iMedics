/** Catalogue search: normalisation and ranking shared by the API and tests. */

export function normalise(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9+\-/.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokens(input: string): string[] {
  return normalise(input).split(" ").filter(Boolean);
}

/** The lower-cased text stored in `search_text`: every field a clinician may search by. */
export function buildSearchText(parts: (string | null | undefined | string[])[]): string {
  return normalise(parts.flatMap((p) => (Array.isArray(p) ? p : [p])).filter(Boolean).join(" "));
}

export interface Searchable {
  name: string;
  commonName?: string | null;
  abbreviation?: string | null;
  synonyms?: string[];
  code: string;
  loincCode?: string | null;
  snomedCode?: string | null;
  searchText: string;
}

/**
 * Higher is better; 0 means no match. Every query token must appear somewhere
 * in the searchable text. Exact abbreviation / code and name-prefix matches rank first.
 */
export function scoreMatch(item: Searchable, query: string): number {
  const q = normalise(query);
  if (!q) return 1;
  const ts = tokens(q);
  if (!ts.every((t) => item.searchText.includes(t))) return 0;

  const name = normalise(item.name);
  const common = normalise(item.commonName ?? "");
  const abbr = normalise(item.abbreviation ?? "");
  const syns = (item.synonyms ?? []).map(normalise);
  const codes = [item.code, item.loincCode, item.snomedCode].filter(Boolean).map((c) => normalise(c as string));

  let score = 10;
  if (abbr === q || codes.includes(q)) score += 100;
  if (name === q || common === q || syns.includes(q)) score += 90;
  if (name.startsWith(q)) score += 60;
  else if (common.startsWith(q) || syns.some((s) => s.startsWith(q))) score += 45;
  if (ts.every((t) => name.split(" ").some((w) => w.startsWith(t)))) score += 25;
  if (name.includes(q)) score += 15;
  return score;
}
