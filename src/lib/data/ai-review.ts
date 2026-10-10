import type { Prisma, User } from "@prisma/client";
import { prisma } from "../prisma";
import { patientScope } from "../access";

const patientSelect = { select: { id: true, firstName: true, lastName: true, caseNumber: true } } as const;

async function pendingReviewWhere(user: User): Promise<Prisma.AiAnalysisWhereInput> {
  const scope = await patientScope(user);
  return {
    reviewStatus: "PENDING_REVIEW",
    status: { in: ["COMPLETED", "COMPLETED_WITH_OVERRIDE"] },
    OR: [
      { labResult: { patient: scope.where } },
      { medicalHistory: { patient: scope.where } },
      { consultation: { patient: scope.where } },
    ],
  };
}

/** Completed AI analyses, for patients in the doctor's care, waiting for approval. */
export async function listPendingReview(user: User, take = 50) {
  const analyses = await prisma.aiAnalysis.findMany({
    where: await pendingReviewWhere(user),
    orderBy: { createdAt: "desc" },
    take,
    include: {
      labResult: { select: { id: true, panelType: true, testDate: true, patient: patientSelect } },
      medicalHistory: { select: { id: true, patient: patientSelect } },
      consultation: { select: { id: true, patient: patientSelect } },
    },
  });

  return analyses.map(({ labResult, medicalHistory, consultation, ...analysis }) => {
    const source = labResult ?? medicalHistory ?? consultation;
    return {
      ...analysis,
      source: {
        type: labResult ? ("lab_result" as const) : medicalHistory ? ("medical_history" as const) : ("consultation" as const),
        id: source?.id ?? null,
        label: labResult?.panelType ?? null,
        patient: source?.patient
          ? {
              id: source.patient.id,
              name: `${source.patient.firstName} ${source.patient.lastName}`,
              caseNumber: source.patient.caseNumber,
            }
          : null,
      },
    };
  });
}

export async function countPendingReview(user: User): Promise<number> {
  return prisma.aiAnalysis.count({ where: await pendingReviewWhere(user) });
}
