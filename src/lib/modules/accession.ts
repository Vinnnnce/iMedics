/**
 * Facility-scoped accession numbers for laboratory specimens.
 *
 * Uses a per-facility counter row inside the same transaction as the
 * specimen insert, mirroring how care-case numbers are allocated.
 */

import { prisma } from "@/lib/prisma";

export type PrismaTransaction = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export async function allocateAccessionNumber(
  tx: PrismaTransaction,
  facilityId: string,
): Promise<string> {
  const counter = await tx.facilityAccessionCounter.upsert({
    where: { id: facilityId },
    create: { id: facilityId, sequence: 1 },
    update: { sequence: { increment: 1 } },
    select: { sequence: true },
  });
  const year = new Date().getFullYear();
  return `SPC-${year}-${counter.sequence.toString().padStart(6, "0")}`;
}
