import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { facilitiesOffering } from "@/lib/investigations/service";
import { scoreMatch, tokens } from "@/lib/investigations/search";
import { searchableFromRow, toDto } from "@/lib/investigations/serialize";

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
  id: true, domain: true, code: true, name: true, common_name: true, abbreviation: true, synonyms: true, subcategory: true, loinc_code: true, snomed_code: true,
  dicom_modality: true, standard_codes_verified: true, specimen_type: true, modality: true, body_site: true, report_format: true, preparation: true, turnaround_minutes: true,
  indication_guidance: true, clinical_discipline: true, is_panel: true, source: true, search_text: true,
  investigation_categories: { select: { id: true, key: true, name: true } },
  investigation_analytes: { select: { code: true, name: true, ucum_unit: true }, orderBy: { sort_order: "asc" as const } },
} satisfies Prisma.investigation_catalogue_itemsSelect;

// GET /api/investigations/catalogue — search / browse the one central catalogue.
// Searches name, common name, abbreviation, synonym, standard code, department and category.
export const GET = withAuth(["DOCTOR", "LAB_SCIENTIST"], async (req, { user }) => {
  const { domain, q, categoryId, letter, mode, facilityId, limit, ids: idList } = parseQuery(req, schema);
  await ensureCatalogueSeeded();

  const where: Prisma.investigation_catalogue_itemsWhereInput = { domain, is_active: true, ...(categoryId ? { category_id: categoryId } : {}) };
  // A facility sees the standard catalogue plus its own additions; other facilities' additions stay private to them.
  where.OR = [{ source: "SYSTEM" }, { source: "FACILITY", facility_investigations: { some: { is_active: true } } }];
  if (facilityId) where.facility_investigations = { some: { facility_id: facilityId, is_active: true } };

  const idFilter = idList ? idList.split(",").filter((x) => z.string().uuid().safeParse(x).success).slice(0, 60) : null;
  let rows;
  if (idFilter) {
    rows = await prisma.investigation_catalogue_items.findMany({ where: { ...where, id: { in: idFilter } }, select });
  } else if (mode === "frequent" || mode === "recent") {
    if (user.role !== "DOCTOR") return NextResponse.json({ items: [] });
    const ids =
      mode === "frequent"
        ? (await prisma.investigation_order_items.groupBy({ by: ["catalogue_item_id"], where: { catalogue_item_id: { not: null }, domain, investigation_orders: { requested_by_id: user.id, status: { not: "DRAFT" } } }, _count: { catalogue_item_id: true }, orderBy: { _count: { catalogue_item_id: "desc" } }, take: 12 })).map((g) => g.catalogue_item_id as string)
        : [...new Set((await prisma.investigation_order_items.findMany({ where: { catalogue_item_id: { not: null }, domain, investigation_orders: { requested_by_id: user.id, status: { not: "DRAFT" } } }, orderBy: { created_at: "desc" }, take: 60, select: { catalogue_item_id: true } })).map((r) => r.catalogue_item_id as string))].slice(0, 12);
    const found = await prisma.investigation_catalogue_items.findMany({ where: { ...where, id: { in: ids } }, select });
    rows = ids.map((id) => found.find((f) => f.id === id)).filter((x): x is (typeof found)[number] => !!x);
  } else if (q) {
    const ts = tokens(q);
    const candidates = await prisma.investigation_catalogue_items.findMany({ where: { ...where, AND: ts.map((t) => ({ search_text: { contains: t } })) }, select, take: 400 });
    rows = candidates.map((c) => ({ c, s: scoreMatch(searchableFromRow(c), q) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.c.name.localeCompare(b.c.name)).slice(0, limit).map((x) => x.c);
  } else {
    rows = await prisma.investigation_catalogue_items.findMany({
      where: letter ? { ...where, name: { startsWith: letter, mode: "insensitive" } } : where,
      orderBy: letter || !categoryId ? [{ name: "asc" }] : [{ subcategory: "asc" }, { name: "asc" }],
      select, take: limit,
    });
  }

  const offers = await facilitiesOffering(rows.map((r) => r.id), domain);
  return NextResponse.json({
    items: rows.map((r) => ({ ...toDto("catalogueItem", r), searchText: undefined, facilities: offers.get(r.id) ?? [] })),
  });
});
