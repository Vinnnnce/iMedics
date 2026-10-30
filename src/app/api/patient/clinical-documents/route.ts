import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/api";
import { writeAudit } from "@/lib/audit";

// GET /api/patient/clinical-documents — the signed-in patient's released documents and media.
// Drafts, preliminary and unreleased records are never returned.
export const GET = withAuth(["PATIENT"], async (req, { user }) => {
  const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!patient) return NextResponse.json({ documents: [], media: [] });
  const [documents, media] = await Promise.all([
    prisma.clinicalDocument.findMany({ take: 200,
      where: { patientId: patient.id, releasedToPatientAt: { not: null }, status: { in: ["FINAL", "AMENDED"] } },
      orderBy: { finalizedAt: "desc" },
      select: { id: true, documentNumber: true, title: true, groupCode: true, status: true, finalizedAt: true, facility: { select: { laboratoryName: true } } },
    }),
    prisma.medicalMedia.findMany({ take: 200,
      where: { patientId: patient.id, releasedToPatientAt: { not: null }, deletedAt: null,
        reportStatus: { in: ["VERIFIED", "AMENDED"] }, scanStatus: "CLEAN" },
      orderBy: { createdAt: "desc" },
      select: { id: true, category: true, examinationType: true, examinationAt: true, fileName: true, reportStatus: true, facility: { select: { laboratoryName: true } } },
    }),
  ]);
  await writeAudit({ userId: user.id, actorRole: user.role, patientId: patient.id, action: "PATIENT_DOCUMENTS_LISTED", resourceType: "ClinicalDocument", req });
  return NextResponse.json({ documents, media }, { headers: { "Cache-Control": "private, no-store" } });
});
