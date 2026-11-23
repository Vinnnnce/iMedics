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
    include: { investigation_orders: { include: { patients: true, users: { select: { name: true } } } }, lab_staff_profiles: { select: { laboratoryName: true } } },
  });
  if (!item) throw notFound("Report not found");
  const order = item.investigation_orders;
  if (user.role === "DOCTOR" && order.requested_by_id !== user.id) await findAccessiblePatient(user, order.patient_id).catch(() => { throw notFound("Report not found"); });
  if (user.role === "PATIENT") await findAccessiblePatient(user, order.patient_id).catch(() => { throw notFound("Report not found"); });

  const result = await prisma.investigation_results.findFirst({ where: { item_id: itemId, status: "RELEASED", ...(user.role === "PATIENT" ? { patient_visible: true } : {}) }, orderBy: { version: "desc" }, include: { investigation_observations: { orderBy: { sort_order: "asc" } } } });
  if (!result) throw notFound("No released report is available");

  const p = order.patients;
  const bytes = await renderReportPdf({
    title: `${item.name_snapshot} - ${REPORT_FORMAT_LABEL[item.report_format]}`,
    facilityName: item.lab_staff_profiles?.laboratoryName ?? "Medic1905 facility",
    orderNumber: order.order_number,
    patient: { name: `${p.firstName} ${p.lastName}`, caseNumber: p.caseNumber, sex: p.gender, dateOfBirth: formatDate(p.dateOfBirth) },
    requestedBy: order.users.name, priority: PRIORITY_LABEL[item.priority],
    indication: result.clinical_indication ?? order.clinical_indication, technique: result.technique, findings: result.findings, impression: result.impression, conclusion: result.conclusion, recommendations: result.recommendations,
    observations: result.investigation_observations.map((o) => ({ name: o.name, value: o.value_numeric != null ? String(o.value_numeric) : (o.value_text ?? ""), unit: o.unit, range: o.ref_text, flag: o.flag })),
    reporter: result.reporter_name, credentials: result.reporter_credentials,
    verifiedAt: result.verified_at ? formatClinicDateTime(result.verified_at) : null, signedAt: result.signed_at ? formatClinicDateTime(result.signed_at) : null, releasedAt: result.released_at ? formatClinicDateTime(result.released_at) : null,
    version: result.version, amendmentReason: result.amendment_reason,
  });
  await auditInvestigation(user, "INVESTIGATION_REPORT_DOWNLOADED", itemId, { patientId: order.patient_id, req });
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${order.order_number}-${item.id.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
});
