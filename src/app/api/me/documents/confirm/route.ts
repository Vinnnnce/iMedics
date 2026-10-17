import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { badRequest, conflict } from "@/lib/errors";
import { MAX_VERIFICATION_DOCUMENTS, safeFileName, verificationConfirmSchema, verifyUpload } from "@/lib/uploads";
import { findApplication } from "@/lib/verification";
import { writeAudit } from "@/lib/audit";

// POST /api/me/documents/confirm — step 2: check the uploaded object and attach it to the application.
export const POST = withAuth(null, async (req, { user }) => {
  const { key, mimeType, fileName, kind } = await parseBody(req, verificationConfirmSchema);
  if (!key.startsWith(`verification/${user.id}/`)) throw badRequest("Invalid upload key");

  const application = await findApplication(user.id);
  if (!application) throw conflict("Complete your professional registration first");
  if (application.verificationStatus === "VERIFIED") throw conflict("Your account is already verified");
  if (await prisma.verificationDocument.findUnique({ where: { key }, select: { id: true } })) throw conflict("This document is already attached");
  if ((await prisma.verificationDocument.count({ where: { userId: user.id } })) >= MAX_VERIFICATION_DOCUMENTS) throw conflict("Document limit reached");

  const { sizeBytes } = await verifyUpload(key, mimeType);
  const document = await prisma.verificationDocument.create({
    data: { userId: user.id, kind, key, fileName: safeFileName(fileName), mimeType, sizeBytes },
    select: { id: true, kind: true, fileName: true, sizeBytes: true, createdAt: true },
  });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "VERIFICATION_DOCUMENT_ADDED", resourceType: "User", resourceId: user.id, details: { kind }, req });
  return NextResponse.json({ document }, { status: 201 });
});
