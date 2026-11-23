import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";

const schema = z.object({ patientId: z.string().uuid(), analyteCode: z.string().trim().min(1).max(40).optional(), name: z.string().trim().max(160).optional(), limit: z.coerce.number().int().min(2).max(60).default(30) });

// GET /api/investigations/trend — chronological RELEASED values of one analyte (for comparison and trend graphs).
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const q = parseQuery(req, schema);
  await findAccessiblePatient(user, q.patientId);
  const rows = await prisma.investigation_observations.findMany({
    where: {
      value_numeric: { not: null },
      ...(q.analyteCode ? { analyte_code: q.analyteCode } : q.name ? { name: { equals: q.name, mode: "insensitive" } } : { id: "00000000-0000-0000-0000-000000000000" }),
      investigation_results: { status: "RELEASED", ...(user.role === "PATIENT" ? { patient_visible: true } : {}), investigation_order_items: { investigation_orders: { patient_id: q.patientId } } },
    },
    orderBy: { investigation_results: { released_at: "asc" } },
    take: q.limit,
    select: { id: true, name: true, value_numeric: true, unit: true, ref_low: true, ref_high: true, flag: true, investigation_results: { select: { released_at: true, version: true, investigation_order_items: { select: { id: true, name_snapshot: true } } } } },
  });
  return NextResponse.json({ points: rows.map((r) => ({ id: r.id, name: r.name, value: r.value_numeric, unit: r.unit, refLow: r.ref_low, refHigh: r.ref_high, flag: r.flag, at: r.investigation_results.released_at, itemId: r.investigation_results.investigation_order_items.id, investigation: r.investigation_results.investigation_order_items.name_snapshot })) });
});
