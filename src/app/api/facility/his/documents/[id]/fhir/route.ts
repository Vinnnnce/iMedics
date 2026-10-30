import { withAuth, parseId } from "@/lib/api";
import { conflict } from "@/lib/errors";
import { requireHisAccess, hasPermission } from "@/lib/his/access";
import { documentEvent } from "@/lib/his/audit";
import { buildDocumentView, loadFacilityDocument } from "@/lib/his/documents";
import { documentFhirBundle } from "@/lib/his/fhir";
import { assertDocumentReadable } from "@/lib/his/visibility";
import { prisma } from "@/lib/prisma";

export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const doc = await loadFacilityDocument(access.facility.id, parseId((await params).id));
  assertDocumentReadable(doc, user.id, hasPermission(access, "REVIEW_DOCUMENTS"));
  if (!["FINAL", "AMENDED"].includes(doc.status)) throw conflict("Finalize this document before exporting it");
  const view = await buildDocumentView(doc);
  // Do not trust the incoming Host header to construct an attachment URL.
  const base = process.env.APP_URL;
  const path = `/api/facility/his/documents/${doc.id}/pdf`;
  const pdfUrl = base ? new URL(path, base).toString() : path;
  const bundle = documentFhirBundle(view, pdfUrl);
  await prisma.$transaction((tx) => documentEvent(tx, doc.id, "FHIR_EXPORTED", user.id));
  return new Response(JSON.stringify(bundle, null, 2), { headers: {
    "Content-Type": "application/fhir+json; charset=utf-8",
    "Content-Disposition": `attachment; filename="clinical-document-${doc.id}.fhir.json"`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
});
