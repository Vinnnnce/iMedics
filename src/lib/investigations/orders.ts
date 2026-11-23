import { z } from "zod";
import type { InvestigationDomain, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { findAccessiblePatient } from "@/lib/access";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { ELECTRONIC_AUTHORISATION_STATEMENT } from "./constants";
import {
  auditInvestigation, computeDueAt, facilitiesOffering, facilityRecipients, findDuplicates, nextOrderNumber,
  notifySafely, recordStatus, refreshOrderStatus,
} from "./service";
import { newRow, touch } from "./db";

const uuid = z.string().uuid();

export const customDetailsSchema = z.object({
  name: z.string().trim().min(2).max(200),
  discipline: z.string().trim().max(120).optional(),
  specimenType: z.string().trim().max(120).optional(),
  bodySite: z.string().trim().max(160).optional(),
  clinicalIndication: z.string().trim().max(1000).optional(),
  relevantHistory: z.string().trim().max(2000).optional(),
  requirements: z.string().trim().max(1000).optional(),
  requestedDepartment: z.string().trim().max(120).optional(),
  comments: z.string().trim().max(1000).optional(),
});

export const orderItemInput = z.object({
  catalogueItemId: uuid.optional(),
  custom: customDetailsSchema.optional(),
  preferredFacilityId: uuid.optional(),
  instructions: z.string().trim().max(1000).optional(),
  bodySite: z.string().trim().max(160).optional(),
  specimenType: z.string().trim().max(120).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).optional(),
  duplicateOverrideReason: z.string().trim().min(5).max(500).optional(),
}).refine((i) => !!i.catalogueItemId !== !!i.custom, { message: "Each item is either a catalogue investigation or a custom one" });

export const orderInput = z.object({
  domain: z.enum(["LABORATORY", "DIAGNOSTIC"]),
  patientId: uuid,
  caseId: uuid.optional(),
  encounterId: uuid.optional(),
  requestingFacilityId: uuid.optional(),
  referringDepartment: z.string().trim().max(120).optional(),
  priority: z.enum(["ROUTINE", "URGENT", "EMERGENCY"]).default("ROUTINE"),
  clinicalIndication: z.string().trim().max(2000).optional(),
  diagnosis: z.string().trim().max(500).optional(),
  clinicalNotes: z.string().trim().max(2000).optional(),
  items: z.array(orderItemInput).min(1).max(60),
});
export type OrderInput = z.infer<typeof orderInput>;

/** What the performing facility needs to know about the patient, snapshotted at order time. */
async function clinicalSnapshot(patientId: string): Promise<Prisma.InputJsonValue> {
  const h = await prisma.medicalHistory.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" }, select: { allergies: true, pastHistory: true, medications: true, hasDiabetes: true } });
  return { allergies: h?.allergies ?? [], pastHistory: h?.pastHistory ?? [], medications: h?.medications ?? [], hasDiabetes: h?.hasDiabetes ?? false } as Prisma.InputJsonValue;
}

async function resolveItems(domain: InvestigationDomain, items: OrderInput["items"]) {
  const ids = items.map((i) => i.catalogueItemId).filter((x): x is string => !!x);
  const catalogue = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: ids }, is_active: true, domain }, include: { investigation_categories: { select: { id: true, key: true } } } });
  const byId = new Map(catalogue.map((c) => [c.id, c]));
  for (const id of ids) if (!byId.has(id)) throw badRequest("One or more selected investigations are no longer available");
  const otherCats = await prisma.investigation_categories.findMany({ where: { domain, key: { startsWith: "other-" } }, select: { id: true, key: true, name: true } });
  const allCats = await prisma.investigation_categories.findMany({ where: { domain }, select: { id: true, key: true, name: true } });
  return { byId, otherCat: otherCats[0], allCats };
}

function itemRows(domain: InvestigationDomain, orderPriority: OrderInput["priority"], items: OrderInput["items"], ctx: Awaited<ReturnType<typeof resolveItems>>) {
  return items.map((i) => {
    if (i.custom) {
      const wanted = i.custom.requestedDepartment?.toLowerCase();
      const cat = (wanted && ctx.allCats.find((c) => c.name.toLowerCase() === wanted || c.key === wanted)) || ctx.otherCat;
      return {
        ...newRow(),
        domain, catalogue_item_id: null, category_id: cat?.id ?? null, department_key: cat?.key ?? (domain === "LABORATORY" ? "other-laboratory" : "other-diagnostics"),
        name_snapshot: i.custom.name, is_custom: true, custom_details: i.custom as Prisma.InputJsonValue,
        specimen_type: i.custom.specimenType ?? i.specimenType ?? null, body_site: i.custom.bodySite ?? i.bodySite ?? null,
        instructions: i.instructions ?? i.custom.requirements ?? null, priority: i.priority ?? orderPriority,
        preferred_facility_id: i.preferredFacilityId ?? null, report_format: "GENERIC" as const, duplicate_override_reason: null,
      };
    }
    const c = ctx.byId.get(i.catalogueItemId as string)!;
    return {
      ...newRow(),
      domain, catalogue_item_id: c.id, category_id: c.category_id, department_key: c.investigation_categories.key, name_snapshot: c.name, code_snapshot: c.code,
      loinc_snapshot: c.loinc_code, snomed_snapshot: c.snomed_code, dicom_snapshot: c.dicom_modality, report_format: c.report_format, is_custom: false,
      specimen_type: i.specimenType ?? c.specimen_type, body_site: i.bodySite ?? c.body_site, instructions: i.instructions ?? null,
      priority: i.priority ?? orderPriority, preferred_facility_id: i.preferredFacilityId ?? null, duplicate_override_reason: i.duplicateOverrideReason ?? null,
    };
  });
}

/** Create or replace a DRAFT order. */
export async function saveDraft(user: User, input: OrderInput, orderId?: string) {
  await findAccessiblePatient(user, input.patientId, { write: true });
  const ctx = await resolveItems(input.domain, input.items);
  const rows = itemRows(input.domain, input.priority, input.items, ctx);
  const snapshot = await clinicalSnapshot(input.patientId);

  return prisma.$transaction(async (tx) => {
    const data = {
      domain: input.domain, patient_id: input.patientId, case_id: input.caseId ?? null, encounter_id: input.encounterId ?? null,
      requesting_facility_id: input.requestingFacilityId ?? null, referring_department: input.referringDepartment ?? null, priority: input.priority,
      clinical_indication: input.clinicalIndication ?? null, diagnosis: input.diagnosis ?? null, clinical_notes: input.clinicalNotes ?? null, clinical_snapshot: snapshot,
    };
    if (orderId) {
      const existing = await tx.investigation_orders.findFirst({ where: { id: orderId, requested_by_id: user.id } });
      if (!existing) throw notFound("Order not found");
      if (existing.status !== "DRAFT") throw conflict("Only draft orders can be edited");
      await tx.investigation_order_items.deleteMany({ where: { order_id: orderId } });
      await tx.investigation_orders.update({ where: { id: orderId }, data: { ...data, ...touch(), investigation_order_items: { create: rows } } });
      return orderId;
    }
    const created = await tx.investigation_orders.create({
      data: { ...data, ...newRow(), order_number: await nextOrderNumber(tx), requested_by_id: user.id, status: "DRAFT", investigation_order_items: { create: rows } },
      select: { id: true },
    });
    return created.id;
  });
}

/**
 * Submit a draft: validate mandatory information, enforce duplicate handling,
 * record the doctor's electronic authorisation, route every item to a
 * performing facility and department, and notify the facilities.
 */
export async function submitOrder(user: User, orderId: string, options: { authorise: boolean; req?: Request }) {
  const order = await prisma.investigation_orders.findFirst({ where: { id: orderId, requested_by_id: user.id }, include: { investigation_order_items: true } });
  if (!order) throw notFound("Order not found");
  if (order.status !== "DRAFT") throw conflict("This order has already been submitted");
  const items = order.investigation_order_items;
  await findAccessiblePatient(user, order.patient_id, { write: true });
  if (!options.authorise) throw badRequest("Electronic authorisation by the requesting doctor is required to submit");
  if (!order.clinical_indication?.trim() && items.some((i) => !i.is_custom)) throw badRequest("A clinical indication is required");

  const catalogueIds = items.map((i) => i.catalogue_item_id).filter((x): x is string => !!x);
  const required = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: catalogueIds }, indication_guidance: { not: null } }, select: { id: true } });
  void required;

  // Duplicates: warn-and-document, never silently block a clinically justified request.
  const dupes = await findDuplicates(order.patient_id, catalogueIds, order.domain, { excludeOrderId: order.id });
  const undocumented = dupes.filter((d) => !items.find((i) => i.catalogue_item_id === d.catalogueItemId)?.duplicate_override_reason);
  if (undocumented.length) {
    throw conflict(`Possible duplicate request: ${undocumented.map((d) => d.name).join(", ")}. Provide a documented reason to proceed.`);
  }

  const offerings = await facilitiesOffering(catalogueIds, order.domain);
  const catalogue = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: catalogueIds } }, select: { id: true, turnaround_minutes: true } });
  const tat = new Map(catalogue.map((c) => [c.id, c.turnaround_minutes]));

  const routed: { id: string; facilityId: string | null; departmentKey: string; dueAt: Date | null; status: "NEW_REQUEST" | "REFERRAL_PENDING" }[] = [];
  for (const item of items) {
    let facilityId: string | null = null;
    let departmentKey = item.department_key;
    let facilityTat: number | null = null;
    if (item.is_custom) {
      if (item.preferred_facility_id) {
        const ok = await prisma.labStaffProfile.findFirst({ where: { id: item.preferred_facility_id, verificationStatus: "VERIFIED" }, select: { id: true } });
        if (!ok) throw badRequest(`The preferred facility for "${item.name_snapshot}" is not available`);
        facilityId = ok.id;
      }
    } else {
      const options_ = offerings.get(item.catalogue_item_id as string) ?? [];
      if (item.preferred_facility_id) {
        const match = options_.find((o) => o.facilityId === item.preferred_facility_id);
        if (!match) throw badRequest(`The selected facility does not offer "${item.name_snapshot}"`);
        facilityId = match.facilityId; departmentKey = match.departmentKey ?? departmentKey; facilityTat = match.turnaroundMinutes;
      } else if (options_.length === 1) {
        facilityId = options_[0].facilityId; departmentKey = options_[0].departmentKey ?? departmentKey; facilityTat = options_[0].turnaroundMinutes;
      } else if (options_.length > 1) {
        throw badRequest(`Select a facility for "${item.name_snapshot}"`);
      }
    }
    routed.push({
      id: item.id, facilityId, departmentKey,
      dueAt: facilityId ? computeDueAt(order.domain, item.priority, facilityTat, item.catalogue_item_id ? tat.get(item.catalogue_item_id) : null) : null,
      status: facilityId ? "NEW_REQUEST" : "REFERRAL_PENDING",
    });
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.investigation_orders.update({
      where: { id: order.id },
      data: { status: "SUBMITTED", submitted_at: now, authorised_at: now, authorisation_statement: ELECTRONIC_AUTHORISATION_STATEMENT, updated_at: now },
    });
    for (const r of routed) {
      await tx.investigation_order_items.update({ where: { id: r.id }, data: { performing_facility_id: r.facilityId, department_key: r.departmentKey, due_at: r.dueAt, status: r.status, status_changed_at: now, updated_at: now } });
      await recordStatus(tx, r.id, null, r.status, { userId: user.id }, r.status === "REFERRAL_PENDING" ? "No participating facility offers this service" : "Order submitted");
    }
    await refreshOrderStatus(tx, order.id);
  });

  const facilityIds = [...new Set(routed.map((r) => r.facilityId).filter((x): x is string => !!x))];
  for (const fid of facilityIds) {
    await notifySafely(await facilityRecipients(fid, "PROCESS_ORDERS"), { kind: "INVESTIGATION_ORDER_RECEIVED", orderId: order.id });
  }
  await auditInvestigation(user, "INVESTIGATION_ORDER_SUBMITTED", order.id, { patientId: order.patient_id, details: { items: routed.length, referralPending: routed.filter((r) => r.status === "REFERRAL_PENDING").length }, req: options.req });
  return { id: order.id, orderNumber: order.order_number, routed: routed.length, referralPending: routed.filter((r) => r.status === "REFERRAL_PENDING").length };
}

export async function cancelOrderItem(user: User, itemId: string, reason: string, req?: Request) {
  const item = await prisma.investigation_order_items.findFirst({ where: { id: itemId, investigation_orders: { requested_by_id: user.id } }, include: { investigation_orders: true } });
  if (!item) throw notFound("Investigation not found");
  if (!["NEW_REQUEST", "REFERRAL_PENDING", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT"].includes(item.status)) throw conflict("This investigation is already in progress and cannot be cancelled by the requester");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_order_items.update({ where: { id: item.id }, data: { status: "CANCELLED", cancel_reason: reason, status_changed_at: new Date(), ...touch() } });
    await recordStatus(tx, item.id, item.status, "CANCELLED", { userId: user.id }, reason);
    await refreshOrderStatus(tx, item.order_id);
  });
  if (item.performing_facility_id) await notifySafely(await facilityRecipients(item.performing_facility_id), { kind: "INVESTIGATION_STATUS_CHANGED", orderId: item.order_id });
  await auditInvestigation(user, "INVESTIGATION_ITEM_CANCELLED", item.id, { patientId: item.investigation_orders.patient_id, details: { reason }, req });
}
