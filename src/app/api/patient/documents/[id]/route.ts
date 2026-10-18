import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { presignDownload, presignView, deleteObject } from "@/lib/storage";
import { findAccessibleDocument, updateDocumentSchema, auditDocumentAccess, looksLikeDeclaredType } from "@/lib/documents";
import { inspectObject } from "@/lib/storage";

/**
 * A single patient document: download (presigned, short-lived URL), edit
 * metadata, or soft-delete. Access is checked server-side on every call and
 * every access is audited.
 */

// GET /api/patient/documents/[id]?download=1 — presigned URL.
export const GET = withAuth(null, async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document } = await findAccessibleDocument(user, id);
  await auditDocumentAccess(user, document.id, document.patientId, "DOCUMENT_DOWNLOADED");
  const url = new URL(req.url).searchParams.get("download") === "1"
    ? await presignDownload(document.storageKey, document.fileName)
    : await presignView(document.storageKey, document.fileName);
  return NextResponse.json({ url, document: { id: document.id, fileName: document.fileName, mimeType: document.mimeType } });
});

// PATCH /api/patient/documents/[id] — edit metadata (patients and clinicians).
export const PATCH = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) return NextResponse.json({ error: "You cannot edit this document" }, { status: 403 });
  const body = await parseBody(req, updateDocumentSchema);
  const updated = await prisma.patientDocument.update({ where: { id }, data: body });
  await auditDocumentAccess(user, id, document.patientId, "DOCUMENT_UPDATED", { fields: Object.keys(body) });
  return NextResponse.json({ document: updated });
});

// DELETE /api/patient/documents/[id] — soft delete (patients and the uploader).
export const DELETE = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (_req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) return NextResponse.json({ error: "You cannot delete this document" }, { status: 403 });
  await prisma.patientDocument.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.documentShare.updateMany({ where: { documentId: id, revokedAt: null }, data: { revokedAt: new Date() } });
  await auditDocumentAccess(user, id, document.patientId, "DOCUMENT_DELETED");
  // The stored object is removed as well; the record keeps the audit trail.
  void deleteObject(document.storageKey);
  return NextResponse.json({ ok: true });
});

// POST /api/patient/documents/[id]/verify — confirm the upload landed and sniff
// the magic bytes against the declared type. (Convenience alias used by the UI.)
export const POST = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (_req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document } = await findAccessibleDocument(user, id);
  const meta = await inspectObject(document.storageKey);
  const plausible = looksLikeDeclaredType(meta.head, document.mimeType);
  if (!plausible) {
    await prisma.patientDocument.update({ where: { id }, data: { deletedAt: new Date() } });
    void deleteObject(document.storageKey);
    await auditDocumentAccess(user, id, document.patientId, "DOCUMENT_REJECTED_TYPE_MISMATCH");
    return NextResponse.json({ error: "The uploaded file did not match its declared type and was removed." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, sizeBytes: meta.sizeBytes });
});
