import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { ensureCatalogueSeeded } from "@/lib/investigations/catalogue-seed";
import { catalogueSearchText, auditInvestigation, offeringColumns } from "@/lib/investigations/service";
import { newRow, touch } from "@/lib/investigations/db";
import { toDto, toDtos } from "@/lib/investigations/serialize";
import { badRequest, conflict } from "@/lib/errors";
import { slug } from "@/lib/investigations/seed-data";
import { tokens } from "@/lib/investigations/search";

const listSchema = z.object({ domain: z.enum(["LABORATORY", "DIAGNOSTIC"]).optional(), q: z.string().trim().max(80).optional(), onlyOffered: z.enum(["true", "false"]).default("false"), limit: z.coerce.number().int().min(1).max(300).default(150) });

// GET — the central catalogue annotated with this facility's own offering (price, TAT, department override, active).
export const GET = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_SERVICES", req);
  const { domain, q, onlyOffered, limit } = parseQuery(req, listSchema);
  await ensureCatalogueSeeded();
  const items = await prisma.investigation_catalogue_items.findMany({
    where: {
      is_active: true, ...(domain ? { domain } : {}),
      OR: [{ source: "SYSTEM" }, { created_by_facility_id: access.facility.id }],
      ...(q ? { AND: tokens(q).map((t) => ({ search_text: { contains: t } })) } : {}),
      ...(onlyOffered === "true" ? { facility_investigations: { some: { facility_id: access.facility.id } } } : {}),
    },
    orderBy: [{ domain: "asc" }, { name: "asc" }], take: limit,
    select: {
      id: true, domain: true, code: true, name: true, abbreviation: true, subcategory: true, loinc_code: true, snomed_code: true, standard_codes_verified: true, source: true, specimen_type: true, turnaround_minutes: true, preparation: true,
      investigation_categories: { select: { id: true, key: true, name: true } },
      facility_investigations: { where: { facility_id: access.facility.id }, select: { id: true, is_active: true, price_minor: true, turnaround_minutes: true, department_key: true, preparation: true, specimen_requirements: true, report_template: true, responsible_staff_id: true, local_code: true, local_aliases: true } },
    },
  });
  const categories = await prisma.investigation_categories.findMany({ where: { is_active: true }, orderBy: [{ domain: "asc" }, { sort_order: "asc" }], select: { id: true, key: true, name: true, domain: true } });
  return NextResponse.json({
    items: items.map(({ facility_investigations, ...i }) => ({ ...toDto("catalogueItem", i), offering: facility_investigations[0] ? toDto("offering", facility_investigations[0]) : null })),
    categories: toDtos("category", categories),
  });
});

const offeringFields = {
  isActive: z.boolean().optional(),
  priceMinor: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
  turnaroundMinutes: z.number().int().min(5).max(60 * 24 * 90).nullable().optional(),
  departmentKey: z.string().trim().max(80).nullable().optional(),
  preparation: z.string().trim().max(1000).nullable().optional(),
  specimenRequirements: z.string().trim().max(500).nullable().optional(),
  reportTemplate: z.string().trim().max(80).nullable().optional(),
  responsibleStaffId: z.string().uuid().nullable().optional(),
  localCode: z.string().trim().max(60).nullable().optional(),
  localAliases: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
};

const createSchema = z.object({
  /** Offer an existing catalogue entry... */
  catalogueItemId: z.string().uuid().optional(),
  /** ...or create a new facility-owned one. Standard codes are accepted only if the admin asserts they are verified. */
  newItem: z.object({
    domain: z.enum(["LABORATORY", "DIAGNOSTIC"]), categoryId: z.string().uuid(), name: z.string().trim().min(2).max(160), commonName: z.string().trim().max(160).optional(), abbreviation: z.string().trim().max(30).optional(),
    synonyms: z.array(z.string().trim().min(1).max(80)).max(20).default([]), specimenType: z.string().trim().max(120).optional(), modality: z.string().trim().max(120).optional(), bodySite: z.string().trim().max(160).optional(),
    reportFormat: z.enum(["LAB_PANEL", "NARRATIVE", "ULTRASOUND", "MRI", "CT", "XRAY", "MAMMOGRAPHY", "ECHOCARDIOGRAPHY", "ECG", "EEG", "ENDOSCOPY", "GENERIC"]).default("GENERIC"),
    loincCode: z.string().trim().regex(/^\d{1,7}-\d$/, "A LOINC code looks like 718-7").optional(), snomedCode: z.string().trim().regex(/^\d{6,18}$/, "A SNOMED CT concept id is 6–18 digits").optional(),
    dicomModality: z.string().trim().max(16).optional(), standardCodesVerified: z.boolean().default(false),
  }).optional(),
  ...offeringFields,
});

// POST — add a service to this facility's catalogue (enable a standard item, or create a facility-specific one).
export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireFacilityAccess(user, "MANAGE_SERVICES", req);
  const body = await parseBody(req, createSchema);
  const { catalogueItemId, newItem, ...offering } = body;
  if (!!catalogueItemId === !!newItem) throw badRequest("Provide either an existing investigation or the details of a new one");

  let itemId = catalogueItemId;
  if (newItem) {
    const cat = await prisma.investigation_categories.findFirst({ where: { id: newItem.categoryId, domain: newItem.domain } });
    if (!cat) throw badRequest("Unknown department for this investigation type");
    const code = `FAC-${access.facility.id.slice(0, 8).toUpperCase()}-${slug(newItem.name).toUpperCase()}`;
    if (await prisma.investigation_catalogue_items.findUnique({ where: { code } })) throw conflict("Your facility already has an investigation with this name");
    const created = await prisma.investigation_catalogue_items.create({
      data: {
        ...newRow(),
        domain: newItem.domain, category_id: cat.id, code, name: newItem.name, common_name: newItem.commonName ?? null, abbreviation: newItem.abbreviation ?? null, synonyms: newItem.synonyms,
        specimen_type: newItem.specimenType ?? null, modality: newItem.modality ?? null, body_site: newItem.bodySite ?? null, report_format: newItem.reportFormat, loinc_code: newItem.loincCode ?? null, snomed_code: newItem.snomedCode ?? null,
        dicom_modality: newItem.dicomModality ?? null, standard_codes_verified: newItem.standardCodesVerified && !!(newItem.loincCode || newItem.snomedCode), source: "FACILITY", created_by_facility_id: access.facility.id,
        facility_types: [access.facility.kind ?? "LABORATORY"],
        search_text: catalogueSearchText({ ...newItem, code, categoryName: cat.name }),
      },
      select: { id: true },
    });
    itemId = created.id;
  }
  const row = await prisma.facility_investigations.upsert({
    where: { facility_id_catalogue_item_id: { facility_id: access.facility.id, catalogue_item_id: itemId as string } },
    create: { ...newRow(), facility_id: access.facility.id, catalogue_item_id: itemId as string, ...offeringColumns(offering), is_active: offering.isActive ?? true, local_aliases: offering.localAliases ?? [] },
    update: { ...offeringColumns(offering), is_active: offering.isActive ?? true, local_aliases: offering.localAliases ?? [], ...touch() },
    select: { id: true },
  });
  await auditInvestigation(user, "FACILITY_INVESTIGATION_SAVED", row.id, { facilityId: access.facility.id, details: { catalogueItemId: itemId, created: !!newItem } });
  return NextResponse.json({ success: true, id: row.id, catalogueItemId: itemId }, { status: 201 });
});
