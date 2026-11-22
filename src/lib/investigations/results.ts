import { z } from "zod";
import type { InvestigationItemStatus, Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { evaluateFlag, rangeText } from "./flags";
import { auditInvestigation, facilityRecipients, notifySafely, recordStatus, refreshOrderStatus } from "./service";
import { raiseCriticalAlert } from "./alerts";

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

async function loadItem(itemId: string, facilityId: string) {
  const item = await prisma.investigation_order_items.findFirst({
    where: { id: itemId, performingFacilityId: facilityId },
    include: { order: { select: { id: true, patientId: true, requestedById: true, domain: true } }, results: { orderBy: { version: "desc" } } },
  });
  if (!item) throw notFound("Investigation not found");
  return item;
}

const current = (item: Item) => item.results.find((r) => r.isCurrent) ?? null;

/** Step a (non-amendment) item to `to`, writing history. No-op when the item is already past release (amendment). */
async function moveItem(tx: Prisma.TransactionClient, item: Item, to: InvestigationItemStatus, user: User, note?: string, options: { force?: boolean } = {}) {
  if (item.status === to) return;
  if (!options.force && AFTER_RELEASE.includes(item.status)) return;
  await tx.investigation_order_items.update({ where: { id: item.id }, data: { status: to, statusChangedAt: new Date() } });
  await recordStatus(tx, item.id, item.status, to, { userId: user.id }, note);
  item.status = to;
  await refreshOrderStatus(tx, item.orderId);
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
  if (item.reportFormat === "LAB_PANEL" && input.observations.length === 0 && !input.findings) throw badRequest("Enter at least one result");

  const rows = input.observations.map((o, i) => {
    const f = evaluateFlag({ value: o.valueNumeric, refLow: o.refLow, refHigh: o.refHigh, criticalLow: o.criticalLow, criticalHigh: o.criticalHigh });
    return {
      analyteCode: o.analyteCode ?? null, name: o.name, loincCode: o.loincCode ?? null, valueNumeric: o.valueNumeric ?? null, valueText: o.valueText ?? null,
      unit: o.unit ?? null, refLow: o.refLow ?? null, refHigh: o.refHigh ?? null, refText: o.refText ?? rangeText(o.refLow, o.refHigh), flag: f.flag, isCritical: f.isCritical, sortOrder: i,
    };
  });
  const content = {
    clinicalIndication: input.clinicalIndication ?? null, technique: input.technique ?? null, findings: input.findings ?? null, impression: input.impression ?? null,
    conclusion: input.conclusion ?? null, recommendations: input.recommendations ?? null, reportData: (input.reportData ?? undefined) as Prisma.InputJsonValue | undefined,
    reporterName: input.reporterName ?? null, reporterCredentials: input.reporterCredentials ?? null, patientVisible: input.patientVisible ?? true,
  };

  const resultId = await prisma.$transaction(async (tx) => {
    let id: string;
    if (cur) {
      await tx.investigation_observations.deleteMany({ where: { resultId: cur.id } });
      await tx.investigation_results.update({ where: { id: cur.id }, data: { ...content, status: "DRAFT", enteredById: user.id, enteredAt: new Date() } });
      id = cur.id;
    } else {
      const created = await tx.investigation_results.create({ data: { itemId, version: 1, isCurrent: true, status: "DRAFT", ...content, enteredById: user.id, enteredAt: new Date() }, select: { id: true } });
      id = created.id;
    }
    if (rows.length) await tx.investigation_observations.createMany({ data: rows.map((r) => ({ ...r, resultId: id })) });
    if (item.domain === "LABORATORY") await moveItem(tx, item, "RESULT_ENTERED", user);
    else if (["EXAM_COMPLETED", "MEDIA_UPLOADED"].includes(item.status)) await moveItem(tx, item, "AWAITING_INTERPRETATION", user);
    return id;
  });
  await auditInvestigation(user, "INVESTIGATION_RESULT_SAVED", itemId, { patientId: item.order.patientId, facilityId: facility.id });
  return resultId;
}

export async function submitForVerification(user: User, facility: Facility, itemId: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "DRAFT") throw conflict("There is no draft result to submit");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "AWAITING_VERIFICATION" } });
    await moveItem(tx, item, "AWAITING_VERIFICATION", user);
  });
  await notifySafely((await facilityRecipients(facility.id, "VERIFY_RESULTS")).filter((id) => id !== user.id), { kind: "INVESTIGATION_UPDATED", orderId: item.orderId });
  await auditInvestigation(user, "INVESTIGATION_SUBMITTED_FOR_VERIFICATION", itemId, { patientId: item.order.patientId, facilityId: facility.id });
}

const selfVerificationAllowed = () => process.env.INVESTIGATION_ALLOW_SELF_VERIFICATION === "true";

/** Maker-checker: the person who entered a result cannot verify it (unless the facility policy allows). */
export async function verifyResult(user: User, facility: Facility, itemId: string, decision: { approve: boolean; note?: string }) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "AWAITING_VERIFICATION") throw conflict("There is no result awaiting verification");
  if (cur.enteredById === user.id && !selfVerificationAllowed()) throw forbidden("A result must be verified by a different professional from the one who entered it");

  if (!decision.approve) {
    if (!decision.note?.trim()) throw badRequest("Give a reason for returning the result");
    await prisma.$transaction(async (tx) => {
      await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "DRAFT" } });
      await moveItem(tx, item, item.domain === "LABORATORY" ? "RESULT_ENTERED" : "AWAITING_INTERPRETATION", user, decision.note);
    });
    await auditInvestigation(user, "INVESTIGATION_RESULT_RETURNED", itemId, { patientId: item.order.patientId, facilityId: facility.id, details: { note: decision.note } });
    return { returned: true as const };
  }

  const critical = await prisma.investigation_observations.count({ where: { resultId: cur.id, isCritical: true } });
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "VERIFIED", verifiedById: user.id, verifiedAt: new Date() } });
    await moveItem(tx, item, "VERIFIED", user);
  });
  if (critical > 0) await raiseCriticalAlert({ resultId: cur.id, itemId, patientId: item.order.patientId, orderId: item.orderId, doctorUserId: item.order.requestedById, facilityId: facility.id, count: critical });
  await auditInvestigation(user, "INVESTIGATION_RESULT_VERIFIED", itemId, { patientId: item.order.patientId, facilityId: facility.id, details: { critical } });
  return { returned: false as const, critical };
}

export async function signResult(user: User, facility: Facility, itemId: string, statement: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "VERIFIED") throw conflict("Only a verified result can be signed");
  if (!statement.trim()) throw badRequest("A signature statement is required");
  await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "SIGNED", signedById: user.id, signedAt: new Date(), signatureStatement: statement, reporterName: cur.reporterName ?? user.name } });
    await moveItem(tx, item, "SIGNED", user);
  });
  await auditInvestigation(user, "INVESTIGATION_REPORT_SIGNED", itemId, { patientId: item.order.patientId, facilityId: facility.id });
}

export async function releaseResult(user: User, facility: Facility, itemId: string) {
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "SIGNED") throw conflict("Only a signed report can be released");
  const patient = await prisma.patient.findUnique({ where: { id: item.order.patientId }, select: { userId: true } });
  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.investigation_results.updateMany({ where: { itemId, id: { not: cur.id }, status: "RELEASED" }, data: { status: "SUPERSEDED" } });
    await tx.investigation_results.update({ where: { id: cur.id }, data: { status: "RELEASED", releasedAt: now, releasedById: user.id } });
    if (!AFTER_RELEASE.includes(item.status)) {
      await moveItem(tx, item, "RELEASED", user, undefined, { force: true });
      await moveItem(tx, item, "DELIVERED", user, "Delivered to the requesting doctor and the patient record", { force: true });
    }
  });
  await notifySafely([item.order.requestedById], { kind: "INVESTIGATION_REPORT_RELEASED", orderId: item.orderId });
  if (cur.patientVisible && patient?.userId) await notifySafely([patient.userId], { kind: "INVESTIGATION_REPORT_RELEASED", orderId: item.orderId });
  await auditInvestigation(user, "INVESTIGATION_REPORT_RELEASED", itemId, { patientId: item.order.patientId, facilityId: facility.id, details: { version: cur.version } });
}

/** Start an amendment of a released report: appends a new version, never edits the signed one. */
export async function startAmendment(user: User, facility: Facility, itemId: string, reason: string) {
  if (reason.trim().length < 5) throw badRequest("Give a reason for the amendment");
  const item = await loadItem(itemId, facility.id);
  const cur = current(item);
  if (!cur || cur.status !== "RELEASED") throw conflict("Only a released report can be amended");
  const observations = await prisma.investigation_observations.findMany({ where: { resultId: cur.id }, orderBy: { sortOrder: "asc" } });
  const id = await prisma.$transaction(async (tx) => {
    await tx.investigation_results.update({ where: { id: cur.id }, data: { isCurrent: false } });
    const created = await tx.investigation_results.create({
      data: {
        itemId, version: cur.version + 1, isCurrent: true, status: "DRAFT", amendmentReason: reason,
        clinicalIndication: cur.clinicalIndication, technique: cur.technique, findings: cur.findings, impression: cur.impression, conclusion: cur.conclusion,
        recommendations: cur.recommendations, reportData: (cur.reportData ?? undefined) as Prisma.InputJsonValue | undefined, reporterName: cur.reporterName,
        reporterCredentials: cur.reporterCredentials, patientVisible: cur.patientVisible, enteredById: user.id, enteredAt: new Date(),
      },
      select: { id: true },
    });
    if (observations.length) await tx.investigation_observations.createMany({ data: observations.map((o) => ({ analyteCode: o.analyteCode, name: o.name, loincCode: o.loincCode, valueNumeric: o.valueNumeric, valueText: o.valueText, unit: o.unit, refLow: o.refLow, refHigh: o.refHigh, refText: o.refText, flag: o.flag, isCritical: o.isCritical, sortOrder: o.sortOrder, resultId: created.id })) });
    return created.id;
  });
  await auditInvestigation(user, "INVESTIGATION_AMENDMENT_STARTED", itemId, { patientId: item.order.patientId, facilityId: facility.id, details: { reason, version: cur.version + 1 } });
  return id;
}

// ---------------------------------------------------------------------------
// What a viewer may see
// ---------------------------------------------------------------------------

/** Doctors see only the latest RELEASED version. Drafts and unverified results never leave the facility. */
export async function releasedResultFor(itemId: string) {
  return prisma.investigation_results.findFirst({
    where: { itemId, status: "RELEASED" },
    orderBy: { version: "desc" },
    include: { observations: { orderBy: { sortOrder: "asc" } }, media: { select: { id: true, fileName: true, mimeType: true, sizeBytes: true, description: true, dicomModality: true, studyInstanceUid: true } }, interpretations: { orderBy: { createdAt: "desc" } } },
  });
}
