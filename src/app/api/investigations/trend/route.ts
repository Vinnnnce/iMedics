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
      valueNumeric: { not: null },
      ...(q.analyteCode ? { analyteCode: q.analyteCode } : q.name ? { name: { equals: q.name, mode: "insensitive" } } : { id: "00000000-0000-0000-0000-000000000000" }),
      result: { status: "RELEASED", ...(user.role === "PATIENT" ? { patientVisible: true } : {}), item: { order: { patientId: q.patientId } } },
    },
    orderBy: { result: { releasedAt: "asc" } },
    take: q.limit,
    select: { id: true, name: true, valueNumeric: true, unit: true, refLow: true, refHigh: true, flag: true, result: { select: { releasedAt: true, version: true, item: { select: { id: true, nameSnapshot: true } } } } },
  });
  return NextResponse.json({ points: rows.map((r) => ({ id: r.id, name: r.name, value: r.valueNumeric, unit: r.unit, refLow: r.refLow, refHigh: r.refHigh, flag: r.flag, at: r.result.releasedAt, itemId: r.result.item.id, investigation: r.result.item.nameSnapshot })) });
});
