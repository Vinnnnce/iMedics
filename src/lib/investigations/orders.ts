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
  const catalogue = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: ids }, isActive: true, domain }, include: { category: { select: { id: true, key: true } } } });
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
        domain, catalogueItemId: null, categoryId: cat?.id ?? null, departmentKey: cat?.key ?? (domain === "LABORATORY" ? "other-laboratory" : "other-diagnostics"),
        nameSnapshot: i.custom.name, isCustom: true, customDetails: i.custom as Prisma.InputJsonValue,
        specimenType: i.custom.specimenType ?? i.specimenType ?? null, bodySite: i.custom.bodySite ?? i.bodySite ?? null,
        instructions: i.instructions ?? i.custom.requirements ?? null, priority: i.priority ?? orderPriority,
        preferredFacilityId: i.preferredFacilityId ?? null, reportFormat: "GENERIC" as const, duplicateOverrideReason: null,
      };
    }
    const c = ctx.byId.get(i.catalogueItemId as string)!;
    return {
      domain, catalogueItemId: c.id, categoryId: c.categoryId, departmentKey: c.category.key, nameSnapshot: c.name, codeSnapshot: c.code,
      loincSnapshot: c.loincCode, snomedSnapshot: c.snomedCode, dicomSnapshot: c.dicomModality, reportFormat: c.reportFormat, isCustom: false,
      specimenType: i.specimenType ?? c.specimenType, bodySite: i.bodySite ?? c.bodySite, instructions: i.instructions ?? null,
      priority: i.priority ?? orderPriority, preferredFacilityId: i.preferredFacilityId ?? null, duplicateOverrideReason: i.duplicateOverrideReason ?? null,
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
      domain: input.domain, patientId: input.patientId, caseId: input.caseId ?? null, encounterId: input.encounterId ?? null,
      requestingFacilityId: input.requestingFacilityId ?? null, referringDepartment: input.referringDepartment ?? null, priority: input.priority,
      clinicalIndication: input.clinicalIndication ?? null, diagnosis: input.diagnosis ?? null, clinicalNotes: input.clinicalNotes ?? null, clinicalSnapshot: snapshot,
    };
    if (orderId) {
      const existing = await tx.investigation_orders.findFirst({ where: { id: orderId, requestedById: user.id } });
      if (!existing) throw notFound("Order not found");
      if (existing.status !== "DRAFT") throw conflict("Only draft orders can be edited");
      await tx.investigation_order_items.deleteMany({ where: { orderId } });
      await tx.investigation_orders.update({ where: { id: orderId }, data: { ...data, items: { create: rows } } });
      return orderId;
    }
    const created = await tx.investigation_orders.create({
      data: { ...data, orderNumber: await nextOrderNumber(tx), requestedById: user.id, status: "DRAFT", items: { create: rows } },
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
  const order = await prisma.investigation_orders.findFirst({ where: { id: orderId, requestedById: user.id }, include: { items: true } });
  if (!order) throw notFound("Order not found");
  if (order.status !== "DRAFT") throw conflict("This order has already been submitted");
  await findAccessiblePatient(user, order.patientId, { write: true });
  if (!options.authorise) throw badRequest("Electronic authorisation by the requesting doctor is required to submit");
  if (!order.clinicalIndication?.trim() && order.items.some((i) => !i.isCustom)) throw badRequest("A clinical indication is required");

  const catalogueIds = order.items.map((i) => i.catalogueItemId).filter((x): x is string => !!x);
  const required = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: catalogueIds }, indicationGuidance: { not: null } }, select: { id: true } });
  void required;

  // Duplicates: warn-and-document, never silently block a clinically justified request.
  const dupes = await findDuplicates(order.patientId, catalogueIds, order.domain, { excludeOrderId: order.id });
  const undocumented = dupes.filter((d) => !order.items.find((i) => i.catalogueItemId === d.catalogueItemId)?.duplicateOverrideReason);
  if (undocumented.length) {
    throw conflict(`Possible duplicate request: ${undocumented.map((d) => d.name).join(", ")}. Provide a documented reason to proceed.`);
  }

  const offerings = await facilitiesOffering(catalogueIds, order.domain);
  const catalogue = await prisma.investigation_catalogue_items.findMany({ where: { id: { in: catalogueIds } }, select: { id: true, turnaroundMinutes: true } });
  const tat = new Map(catalogue.map((c) => [c.id, c.turnaroundMinutes]));

  const routed: { id: string; facilityId: string | null; departmentKey: string; dueAt: Date | null; status: "NEW_REQUEST" | "REFERRAL_PENDING" }[] = [];
  for (const item of order.items) {
    let facilityId: string | null = null;
    let departmentKey = item.departmentKey;
    let facilityTat: number | null = null;
    if (item.isCustom) {
      if (item.preferredFacilityId) {
        const ok = await prisma.labStaffProfile.findFirst({ where: { id: item.preferredFacilityId, verificationStatus: "VERIFIED" }, select: { id: true } });
        if (!ok) throw badRequest(`The preferred facility for "${item.nameSnapshot}" is not available`);
        facilityId = ok.id;
      }
    } else {
      const options_ = offerings.get(item.catalogueItemId as string) ?? [];
      if (item.preferredFacilityId) {
        const match = options_.find((o) => o.facilityId === item.preferredFacilityId);
        if (!match) throw badRequest(`The selected facility does not offer "${item.nameSnapshot}"`);
        facilityId = match.facilityId; departmentKey = match.departmentKey ?? departmentKey; facilityTat = match.turnaroundMinutes;
      } else if (options_.length === 1) {
        facilityId = options_[0].facilityId; departmentKey = options_[0].departmentKey ?? departmentKey; facilityTat = options_[0].turnaroundMinutes;
      } else if (options_.length > 1) {
        throw badRequest(`Select a facility for "${item.nameSnapshot}"`);
      }
    }
    routed.push({
      id: item.id, facilityId, departmentKey,
      dueAt: facilityId ? computeDueAt(order.domain, item.priority, facilityTat, item.catalogueItemId ? tat.get(item.catalogueItemId) : null) : null,
      status: facilityId ? "NEW_REQUEST" : "REFERRAL_PENDING",
    });
  }

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.investigation_orders.update({
      where: { id: order.id },
      data: { status: "SUBMITTED", submittedAt: now, authorisedAt: now, authorisationStatement: ELECTRONIC_AUTHORISATION_STATEMENT },
    });
    for (const r of routed) {
      await tx.investigation_order_items.update({ where: { id: r.id }, data: { performingFacilityId: r.facilityId, departmentKey: r.departmentKey, dueAt: r.dueAt, status: r.status, statusChangedAt: now } });
      await recordStatus(tx, r.id, null, r.status, { userId: user.id }, r.status === "REFERRAL_PENDING" ? "No participating facility offers this service" : "Order submitted");
    }
    await refreshOrderStatus(tx, order.id);
  });

  const facilityIds = [...new Set(routed.map((r) => r.facilityId).filter((x): x is string => !!x))];
  for (const fid of facilityIds) {
    await notifySafely(await facilityRecipients(fid, "PROCESS_ORDERS"), { kind: "INVESTIGATION_ORDER_RECEIVED", orderId: order.id });
  }
  await auditInvestigation(user, "INVESTIGATION_ORDER_SUBMITTED", order.id, { patientId: order.patientId, details: { items: routed.length, referralPending: routed.filter((r) => r.status === "REFERRAL_PENDING").length }, req: options.req });
  return { id: order.id, orderNumber: order.orderNumber, routed: routed.length, referralPending: routed.filter((r) => r.status === "REFERRAL_PENDING").length };
}

export async function cancelOrderItem(user: User, itemId: string, reason: string, req?: Request) {
  const item = await prisma.investigation_order_items.findFirst({ where: { id: itemId, order: { requestedById: user.id } }, include: { order: true } });
  if (!item) throw notFound("Investigation not found");
  if (!["NEW_REQUEST", "REFERRAL_PENDING", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT"].includes(item.status)) throw conflict("This investigation is already in progress and cannot be cancelled by the requester");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_order_items.update({ where: { id: item.id }, data: { status: "CANCELLED", cancelReason: reason, statusChangedAt: new Date() } });
    await recordStatus(tx, item.id, item.status, "CANCELLED", { userId: user.id }, reason);
    await refreshOrderStatus(tx, item.orderId);
  });
  if (item.performingFacilityId) await notifySafely(await facilityRecipients(item.performingFacilityId), { kind: "INVESTIGATION_STATUS_CHANGED", orderId: item.orderId });
  await auditInvestigation(user, "INVESTIGATION_ITEM_CANCELLED", item.id, { patientId: item.order.patientId, details: { reason }, req });
}
