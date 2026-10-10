import { randomBytes } from "node:crypto";

// Unambiguous characters only (no 0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generate a human-friendly, unguessable case number, e.g. "MC-7K3Q9XPD". */
export function generateCaseNumber(): string {
  const bytes = randomBytes(8);
  let suffix = "";
  for (const byte of bytes) suffix += ALPHABET[byte % ALPHABET.length];
  return `MC-${suffix}`;
}
