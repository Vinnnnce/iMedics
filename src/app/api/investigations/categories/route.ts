import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { DOCTOR_DIAGNOSTIC_GROUPS } from "@/lib/investigations/seed-data";

const schema = z.object({ domain: z.enum(["LABORATORY", "DIAGNOSTIC"]) });

// GET /api/investigations/categories?domain= — the department / discipline tree for one domain.
export const GET = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req) => {
  const { domain } = parseQuery(req, schema);
  await ensureCatalogueSeeded();
  const categories = await prisma.investigation_categories.findMany({
    where: { domain, isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, name: true, description: true, icon: true, _count: { select: { items: { where: { isActive: true } } } } },
  });
  return NextResponse.json({
    categories: categories.map(({ _count, ...c }) => ({ ...c, itemCount: _count.items })),
    groups: domain === "DIAGNOSTIC" ? DOCTOR_DIAGNOSTIC_GROUPS : null,
  });
});
