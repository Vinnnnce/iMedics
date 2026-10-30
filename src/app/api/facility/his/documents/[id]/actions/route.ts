import { NextResponse } from "next/server";
import { z } from "zod";
import type { SignatureRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, forbidden } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis, documentEvent } from "@/lib/his/audit";
import { loadFacilityDocument, signerProfile } from "@/lib/his/documents";
import { SIGNATURE_ROLES, parseDefinition, validateContent } from "@/lib/his/template-schema";
import { canPerform, contentHash, missingSignatures, signingRequirement, statusAfterSubmit, templateSignatureRoles, type DocumentAction } from "@/lib/his/workflow";
import { notifyUser } from "@/lib/notifications/service";
import { assertDocumentReadable } from "@/lib/his/visibility";
import { validateAttachments } from "@/lib/his/attachments";
import type { DocumentContent } from "@/lib/his/template-schema";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("review"), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("return"), reason: z.string().trim().min(3).max(1000) }),
  z.object({
    action: z.literal("sign"),
    role: z.enum(SIGNATURE_ROLES),
    /** For attested handwritten signatures (patient, representative, witness, interpreter). */
    signerName: z.string().trim().min(2).max(160).optional(),
    relationship: z.string().trim().max(80).optional(),
    attestation: z.literal(true).optional(),
  }),
  z.object({ action: z.literal("finalize") }),
  z.object({ action: z.literal("amend"), reason: z.string().trim().min(5).max(1000) }),
  z.object({ action: z.literal("release"), confirmProtected: z.boolean().optional() }),
  z.object({ action: z.literal("void"), reason: z.string().trim().min(5).max(1000) }),
]);

async function staffWithPermission(facilityId: string, permission: string, exclude: string) {
  const { permissionsForRole } = await import("@/lib/facility-staff");
  const staff = await prisma.facilityStaff.findMany({ where: { facilityId, status: "ACTIVE", userId: { not: null } }, select: { userId: true, facilityRole: true }, take: 200 });
  return staff.filter((s) => s.userId && s.userId !== exclude && (permissionsForRole(s.facilityRole) as readonly string[]).includes(permission)).map((s) => s.userId as string).slice(0, 20);
}

// POST /api/facility/his/documents/[id]/actions — document workflow transitions.
// Signatures are only ever recorded for the person actually signing (or, for
// wet-ink signatures, attested by the staff member who witnessed them).
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, null, req);
  const body = await parseBody(req, schema);
  const doc = await loadFacilityDocument(access.facility.id, parseId((await params).id));
  assertDocumentReadable(doc, user.id, hasPermission(access, "REVIEW_DOCUMENTS"));
  const def = parseDefinition(doc.templateVersion.definition);
  const action = body.action as DocumentAction;
  if (!canPerform(action, doc.status)) throw conflict(`Cannot ${action} a document in status ${doc.status}`);
  const need = (p: Parameters<typeof hasPermission>[1]) => {
    if (!hasPermission(access, p)) throw forbidden("Your role does not allow this action");
  };
  const guarded = async (fn: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => Promise<void>) =>
    prisma.$transaction(async (tx) => {
      // Optimistic concurrency: the status we validated must still be current.
      const locked = await tx.clinicalDocument.updateMany({ where: { id: doc.id, status: doc.status, updatedAt: doc.updatedAt }, data: { updatedAt: new Date() } });
      if (locked.count === 0) throw conflict("The document changed in the meantime — reload and try again");
      await fn(tx);
    });
  const now = new Date();
  const checkAttachments = () => validateAttachments(def, doc.content as DocumentContent, {
    facilityId: access.facility.id, patientId: doc.patientId, sensitivity: doc.sensitivity,
    canReview: hasPermission(access, "REVIEW_DOCUMENTS"),
  });
  let result: Record<string, unknown> = {};

  switch (body.action) {
    case "submit": {
      need("AUTHOR_DOCUMENTS");
      if (doc.authorId !== user.id) throw forbidden("Only the author can submit this document");
      const { errors } = validateContent(def, doc.content as Record<string, unknown>, { complete: true });
      if (errors.length) throw badRequest(errors.join("; "));
      await checkAttachments();
      const next = statusAfterSubmit(def);
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: next } });
        await documentEvent(tx, doc.id, "SUBMITTED", user.id, null, { content: doc.content ?? {}, hash: contentHash(doc.content) });
      });
      const recipients = next === "PENDING_REVIEW" ? await staffWithPermission(access.facility.id, "REVIEW_DOCUMENTS", user.id) : [];
      await Promise.all(recipients.map((id) => notifyUser(id, { kind: "CLINICAL_DOCUMENT_ACTION_NEEDED", documentId: doc.id, step: "REVIEW" }).catch(() => undefined)));
      result = { status: next };
      break;
    }
    case "review": {
      need("REVIEW_DOCUMENTS");
      if (def.workflow.independentReview && doc.authorId === user.id) throw forbidden("This document type requires review by someone other than the author");
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: "PENDING_SIGNATURE", reviewedById: user.id, reviewedAt: now } });
        await documentEvent(tx, doc.id, "REVIEWED", user.id, body.note ?? null);
      });
      await notifyUser(doc.authorId, { kind: "CLINICAL_DOCUMENT_ACTION_NEEDED", documentId: doc.id, step: "SIGNATURE" }).catch(() => undefined);
      break;
    }
    case "return": {
      if (doc.authorId !== user.id) need("REVIEW_DOCUMENTS");
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: "DRAFT", reviewedById: null, reviewedAt: null } });
        await tx.documentSignature.updateMany({ where: { documentId: doc.id, revokedAt: null }, data: { revokedAt: now, revokedReason: "Returned to draft for changes" } });
        await documentEvent(tx, doc.id, "RETURNED", user.id, body.reason);
      });
      break;
    }
    case "sign": {
      const role = body.role as SignatureRole;
      if (!templateSignatureRoles(def).includes(role)) throw badRequest("This document type does not take that signature");
      const { method, permission } = signingRequirement(role);
      need(permission);
      if (role === "AUTHOR" && doc.authorId !== user.id) throw forbidden("Only the author can sign as author");
      if ((role === "REVIEWER" || role === "VERIFIER") && def.workflow.independentReview && doc.authorId === user.id) {
        throw forbidden("This document requires an independent reviewing signatory");
      }
      const hash = contentHash(doc.content);
      if (doc.signatures.some((s) => !s.revokedAt && s.role === role && s.contentHash === hash && (method === "HANDWRITTEN_ATTESTED" || s.signerUserId === user.id))) {
        throw conflict("This signature is already recorded");
      }
      let signerName = user.name;
      let profile: { title: string | null; registrationId: string | null } = { title: null, registrationId: null };
      if (method === "HANDWRITTEN_ATTESTED") {
        if (!body.signerName || body.attestation !== true) throw badRequest("Enter the signer's name and confirm you witnessed their handwritten signature");
        if (role === "AUTHORIZED_REPRESENTATIVE" && !body.relationship) throw badRequest("Record the representative's relationship or legal authority");
        signerName = body.signerName;
      } else {
        profile = await signerProfile(user.id, access.facility.id);
      }
      await guarded(async (tx) => {
        await tx.documentSignature.create({
          data: {
            documentId: doc.id, role, method, signerName,
            signerUserId: method === "AUTHENTICATED_ELECTRONIC" ? user.id : null,
            attestedById: method === "HANDWRITTEN_ATTESTED" ? user.id : null,
            signerTitle: profile.title, registrationId: profile.registrationId, relationship: body.relationship ?? null,
            contentHash: hash, templateVersion: doc.templateVersion.version,
          },
        });
        await documentEvent(tx, doc.id, "SIGNED", user.id, `${role} · ${signerName}${method === "HANDWRITTEN_ATTESTED" ? " (handwritten, attested)" : ""}`);
      });
      break;
    }
    case "finalize": {
      need("SIGN_DOCUMENTS");
      const { errors } = validateContent(def, doc.content as Record<string, unknown>, { complete: true });
      if (errors.length) throw badRequest(errors.join("; "));
      await checkAttachments();
      const hash = contentHash(doc.content);
      const missing = missingSignatures(def, doc.signatures, hash);
      if (missing.length) throw badRequest(`Missing required signatures: ${missing.map((m) => m.label).join(", ")}`);
      if (def.workflow.requiresReview && !doc.reviewedAt) throw badRequest("This document must be reviewed before finalization");
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: "FINAL", finalizedAt: now, contentHash: hash } });
        if (doc.supersedesId) {
          await tx.clinicalDocument.update({ where: { id: doc.supersedesId }, data: { status: "AMENDED" } });
          await documentEvent(tx, doc.supersedesId, "SUPERSEDED", user.id, `Superseded by ${doc.documentNumber}`);
        }
        await documentEvent(tx, doc.id, "FINALIZED", user.id, null, { hash });
      });
      break;
    }
    case "amend": {
      need("AUTHOR_DOCUMENTS");
      if (doc.supersededBy) throw conflict(`An amendment already exists (${doc.supersededBy.documentNumber})`);
      const { nextSequence, formatNumber } = await import("@/lib/his/numbering");
      const created = await prisma.$transaction(async (tx) => {
        const settings = await tx.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { documentNumberPrefix: true } });
        const year = now.getUTCFullYear();
        const seq = await nextSequence(tx, access.facility.id, "document", year);
        const amendment = await tx.clinicalDocument.create({
          data: {
            facilityId: access.facility.id, patientId: doc.patientId, encounterId: doc.encounterId, admissionId: doc.admissionId,
            templateVersionId: doc.templateVersionId, documentNumber: formatNumber(settings?.documentNumberPrefix ?? "DOC", year, seq),
            title: doc.title, groupCode: doc.groupCode, department: doc.department, sensitivity: doc.sensitivity,
            content: doc.content ?? {}, revision: doc.revision + 1, supersedesId: doc.id, amendmentReason: body.reason, authorId: user.id,
          },
          select: { id: true, documentNumber: true },
        });
        await documentEvent(tx, amendment.id, "CREATED", user.id, `Amendment of ${doc.documentNumber}: ${body.reason}`);
        await documentEvent(tx, doc.id, "AMENDMENT_STARTED", user.id, `${amendment.documentNumber}: ${body.reason}`);
        return amendment;
      });
      result = { amendment: created };
      break;
    }
    case "release": {
      need("RELEASE_DOCUMENTS");
      if (doc.releasedToPatientAt) throw conflict("Already released");
      if (doc.sensitivity === "SPECIALLY_PROTECTED" && body.confirmProtected !== true) {
        throw badRequest("This is a specially protected record — confirm release complies with your hospital's policy");
      }
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { releasedToPatientAt: now, releasedById: user.id } });
        await documentEvent(tx, doc.id, "RELEASED", user.id);
      });
      if (doc.patient.userId) await notifyUser(doc.patient.userId, { kind: "CLINICAL_DOCUMENT_RELEASED", documentId: doc.id }).catch(() => undefined);
      break;
    }
    case "void": {
      if (doc.status === "FINAL") need("APPROVE_DOCUMENTS");
      else if (doc.authorId !== user.id) need("APPROVE_DOCUMENTS");
      await guarded(async (tx) => {
        await tx.clinicalDocument.update({ where: { id: doc.id }, data: { status: "ENTERED_IN_ERROR", voidReason: body.reason, releasedToPatientAt: null } });
        await documentEvent(tx, doc.id, "ENTERED_IN_ERROR", user.id, body.reason);
      });
      break;
    }
  }

  await auditHis(access, `HIS_DOCUMENT_${body.action.toUpperCase()}`, "ClinicalDocument", doc.id, req, { patientId: doc.patientId });
  return NextResponse.json({ ok: true, ...result });
});
