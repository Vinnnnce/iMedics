import type { Prisma } from "@prisma/client";

/**
 * Allocate the next value of a per-facility, per-year sequence inside the
 * caller's transaction (row-level upsert, so concurrent requests serialize).
 */
export async function nextSequence(
  tx: Prisma.TransactionClient,
  facilityId: string,
  name: string,
  year = new Date().getUTCFullYear(),
): Promise<number> {
  const row = await tx.facilitySequence.upsert({
    where: { facilityId_name_year: { facilityId, name, year } },
    create: { facilityId, name, year, value: 1 },
    update: { value: { increment: 1 } },
    select: { value: true },
  });
  return row.value;
}

export function formatNumber(prefix: string, year: number, value: number): string {
  const safe = prefix.replace(/[^A-Z0-9]/gi, "").toUpperCase().slice(0, 12) || "DOC";
  return `${safe}-${year}-${String(value).padStart(6, "0")}`;
}
