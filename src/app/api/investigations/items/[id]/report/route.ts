import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { renderReportPdf } from "@/lib/investigations/pdf";
import { REPORT_FORMAT_LABEL, PRIORITY_LABEL } from "@/lib/investigations/constants";
import { auditInvestigation } from "@/lib/investigations/service";
import { formatClinicDateTime, formatDate } from "@/lib/format";

type Params = { id: string };

// GET /api/investigations/items/[id]/report — PDF of the latest RELEASED version. Doctors with a care
// relationship and the patient (only when the report is patient-visible) may download; nothing
// unreleased is ever rendered.
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const itemId = parseId((await params).id);
  const item = await prisma.investigation_order_items.findUnique({
    where: { id: itemId },
    include: { order: { include: { patient: true, requestedBy: { select: { name: true } } } }, performingFacility: { select: { laboratoryName: true } } },
  });
  if (!item) throw notFound("Report not found");
  if (user.role === "DOCTOR" && item.order.requestedById !== user.id) await findAccessiblePatient(user, item.order.patientId).catch(() => { throw notFound("Report not found"); });
  if (user.role === "PATIENT") await findAccessiblePatient(user, item.order.patientId).catch(() => { throw notFound("Report not found"); });

  const result = await prisma.investigation_results.findFirst({ where: { itemId, status: "RELEASED", ...(user.role === "PATIENT" ? { patientVisible: true } : {}) }, orderBy: { version: "desc" }, include: { observations: { orderBy: { sortOrder: "asc" } } } });
  if (!result) throw notFound("No released report is available");

  const p = item.order.patient;
  const bytes = await renderReportPdf({
    title: `${item.nameSnapshot} - ${REPORT_FORMAT_LABEL[item.reportFormat]}`,
    facilityName: item.performingFacility?.laboratoryName ?? "Medic1905 facility",
    orderNumber: item.order.orderNumber,
    patient: { name: `${p.firstName} ${p.lastName}`, caseNumber: p.caseNumber, sex: p.gender, dateOfBirth: formatDate(p.dateOfBirth) },
    requestedBy: item.order.requestedBy.name, priority: PRIORITY_LABEL[item.priority],
    indication: result.clinicalIndication ?? item.order.clinicalIndication, technique: result.technique, findings: result.findings, impression: result.impression, conclusion: result.conclusion, recommendations: result.recommendations,
    observations: result.observations.map((o) => ({ name: o.name, value: o.valueNumeric != null ? String(o.valueNumeric) : (o.valueText ?? ""), unit: o.unit, range: o.refText, flag: o.flag })),
    reporter: result.reporterName, credentials: result.reporterCredentials,
    verifiedAt: result.verifiedAt ? formatClinicDateTime(result.verifiedAt) : null, signedAt: result.signedAt ? formatClinicDateTime(result.signedAt) : null, releasedAt: result.releasedAt ? formatClinicDateTime(result.releasedAt) : null,
    version: result.version, amendmentReason: result.amendmentReason,
  });
  await auditInvestigation(user, "INVESTIGATION_REPORT_DOWNLOADED", itemId, { patientId: item.order.patientId, req });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${item.order.orderNumber}-${item.id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
});
