import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { assertPatientLinked, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { renderDocumentsPdf } from "@/lib/his/pdf";
import { assertDocumentReadable } from "@/lib/his/visibility";

export const runtime = "nodejs";

const schema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(50),
  /** The patient's authorization reference (e.g. signed records-release form number). */
  authorizationReference: z.string().trim().min(3).max(120),
});

// POST /api/facility/his/patients/[id]/package — export selected FINAL documents
// as one PDF with an index and manifest. Restricted to RELEASE_DOCUMENTS and
// requires a recorded patient authorization reference; fully audited.
export const POST = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "RELEASE_DOCUMENTS", req);
  const patientId = parseId((await params).id);
  await assertPatientLinked(access.facility.id, patientId);
  const body = await parseBody(req, schema);
  const docs = await prisma.clinicalDocument.findMany({
    where: { id: { in: body.documentIds }, facilityId: access.facility.id, patientId, status: { in: ["FINAL", "AMENDED"] } },
    include: documentInclude,
    orderBy: { createdAt: "asc" },
  });
  if (docs.length !== body.documentIds.length) throw badRequest("Only finalized documents of this patient can be exported");
  for (const doc of docs) assertDocumentReadable(doc, user.id, access.permissions.includes("REVIEW_DOCUMENTS"));
  const views = await Promise.all(docs.map(buildDocumentView));
  const bytes = await renderDocumentsPdf(views, { manifestTitle: `Medical records package · authorization ${body.authorizationReference}` });
  await prisma.clinicalDocumentEvent.createMany({ data: docs.map((d) => ({ documentId: d.id, action: "EXPORTED", actorId: user.id, note: body.authorizationReference })) });
  await auditHis(access, "HIS_RECORDS_PACKAGE_EXPORTED", "Patient", patientId, req, { patientId, details: { count: docs.length, authorization: body.authorizationReference } });
  return new Response(Buffer.from(bytes), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="records-package.pdf"` },
  });
});
