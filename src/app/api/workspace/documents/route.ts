import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { badRequest, notFound } from "@/lib/errors";
import { presignDownload, presignUpload } from "@/lib/storage";
import { safeFileName, uploadRequestSchema } from "@/lib/uploads";
import { extensionAudit } from "@/lib/workspace/extensions";
import { sealWorkspaceUpload } from "@/lib/workspace/storage";
import { queueNotification } from "@/lib/notifications/service";

type DocumentRow = { id: string; owner_id: string; storage_key: string; file_name: string; mime_type: string; size_bytes: number; confirmed_at: Date | null; created_at: Date };
export const GET = withAuth(["PATIENT", "DOCTOR"], async (req, { user }) => {
  await extensionAudit(user, "WORKSPACE_DOCUMENTS_READ");
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    z.uuid().parse(id);
    // Consent permits only this specific document, not access to a whole case file.
    const rows = await prisma.$queryRaw<DocumentRow[]>`
      SELECT d.* FROM workspace_documents d WHERE d.id = ${id}::uuid AND d.confirmed_at IS NOT NULL AND
      (d.owner_id = ${user.id}::uuid OR EXISTS (
        SELECT 1 FROM workspace_shares s JOIN doctor_profiles p ON p.user_id = s.recipient_id
        WHERE s.document_id = d.id AND s.recipient_id = ${user.id}::uuid
        AND s.revoked_at IS NULL AND s.expires_at > now() AND p.verification_status = 'VERIFIED'
      ))`;
    if (!rows[0]) throw notFound("Document not found");
    await extensionAudit(user, "WORKSPACE_DOCUMENT_DOWNLOAD", id);
    return Response.json({ url: await presignDownload(rows[0].storage_key, rows[0].file_name), expiresInSeconds: 60 }, { headers: { "Cache-Control": "private, no-store" } });
  }
  const documents = await prisma.$queryRaw<Omit<DocumentRow, "storage_key" | "owner_id">[]>`
    SELECT d.id, d.file_name, d.mime_type, d.size_bytes, d.confirmed_at, d.created_at
    FROM workspace_documents d WHERE d.confirmed_at IS NOT NULL AND (d.owner_id = ${user.id}::uuid OR EXISTS(
      SELECT 1 FROM workspace_shares s JOIN doctor_profiles p ON p.user_id = s.recipient_id
      WHERE s.document_id = d.id AND s.recipient_id = ${user.id}::uuid
      AND s.revoked_at IS NULL AND s.expires_at > now() AND p.verification_status = 'VERIFIED'
    )) ORDER BY d.created_at DESC LIMIT 100`;
  const shares = await prisma.$queryRaw<{ id: string; document_id: string; recipient_name: string; expires_at: Date; revoked_at: Date | null }[]>`
    SELECT s.id, s.document_id, u.name AS recipient_name, s.expires_at, s.revoked_at
    FROM workspace_shares s JOIN users u ON u.id = s.recipient_id WHERE s.owner_id = ${user.id}::uuid ORDER BY s.created_at DESC LIMIT 100`;
  return Response.json({ documents, shares }, { headers: { "Cache-Control": "private, no-store" } });
});

const actionSchema = z.discriminatedUnion("action", [
  uploadRequestSchema.extend({ action: z.literal("initiate") }),
  z.object({ action: z.literal("confirm"), id: z.uuid() }),
  z.object({ action: z.literal("share"), id: z.uuid(), doctorId: z.uuid(), days: z.number().int().min(1).max(30), consent: z.literal(true) }),
  z.object({ action: z.literal("revoke"), shareId: z.uuid() }),
]);
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const body = await parseBody(req, actionSchema);
  if (body.action === "initiate") {
    const id = randomUUID();
    const key = `workspace-records/${user.id}/${randomUUID()}`;
    const url = await presignUpload(key, body.mimeType, body.sizeBytes);
    await extensionAudit(user, "WORKSPACE_UPLOAD_INITIATED", id);
    await prisma.$executeRaw`INSERT INTO workspace_documents(id, owner_id, storage_key, file_name, mime_type, size_bytes)
      VALUES(${id}::uuid, ${user.id}::uuid, ${key}, ${safeFileName(body.fileName)}, ${body.mimeType}, ${body.sizeBytes})`;
    return Response.json({ id, uploadUrl: url }, { status: 201 });
  }
  if (body.action === "revoke") {
    await extensionAudit(user, "WORKSPACE_CONSENT_REVOKED", body.shareId);
    const count = await prisma.$executeRaw`UPDATE workspace_shares SET revoked_at = now() WHERE id = ${body.shareId}::uuid AND owner_id = ${user.id}::uuid`;
    if (!count) throw notFound("Share not found");
    return Response.json({ success: true });
  }
  const rows = await prisma.$queryRaw<DocumentRow[]>`SELECT * FROM workspace_documents WHERE id = ${body.id}::uuid AND owner_id = ${user.id}::uuid`;
  const document = rows[0];
  if (!document) throw notFound("Document not found");
  if (body.action === "confirm") {
    if (document.confirmed_at) return Response.json({ success: true });
    const finalKey = await sealWorkspaceUpload(document.storage_key, user.id, document.mime_type, document.size_bytes);
    await extensionAudit(user, "WORKSPACE_UPLOAD_CONFIRMED", body.id);
    await prisma.$executeRaw`UPDATE workspace_documents SET confirmed_at = now(), storage_key = ${finalKey} WHERE id = ${body.id}::uuid AND owner_id = ${user.id}::uuid`;
    return Response.json({ success: true });
  }
  if (!document.confirmed_at) throw badRequest("Confirm the upload before sharing");
  const doctor = await prisma.doctorProfile.findFirst({ where: { id: body.doctorId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } }, select: { userId: true } });
  if (!doctor || doctor.userId === user.id) throw badRequest("Choose a verified doctor");
  const id = randomUUID();
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`INSERT INTO workspace_shares(id, document_id, owner_id, recipient_id, expires_at)
      VALUES(${id}::uuid, ${body.id}::uuid, ${user.id}::uuid, ${doctor.userId}::uuid, ${new Date(Date.now() + body.days * 86400000)})`;
    await tx.auditLog.create({ data: { userId: user.id, actorRole: user.role, action: "WORKSPACE_CONSENT_GRANTED", resourceType: "WorkspaceShare", resourceId: id, details: { days: body.days } } });
  });
  await queueNotification(doctor.userId, { kind: "DOCUMENT_SHARED" });
  return Response.json({ id }, { status: 201 });
});
