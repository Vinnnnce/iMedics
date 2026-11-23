import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { notFound } from "@/lib/errors";
import { validNextStatuses } from "@/lib/investigations/service";
import { toDto, toDtos } from "@/lib/investigations/serialize";

type Params = { id: string };

// GET /api/facility/investigations/items/[id] — full processing view for the performing facility,
// including previous released results of the same patient for comparison.
export const GET = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const item = await prisma.investigation_order_items.findFirst({
    where: { id, performing_facility_id: access.facility.id },
    include: {
      investigation_orders: { include: { patients: { select: { id: true, firstName: true, lastName: true, caseNumber: true, gender: true, dateOfBirth: true } }, users: { select: { name: true } } } },
      investigation_catalogue_items: { select: { id: true, specimen_type: true, preparation: true, indication_guidance: true } },
      investigation_status_history: { orderBy: { created_at: "asc" } },
      investigation_specimens: { orderBy: { created_at: "asc" } },
      investigation_media: { orderBy: { created_at: "asc" }, select: { id: true, file_name: true, mime_type: true, size_bytes: true, description: true, dicom_modality: true, study_instance_uid: true, result_id: true, created_at: true } },
      investigation_referrals: { orderBy: { created_at: "desc" } },
    },
  });
  if (!item) throw notFound("Investigation not found");

  // Every version of the report, newest first (the item's own result relation is 1:1, so the history is read directly).
  const results = await prisma.investigation_results.findMany({
    where: { item_id: id },
    orderBy: { version: "desc" },
    include: {
      investigation_observations: { orderBy: { sort_order: "asc" } },
      investigation_critical_alerts: { include: { investigation_alert_events: { orderBy: { created_at: "asc" } } } },
    },
  });

  // Facility-specific analyte ranges override the platform defaults.
  const catalogueItem = item.investigation_catalogue_items;
  const analytes = catalogueItem
    ? await prisma.investigation_analytes.findMany({ where: { catalogue_item_id: catalogueItem.id, OR: [{ facility_id: access.facility.id }, { facility_id: null }] }, orderBy: { sort_order: "asc" } })
    : [];
  const merged = new Map<string, (typeof analytes)[number]>();
  for (const a of analytes) if (!merged.has(a.code) || a.facility_id) merged.set(a.code, a);

  const codes = [...merged.keys()];
  const previous = codes.length
    ? await prisma.investigation_observations.findMany({
        where: { analyte_code: { in: codes }, investigation_results: { status: "RELEASED", investigation_order_items: { id: { not: id }, investigation_orders: { patient_id: item.investigation_orders.patient_id } } } },
        orderBy: { investigation_results: { released_at: "desc" } }, take: 40,
        select: { analyte_code: true, value_numeric: true, value_text: true, unit: true, flag: true, investigation_results: { select: { released_at: true } } },
      })
    : [];

  return NextResponse.json({
    item: { ...toDto("item", { ...item, investigation_catalogue_items: undefined, investigation_results: results }), catalogue: catalogueItem ? toDto("catalogueItem", catalogueItem) : null },
    analytes: toDtos("analyte", [...merged.values()]),
    previous: toDtos("observation", previous),
    nextStatuses: validNextStatuses(item.domain, item.status),
    permissions: access.permissions,
  });
});
