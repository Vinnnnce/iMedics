import { NextResponse } from "next/server";
import { withAuth, parseId } from "@/lib/api";
import { findViewableConsultation } from "@/lib/consultation-access";
import { renderConsultationPdf } from "@/lib/consultation-report";
import { writeAudit } from "@/lib/audit";

// GET /api/consultations/[id]/pdf — download a consultation report as a PDF.
// Same access as the report itself: the writing doctor (or a doctor with the
// patient in their care) and the patient, who only receives finalized reports.
export const GET = withAuth<{ id: string }>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const id = parseId((await params).id);
  const consultation = await findViewableConsultation(user, id);
  const bytes = await renderConsultationPdf(consultation);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "CONSULTATION_PDF_DOWNLOADED",
    resourceType: "Consultation",
    resourceId: id,
    details: { revision: consultation.revision },
    req,
  });

  const date = (consultation.finalizedAt ?? consultation.createdAt).toISOString().slice(0, 10);
  const fileName = `consultation-${consultation.patient.caseNumber}-${date}.pdf`.replace(/[^A-Za-z0-9._-]/g, "_");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
});
