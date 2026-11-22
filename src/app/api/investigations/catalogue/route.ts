import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { facilitiesOffering } from "@/lib/investigations/service";
import { scoreMatch, tokens } from "@/lib/investigations/search";

const schema = z.object({
  domain: z.enum(["LABORATORY", "DIAGNOSTIC"]),
  q: z.string().trim().max(120).optional(),
  categoryId: z.string().uuid().optional(),
  letter: z.string().trim().length(1).optional(),
  mode: z.enum(["browse", "frequent", "recent"]).default("browse"),
  facilityId: z.string().uuid().optional(),
  ids: z.string().max(2000).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(80),
});

const select = {
  id: true, domain: true, code: true, name: true, commonName: true, abbreviation: true, synonyms: true, subcategory: true, loincCode: true, snomedCode: true,
  dicomModality: true, standardCodesVerified: true, specimenType: true, modality: true, bodySite: true, reportFormat: true, preparation: true, turnaroundMinutes: true,
  indicationGuidance: true, clinicalDiscipline: true, isPanel: true, source: true, searchText: true,
  category: { select: { id: true, key: true, name: true } },
  analytes: { select: { code: true, name: true, ucumUnit: true }, orderBy: { sortOrder: "asc" as const } },
} satisfies Prisma.investigation_catalogue_itemsSelect;

// GET /api/investigations/catalogue — search / browse the one central catalogue.
// Searches name, common name, abbreviation, synonym, standard code, department and category.
export const GET = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req, { user }) => {
  const { domain, q, categoryId, letter, mode, facilityId, limit, ids: idList } = parseQuery(req, schema);
  await ensureCatalogueSeeded();

  const where: Prisma.investigation_catalogue_itemsWhereInput = { domain, isActive: true, ...(categoryId ? { categoryId } : {}) };
  // A facility sees the standard catalogue plus its own additions; other facilities' additions stay private to them.
  where.OR = [{ source: "SYSTEM" }, { source: "FACILITY", facilityOfferings: { some: { isActive: true } } }];
  if (facilityId) where.facilityOfferings = { some: { facilityId, isActive: true } };

  const idFilter = idList ? idList.split(",").filter((x) => z.string().uuid().safeParse(x).success).slice(0, 60) : null;
  let rows;
  if (idFilter) {
    rows = await prisma.investigation_catalogue_items.findMany({ where: { ...where, id: { in: idFilter } }, select });
  } else if (mode === "frequent" || mode === "recent") {
    if (user.role !== "DOCTOR") return NextResponse.json({ items: [] });
    const ids =
      mode === "frequent"
        ? (await prisma.investigation_order_items.groupBy({ by: ["catalogueItemId"], where: { catalogueItemId: { not: null }, domain, order: { requestedById: user.id, status: { not: "DRAFT" } } }, _count: { catalogueItemId: true }, orderBy: { _count: { catalogueItemId: "desc" } }, take: 12 })).map((g) => g.catalogueItemId as string)
        : [...new Set((await prisma.investigation_order_items.findMany({ where: { catalogueItemId: { not: null }, domain, order: { requestedById: user.id, status: { not: "DRAFT" } } }, orderBy: { createdAt: "desc" }, take: 60, select: { catalogueItemId: true } })).map((r) => r.catalogueItemId as string))].slice(0, 12);
    const found = await prisma.investigation_catalogue_items.findMany({ where: { ...where, id: { in: ids } }, select });
    rows = ids.map((id) => found.find((f) => f.id === id)).filter((x): x is (typeof found)[number] => !!x);
  } else if (q) {
    const ts = tokens(q);
    const candidates = await prisma.investigation_catalogue_items.findMany({ where: { ...where, AND: ts.map((t) => ({ searchText: { contains: t } })) }, select, take: 400 });
    rows = candidates.map((c) => ({ c, s: scoreMatch(c, q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name)).slice(0, limit).map((x) => x.c);
  } else {
    rows = await prisma.investigation_catalogue_items.findMany({
      where: letter ? { ...where, name: { startsWith: letter, mode: "insensitive" } } : where,
      orderBy: letter || !categoryId ? [{ name: "asc" }] : [{ subcategory: "asc" }, { name: "asc" }],
      select, take: limit,
    });
  }

  const offers = await facilitiesOffering(rows.map((r) => r.id), domain);
  return NextResponse.json({
    items: rows.map((r) => ({ ...r, searchText: undefined, facilities: offers.get(r.id) ?? [] })),
  });
});
