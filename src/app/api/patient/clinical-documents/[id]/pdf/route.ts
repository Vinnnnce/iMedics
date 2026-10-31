import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { documentEvent } from "@/lib/his/audit";
import { buildDocumentView, documentInclude } from "@/lib/his/documents";
import { renderDocumentsPdf } from "@/lib/his/pdf";
import { visibleToPatient } from "@/lib/his/workflow";

export const runtime = "nodejs";

// GET /api/patient/clinical-documents/[id]/pdf — PDF of a released document (own record only).
export const GET = withAuth<{ id: string }>(["PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  const doc = patient ? await prisma.clinicalDocument.findFirst({ where: { id, patientId: patient.id }, include: documentInclude }) : null;
  if (!doc || !visibleToPatient(doc)) throw notFound("Document not found");
  const view = await buildDocumentView(doc);
  const bytes = await renderDocumentsPdf([view]);
  await prisma.$transaction((tx) => documentEvent(tx, doc.id, "PATIENT_DOWNLOADED", user.id));
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${doc.documentNumber}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
});
