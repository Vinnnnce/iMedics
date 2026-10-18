import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { conflict, notFound } from "@/lib/errors";
import { deleteObject } from "@/lib/storage";
import { findApplication } from "@/lib/verification";
import { writeAudit } from "@/lib/audit";

// DELETE /api/me/documents/[id] — remove one of your own verification documents before you are verified.
// Onboarding is explicitly allowed: awaiting-review accounts are never ACTIVE.
export const DELETE = withAuth<{ id: string }>(
  null,
  async (req, { user, params }) => {
    const id = parseId((await params).id);
    const application = await findApplication(user.id);
    if (application?.verificationStatus === "VERIFIED")
      throw conflict("Your account is already verified");

    const document = await prisma.verificationDocument.findFirst({
      where: { id, userId: user.id },
      select: { id: true, key: true },
    });
    if (!document) throw notFound("Document not found");

    await prisma.verificationDocument.delete({ where: { id } });
    await deleteObject(document.key);
    await writeAudit({
      userId: user.id,
      actorRole: user.role,
      action: "VERIFICATION_DOCUMENT_REMOVED",
      resourceType: "User",
      resourceId: user.id,
      req,
    });
    return NextResponse.json({ success: true });
  },
  { allowOnboarding: true },
);
