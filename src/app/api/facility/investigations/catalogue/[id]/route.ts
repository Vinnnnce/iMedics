import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { notFound } from "@/lib/errors";
import { catalogueSearchText, auditInvestigation, offeringColumns } from "@/lib/investigations/service";
import { touch } from "@/lib/investigations/db";

type Params = { id: string };
const schema = z.object({
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
  /** Edits to the facility's OWN catalogue entry (not allowed on platform entries). */
  item: z.object({ name: z.string().trim().min(2).max(160).optional(), commonName: z.string().trim().max(160).nullable().optional(), synonyms: z.array(z.string().trim().min(1).max(80)).max(20).optional(), specimenType: z.string().trim().max(120).nullable().optional(), standardCodesVerified: z.boolean().optional() }).optional(),
});

// PATCH /api/facility/investigations/catalogue/[id] — edit this facility's offering of catalogue item [id].
export const PATCH = withAuth<Params>(null, async (req, { user, params }) => {
  const itemId = parseId((await params).id);
  const access = await requireFacilityAccess(user, "MANAGE_SERVICES", req);
  const { item, ...offering } = await parseBody(req, schema);
  const row = await prisma.facility_investigations.findUnique({ where: { facility_id_catalogue_item_id: { facility_id: access.facility.id, catalogue_item_id: itemId } }, include: { investigation_catalogue_items: { include: { investigation_categories: true } } } });
  if (!row) throw notFound("This investigation is not in your catalogue");
  await prisma.facility_investigations.update({ where: { id: row.id }, data: { ...offeringColumns(offering), ...touch() } });
  const entry = row.investigation_catalogue_items;
  if (item && entry.created_by_facility_id === access.facility.id) {
    const next = {
      name: item.name ?? entry.name,
      commonName: item.commonName === undefined ? entry.common_name : item.commonName,
      synonyms: item.synonyms ?? entry.synonyms,
      specimenType: item.specimenType === undefined ? entry.specimen_type : item.specimenType,
    };
    await prisma.investigation_catalogue_items.update({
      where: { id: itemId },
      data: {
        name: item.name, common_name: item.commonName, synonyms: item.synonyms, specimen_type: item.specimenType, standard_codes_verified: item.standardCodesVerified,
        search_text: catalogueSearchText({
          ...next, code: entry.code, abbreviation: entry.abbreviation, loincCode: entry.loinc_code, snomedCode: entry.snomed_code, subcategory: entry.subcategory,
          clinicalDiscipline: entry.clinical_discipline, modality: entry.modality, dicomModality: entry.dicom_modality, categoryName: entry.investigation_categories.name,
        }),
        ...touch(),
      },
    });
  }
  await auditInvestigation(user, "FACILITY_INVESTIGATION_UPDATED", row.id, { facilityId: access.facility.id });
  return NextResponse.json({ success: true });
});
