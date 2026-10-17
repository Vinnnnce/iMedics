import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload, presignView } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { kindLabel } from "@/lib/verification";

// GET /api/admin/users/[id]/documents/[docId]?download=1 — a short-lived link to one verification document.
// Every open is written to the audit log, because these are identity documents.
export const GET = withAuth<{ id: string; docId: string }>(["ADMIN"], async (req, { user, params }) => {
  const { id, docId } = await params;
  const document = await prisma.verificationDocument.findFirst({
    where: { id: parseId(docId), userId: parseId(id) },
    select: { id: true, key: true, kind: true, fileName: true, mimeType: true },
  });
  if (!document) throw notFound("Document not found");

  const download = new URL(req.url).searchParams.get("download") === "1";
  const url = download ? await presignDownload(document.key, document.fileName) : await presignView(document.key, document.fileName);

  await writeAudit({
    userId: user.id, actorRole: user.role, action: "ADMIN_VIEWED_VERIFICATION_DOCUMENTS", resourceType: "User", resourceId: id,
    details: { documentId: document.id, kind: kindLabel(document.kind), download }, req,
  });
  return NextResponse.json({ url, fileName: document.fileName, mimeType: document.mimeType, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});
