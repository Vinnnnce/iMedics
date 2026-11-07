import { prisma } from "@/lib/prisma";

/**
 * Case reports: a case-centric view of one care episode with the results it
 * produced. Shared by the patient and doctor portals; authorization (patient
 * ownership / doctor relationship) is checked by the pages before calling.
 *
 * What counts as a "result" of a case — recorded relationships only, nothing
 * is inferred by date:
 * - Lab results attached to the case's lab orders (verified ones for patients).
 * - Clinical documents released to the patient and tied to this case via an
 *   encounter or an admission of the case.
 * - Verified diagnostic media tied to the case's encounters.
 */

const CASE_INCLUDE = {
  patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true, userId: true } },
  primaryDoctor: { select: { specialty: true, user: { select: { name: true } } } },
  admissions: { select: { id: true, admittedAt: true, dischargedAt: true } },
  consultations: {
    where: { status: "FINALIZED" as const },
    select: { id: true, encounterId: true, finalDiagnosis: true, notes: true, createdAt: true },
  },
};

export async function caseReportBundle(caseId: string, includeDrafts = false) {
  const careCase = await prisma.careCase.findUnique({
    where: { id: caseId },
    include: CASE_INCLUDE,
  });
  if (!careCase) return null;

  const encounterIds: string[] = [];
  for (const consultation of careCase.consultations) {
    if (typeof consultation.encounterId === "string") encounterIds.push(consultation.encounterId);
  }
  const admissionIds = careCase.admissions.map((admission) => admission.id);

  const [labOrders, documents, media] = await Promise.all([
    prisma.labOrder.findMany({
      where: { caseId: careCase.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: { select: { id: true, labTest: { select: { name: true } } } },
        results: {
          where: includeDrafts ? { status: { not: "REJECTED" } } : { status: "VERIFIED" },
          orderBy: { testDate: "desc" },
          include: { values: { orderBy: { name: "asc" } }, files: { select: { id: true, fileName: true } } },
        },
      },
    }),
    prisma.clinicalDocument.findMany({
      where: {
        patientId: careCase.patient.id,
        ...(includeDrafts ? {} : { releasedToPatientAt: { not: null } }),
        OR: [
          ...(encounterIds.length > 0 ? [{ encounterId: { in: encounterIds } }] : []),
          ...(admissionIds.length > 0 ? [{ admissionId: { in: admissionIds } }] : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
      select: {
        id: true,
        documentNumber: true,
        title: true,
        status: true,
        releasedToPatientAt: true,
        updatedAt: true,
        facility: { select: { laboratoryName: true } },
      },
    }),
    encounterIds.length > 0
      ? prisma.medicalMedia.findMany({
          where: {
            patientId: careCase.patient.id,
            deletedAt: null,
            reportStatus: includeDrafts ? { not: "UNREPORTED" } : { in: ["VERIFIED", "AMENDED"] },
            encounterId: { in: encounterIds },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: { id: true, fileName: true, category: true, examinationType: true, examinationAt: true, reportStatus: true, createdAt: true },
        })
      : Promise.resolve([]),
  ]);

  return { careCase, labOrders, documents, media };
}
