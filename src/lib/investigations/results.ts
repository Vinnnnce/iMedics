import { z } from "zod";
import type { InvestigationItemStatus, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { evaluateFlag, rangeText } from "./flags";
import { auditInvestigation, facilityRecipients, notifySafely, recordStatus, refreshOrderStatus } from "./service";
import { raiseCriticalAlert } from "./alerts";
import { newId, newRow, touch } from "./db";

const num = z.number().finite().nullable().optional();

export const observationInput = z.object({
  analyteCode: z.string().trim().max(40).optional(),
  name: z.string().trim().min(1).max(160),
  loincCode: z.string().trim().max(20).optional(),
  valueNumeric: num,
  valueText: z.string().trim().max(500).optional(),
  unit: z.string().trim().max(40).optional(),
  refLow: num,
  refHigh: num,
  criticalLow: num,
  criticalHigh: num,
  refText: z.string().trim().max(120).optional(),
}).refine((o) => o.valueNumeric != null || !!o.valueText, { message: "Each observation needs a value" });

export const resultInput = z.object({
  clinicalIndication: z.string().trim().max(2000).optional(),
  technique: z.string().trim().max(4000).optional(),
  findings: z.string().trim().max(20000).optional(),
  impression: z.string().trim().max(5000).optional(),
  conclusion: z.string().trim().max(5000).optional(),
  recommendations: z.string().trim().max(5000).optional(),
  reportData: z.record(z.string(), z.unknown()).optional(),
  reporterName: z.string().trim().max(160).optional(),
  reporterCredentials: z.string().trim().max(200).optional(),
  patientVisible: z.boolean().optional(),
  observations: z.array(observationInput).max(300).default([]),
});
export type ResultInput = z.infer<typeof resultInput>;

const LOCKED = ["SIGNED", "RELEASED", "SUPERSEDED"] as const;

const ENTRY_STATUSES: Record<"LABORATORY" | "DIAGNOSTIC", InvestigationItemStatus[]> = {
  LABORATORY: ["ANALYSIS_COMPLETED", "RESULT_ENTERED"],
  DIAGNOSTIC: ["EXAM_COMPLETED", "MEDIA_UPLOADED", "AWAITING_INTERPRETATION", "PRELIMINARY_REPORT"],
};
const AFTER_RELEASE: InvestigationItemStatus[] = ["RELEASED", "DELIVERED"];

type Facility = { id: string };
type Item = Awaited<ReturnType<typeof loadItem>>;

/**
 * The item with its order summary and every result version, newest first.
 * (`investigation_results` is modelled 1:1 on the item because of the partial unique index on
 * `is_current`, so the full version history is read through its own query.)
 */
async function loadItem(itemId: string, facilityId: string) {
  const item = await prisma.investigation_order_items.findFirst({
    where: { id: itemId, performing_facility_id: facilityId },
    include: { investigation_orders: { select: { id: true, patient_id: true, requested_by_id: true, domain: true } } },
  });
  if (!item) throw notFound("Investigation not found");
  const results = await prisma.investigation_results.findMany({ where: { item_id: itemId }, orderBy: { version: "desc" } });
  return { ...item, results };
}

const current = (item: Item) => item.results.find((r) => r.is_current) ?? null;

/** Step a (non-amendment) item to `to`, writing history. No-op when the item is already past release (amendment). */
async function moveItem(tx: Prisma.TransactionClient, item: Item, to: InvestigationItemStatus, user: User, note?: string, options: { force?: boolean } = {}) {
  if (item.status === to) return;
  if (!options.force && AFTER_RELEASE.includes(item.status)) return;
  await tx.investigation_order_items.update({ where: { id: item.id }, data: { status: to, status_changed_at: new Date(), ...touch() } });
  await recordStatus(tx, item.id, item.status, to, { userId: user.id }, note);
  item.status = to;
  await refreshOrderStatus(tx, item.order_id);
}

/** Create or update the working (unsigned) version of the result. */
export async function saveResult(user: User, facility: Facility, itemId: string, input: ResultInput) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  const amending = !!cur && LOCKED.includes(cur.status as (typeof LOCKED)[number]);
  if (amending) throw conflict("This report is signed. Start an amendment to change it.");
  if (!AFTER_RELEASE.includes(item.status) && !ENTRY_STATUSES[item.domain].includes(item.status)) {
    throw conflict("Results can only be entered after the analysis or examination is complete");
  }
  if (cur?.status === "AWAITING_VERIFICATION") throw conflict("This result is awaiting verification; the verifier must return it before it can be edited");
  if (item.report_format === "LAB_PANEL" && input.observations.length === 0 && !input.findings) throw badRequest("Enter at least one result");

  const rows = input.observations.map((o, i) => {
    const f = evaluateFlag({ value: o.valueNumeric, refLow: o.refLow, refHigh: o.refHigh, criticalLow: o.criticalLow, criticalHigh: o.criticalHigh });
    return {
      analyte_code: o.analyteCode ?? null, name: o.name, loinc_code: o.loincCode ?? null, value_numeric: o.valueNumeric ?? null, value_text: o.valueText ?? null,
      unit: o.unit ?? null, ref_low: o.refLow ?? null, ref_high: o.refHigh ?? null, ref_text: o.refText ?? rangeText(o.refLow, o.refHigh), flag: f.flag, is_critical: f.isCritical, sort_order: i,
    };
  });
  const content = {
    clinical_indication: input.clinicalIndication ?? null, technique: input.technique ?? null, findings: input.findings ?? null, impression: input.impression ?? null,
    conclusion: input.conclusion ?? null, recommendations: input.recommendations ?? null, report_data: (input.reportData ?? undefined) as Prisma.InputJsonValue | undefined,
    reporter_name: input.reporterName ?? null, reporter_credentials: input.reporterCredentials ?? null, patient_visible: input.patientVisible ?? true,
  };

  const resultId = await prisma.$transaction(async (tx) => {
    let id: string;
    if (cur) {
      await tx.investigation_observations.deleteMany({ where: { result_id: cur.id } });
      await tx.investigation_results.update({ where: { id: cur.id }, data: { ...content, ...touch(), status: "DRAFT", entered_by_id: user.id, entered_at: new Date() } });
      id = cur.id;
    } else {
      const created = await tx.investigation_results.create({ data: { ...newRow(), item_id: itemId, version: 1, is_current: true, status: "DRAFT", ...content, entered_by_id: user.id, entered_at: new Date() }, select: { id: true } });
      id = created.id;
    }
    if (rows.length) await tx.investigation_observations.createMany({ data: rows.map((r) => ({ ...r, id: newId(), result_id: id })) });
    if (item.domain === "LABORATORY") await moveItem(tx, item, "RESULT_ENTERED", user);
    else if (["EXAM_COMPLETED", "MEDIA_UPLOADED"].includes(item.status)) await moveItem(tx, item, "AWAITING_INTERPRETATION", user);
    return id;
  });
  await auditInvestigation(user, "INVESTIGATION_RESULT_SAVED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id });
  return resultId;
}

export async function submitForVerification(user: User, facility: Facility, itemId: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "DRAFT") throw conflict("There is no draft result to submit");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "AWAITING_VERIFICATION", ...touch() } });
    await moveItem(tx, item, "AWAITING_VERIFICATION", user);
  });
  await notifySafely((await facilityRecipients(facility.id, "VERIFY_RESULTS")).filter((id) => id !== user.id), { kind: "INVESTIGATION_UPDATED", orderId: item.order_id });
  await auditInvestigation(user, "INVESTIGATION_SUBMITTED_FOR_VERIFICATION", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id });
}

const selfVerificationAllowed = () => process.env.INVESTIGATION_ALLOW_SELF_VERIFICATION === "true";

/** Maker-checker: the person who entered a result cannot verify it (unless the facility policy allows). */
export async function verifyResult(user: User, facility: Facility, itemId: string, decision: { approve: boolean; note?: string }) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "AWAITING_VERIFICATION") throw conflict("There is no result awaiting verification");
  if (cur.entered_by_id === user.id && !selfVerificationAllowed()) throw forbidden("A result must be verified by a different professional from the one who entered it");

  if (!decision.approve) {
    if (!decision.note?.trim()) throw badRequest("Give a reason for returning the result");
    await prisma.$transaction(async (tx) => {
      await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "DRAFT", ...touch() } });
      await moveItem(tx, item, item.domain === "LABORATORY" ? "RESULT_ENTERED" : "AWAITING_INTERPRETATION", user, decision.note);
    });
    await auditInvestigation(user, "INVESTIGATION_RESULT_RETURNED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id, details: { note: decision.note } });
    return { returned: true as const };
  }

  const critical = await prisma.investigation_observations.count({ where: { result_id: cur.id, is_critical: true } });
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "VERIFIED", verified_by_id: user.id, verified_at: new Date(), ...touch() } });
    await moveItem(tx, item, "VERIFIED", user);
  });
  if (critical > 0) await raiseCriticalAlert({ resultId: cur.id, itemId, patientId: item.investigation_orders.patient_id, orderId: item.order_id, doctorUserId: item.investigation_orders.requested_by_id, facilityId: facility.id, count: critical });
  await auditInvestigation(user, "INVESTIGATION_RESULT_VERIFIED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id, details: { critical } });
  return { returned: false as const, critical };
}

export async function signResult(user: User, facility: Facility, itemId: string, statement: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "VERIFIED") throw conflict("Only a verified result can be signed");
  if (!statement.trim()) throw badRequest("A signature statement is required");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "SIGNED", signed_by_id: user.id, signed_at: new Date(), signature_statement: statement, reporter_name: cur.reporter_name ?? user.name, ...touch() } });
    await moveItem(tx, item, "SIGNED", user);
  });
  await auditInvestigation(user, "INVESTIGATION_REPORT_SIGNED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id });
}

export async function releaseResult(user: User, facility: Facility, itemId: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "SIGNED") throw conflict("Only a signed report can be released");
  const patient = await prisma.patient.findUnique({ where: { id: item.investigation_orders.patient_id }, select: { userId: true } });
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.investigation_results.updateMany({ where: { item_id: itemId, id: { not: cur.id }, status: "RELEASED" }, data: { status: "SUPERSEDED", updated_at: now } });
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "RELEASED", released_at: now, released_by_id: user.id, updated_at: now } });
    if (!AFTER_RELEASE.includes(item.status)) {
      await moveItem(tx, item, "RELEASED", user, undefined, { force: true });
      await moveItem(tx, item, "DELIVERED", user, "Delivered to the requesting doctor and the patient record", { force: true });
    }
  });
  await notifySafely([item.investigation_orders.requested_by_id], { kind: "INVESTIGATION_REPORT_RELEASED", orderId: item.order_id });
  if (cur.patient_visible && patient?.userId) await notifySafely([patient.userId], { kind: "INVESTIGATION_REPORT_RELEASED", orderId: item.order_id });
  await auditInvestigation(user, "INVESTIGATION_REPORT_RELEASED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id, details: { version: cur.version } });
}

/** Start an amendment of a released report: appends a new version, never edits the signed one. */
export async function startAmendment(user: User, facility: Facility, itemId: string, reason: string) {
  if (reason.trim().length < 5) throw badRequest("Give a reason for the amendment");
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "RELEASED") throw conflict("Only a released report can be amended");
  const observations = await prisma.investigation_observations.findMany({ where: { result_id: cur.id }, orderBy: { sort_order: "asc" } });
  const id = await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { is_current: false, ...touch() } });
    const created = await tx.investigation_results.create({
      data: {
        ...newRow(),
        item_id: itemId, version: cur.version + 1, is_current: true, status: "DRAFT", amendment_reason: reason,
        clinical_indication: cur.clinical_indication, technique: cur.technique, findings: cur.findings, impression: cur.impression, conclusion: cur.conclusion,
        recommendations: cur.recommendations, report_data: (cur.report_data ?? undefined) as Prisma.InputJsonValue | undefined, reporter_name: cur.reporter_name,
        reporter_credentials: cur.reporter_credentials, patient_visible: cur.patient_visible, entered_by_id: user.id, entered_at: new Date(),
      },
      select: { id: true },
    });
    if (observations.length) {
      await tx.investigation_observations.createMany({
        data: observations.map((o) => ({
          id: newId(), result_id: created.id, analyte_code: o.analyte_code, name: o.name, loinc_code: o.loinc_code, value_numeric: o.value_numeric, value_text: o.value_text,
          unit: o.unit, ref_low: o.ref_low, ref_high: o.ref_high, ref_text: o.ref_text, flag: o.flag, is_critical: o.is_critical, sort_order: o.sort_order,
        })),
      });
    }
    return created.id;
  });
  await auditInvestigation(user, "INVESTIGATION_AMENDMENT_STARTED", itemId, { patientId: item.investigation_orders.patient_id, facilityId: facility.id, details: { reason, version: cur.version + 1 } });
  return id;
}

// ---------------------------------------------------------------------------
// What a viewer may see
// ---------------------------------------------------------------------------

/** Doctors see only the latest RELEASED version. Drafts and unverified results never leave the facility. */
export async function releasedResultFor(itemId: string) {
  return prisma.investigation_results.findFirst({
    where: { item_id: itemId, status: "RELEASED" },
    orderBy: { version: "desc" },
    include: {
      investigation_observations: { orderBy: { sort_order: "asc" } },
      investigation_media: { select: { id: true, file_name: true, mime_type: true, size_bytes: true, description: true, dicom_modality: true, study_instance_uid: true } },
      investigation_interpretations: { orderBy: { created_at: "desc" } },
    },
  });
}
