import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { forbidden } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { documentEvent } from "@/lib/his/audit";
import { buildDocumentView, loadFacilityDocument } from "@/lib/his/documents";
import { renderDocumentsPdf } from "@/lib/his/pdf";

export const runtime = "nodejs";

// GET /api/facility/his/documents/[id]/pdf — server-rendered PDF (draft/preliminary watermarked).
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const doc = await loadFacilityDocument(access.facility.id, parseId((await params).id));
  if (doc.sensitivity === "SPECIALLY_PROTECTED" && doc.authorId !== user.id && !access.permissions.includes("REVIEW_DOCUMENTS")) {
    throw forbidden("This record is specially protected");
  }
  const bytes = await renderDocumentsPdf([await buildDocumentView(doc)]);
  await prisma.$transaction((tx) => documentEvent(tx, doc.id, "PDF_DOWNLOADED", user.id));
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.documentNumber}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
});
