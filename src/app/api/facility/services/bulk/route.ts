import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getVerifiedLabProfile } from "@/lib/access";
import { priceSchema, SUPPORTED_CURRENCIES } from "@/lib/money";
import { writeAudit } from "@/lib/audit";
const rowSchema = z.object({
  name: z.string().min(1).max(150),
  category: z.enum(["LAB_TEST", "IMAGING", "PROCEDURE", "CONSULTATION", "OTHER"]).default("OTHER"),
  price: priceSchema,
  currency: z.enum(SUPPORTED_CURRENCIES).default("NGN"),
  description: z.string().max(500).nullable().optional(),
  turnaroundHours: z.number().int().min(1).max(336).nullable().optional(),
  availability: z.string().max(120).nullable().optional(),
  /** Optional branch/location label for facilities that price per branch. */
  branch: z.string().max(80).nullable().optional(),
  isActive: z.boolean().default(true),
});

const bulkSchema = z.object({
  /** A facility-wide default currency for rows that do not set one. */
  currency: z.enum(SUPPORTED_CURRENCIES).default("NGN"),
  services: z.array(rowSchema).min(1).max(500),
});

export interface BulkImportRow {
  row: number;
  name: string;
  action: "created" | "updated" | "skipped";
  error?: string;
}

// POST /api/facility/services/bulk — create or update many services at once (CSV-style upload
// for large facilities). Rows are matched on (name, branch): an existing service is updated,
// a new one is created. Invalid rows are reported and skipped without stopping the rest.
export const POST = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const facility = await getVerifiedLabProfile(user);
  const data = await parseBody(req, bulkSchema);

  const results: BulkImportRow[] = [];
  let created = 0;
  let updated = 0;

  for (const [index, service] of data.services.entries()) {
    const branch = service.branch?.trim() || null;
    try {
      const existing = await prisma.facilityService.findFirst({
        where: { facilityId: facility.id, name: service.name, branch },
        select: { id: true },
      });
      const fields = {
        category: service.category,
        price: service.price,
        currency: service.currency ?? data.currency,
        description: service.description ?? null,
        turnaroundHours: service.turnaroundHours ?? null,
        availability: service.availability ?? null,
        isActive: service.isActive,
      };
      if (existing) {
        await prisma.facilityService.update({ where: { id: existing.id }, data: fields });
        results.push({ row: index + 1, name: service.name, action: "updated" });
        updated += 1;
      } else {
        await prisma.facilityService.create({ data: { facilityId: facility.id, name: service.name, branch, ...fields } });
        results.push({ row: index + 1, name: service.name, action: "created" });
        created += 1;
      }
    } catch (error) {
      results.push({
        row: index + 1,
        name: service.name,
        action: "skipped",
        error: error instanceof Error ? error.message.slice(0, 120) : "Could not import this row",
      });
    }
  }

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_SERVICES_BULK_IMPORT",
    resourceType: "FacilityService",
    resourceId: facility.id,
    details: { created, updated, skipped: results.filter((r) => r.action === "skipped").length },
    req,
  });

  return NextResponse.json({ created, updated, skipped: results.filter((r) => r.action === "skipped").length, results });
});
