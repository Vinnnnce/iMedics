import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { findAccessibleDocument, auditDocumentAccess } from "@/lib/documents";

/**
 * Controlled sharing of a patient document with a specific platform user
 * (doctor, nurse, hospital account or caregiver). Only the patient (or the
 * uploading clinician) can grant or revoke a share, and every change is audited.
 */

const shareSchema = z.object({
  sharedWithUserId: z.string().uuid(),
  role: z.enum(["DOCTOR", "NURSE", "HOSPITAL", "CAREGIVER"]),
});

// POST /api/patient/documents/[id]/shares — grant access.
export const POST = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) return NextResponse.json({ error: "You cannot share this document" }, { status: 403 });
  const body = await parseBody(req, shareSchema);

  const recipient = await prisma.user.findUnique({ where: { id: body.sharedWithUserId }, select: { id: true, name: true, role: true } });
  if (!recipient) return NextResponse.json({ error: "Recipient not found" }, { status: 404 });
  if (recipient.id === user.id) return NextResponse.json({ error: "You already have access to this document" }, { status: 400 });

  // Upsert by natural key (documentId + sharedWithUserId).
  const existing = await prisma.documentShare.findFirst({
    where: { documentId: document.id, sharedWithUserId: recipient.id },
  });
  const saved = existing
    ? await prisma.documentShare.update({ where: { id: existing.id }, data: { revokedAt: null, role: body.role, grantedById: user.id, grantedAt: new Date() } })
    : await prisma.documentShare.create({
        data: { documentId: document.id, sharedWithUserId: recipient.id, role: body.role, grantedById: user.id },
      });

  await auditDocumentAccess(user, document.id, document.patientId, "DOCUMENT_SHARED", { withUserId: recipient.id, role: body.role });
  return NextResponse.json({ share: saved, recipient: { id: recipient.id, name: recipient.name } }, { status: 201 });
});

// DELETE /api/patient/documents/[id]/shares?userId=... — revoke access.
export const DELETE = withAuth(["PATIENT", "DOCTOR", "ADMIN"], async (req: NextRequest, { params, user }) => {
  const { id } = await params;
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) return NextResponse.json({ error: "You cannot manage this document's sharing" }, { status: 403 });
  const userId = new URL(req.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const updated = await prisma.documentShare.updateMany({
    where: { documentId: document.id, sharedWithUserId: userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await auditDocumentAccess(user, document.id, document.patientId, "DOCUMENT_SHARE_REVOKED", { fromUserId: userId });
  return NextResponse.json({ revoked: updated.count });
});
