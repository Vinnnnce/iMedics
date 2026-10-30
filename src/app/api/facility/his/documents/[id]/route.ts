import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest, conflict, forbidden } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { auditHis, documentEvent } from "@/lib/his/audit";
import { buildDocumentView, loadFacilityDocument } from "@/lib/his/documents";
import { parseDefinition, validateContent } from "@/lib/his/template-schema";
import { validateAttachments } from "@/lib/his/attachments";

const saveSchema = z.object({
  content: z.record(z.string(), z.unknown()),
  department: z.string().trim().max(120).nullish(),
  /** Autosave events are not added to the document trail (the final save is). */
  autosave: z.boolean().optional(),
});

// GET /api/facility/his/documents/[id] — the document, its signatures and workflow trail.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const doc = await loadFacilityDocument(access.facility.id, parseId((await params).id));
  if (doc.sensitivity === "SPECIALLY_PROTECTED" && doc.authorId !== user.id && !access.permissions.includes("REVIEW_DOCUMENTS")) {
    throw forbidden("This record is specially protected");
  }
  await auditHis(access, "HIS_DOCUMENT_VIEWED", "ClinicalDocument", doc.id, req, { patientId: doc.patientId });
  return NextResponse.json({ document: await buildDocumentView(doc) });
});

// PUT /api/facility/his/documents/[id] — save a DRAFT (author only). Content is
// validated against the template; required fields are enforced at submission.
export const PUT = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "AUTHOR_DOCUMENTS", req);
  const doc = await loadFacilityDocument(access.facility.id, parseId((await params).id));
  if (doc.status !== "DRAFT") throw conflict("Only drafts can be edited — finalized documents are corrected by amendment");
  if (doc.authorId !== user.id) throw forbidden("Only the author can edit this draft");
  const body = await parseBody(req, saveSchema);
  const definition = parseDefinition(doc.templateVersion.definition);
  const { content, errors } = validateContent(definition, body.content, { complete: false });
  if (errors.length) throw badRequest(errors.join("; "));
  await validateAttachments(definition, content, {
    facilityId: access.facility.id, patientId: doc.patientId, sensitivity: doc.sensitivity,
    canReview: access.permissions.includes("REVIEW_DOCUMENTS"),
  });

  await prisma.$transaction(async (tx) => {
    const updated = await tx.clinicalDocument.updateMany({
      where: { id: doc.id, status: "DRAFT", updatedAt: doc.updatedAt },
      data: { content, ...(body.department !== undefined ? { department: body.department } : {}) },
    });
    if (updated.count === 0) throw conflict("The document changed in the meantime — reload and try again");
    if (!body.autosave) await documentEvent(tx, doc.id, "SAVED", user.id);
  });
  if (!body.autosave) await auditHis(access, "HIS_DOCUMENT_SAVED", "ClinicalDocument", doc.id, req, { patientId: doc.patientId });
  return NextResponse.json({ ok: true });
});
