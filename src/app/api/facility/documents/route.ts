import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  facilityId: z.string().uuid().optional(),
  patient: z.string().trim().max(100).optional(),
});

/**
 * GET /api/facility/documents — patient documents issued by the caller's
 * facility (VIEW_PATIENT_DOCUMENTS permission). Returns metadata only:
 * storage keys never leave the server. Read-only view of what the facility
 * has issued and to which patients.
 */
export const GET = withAuth(["DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user }) => {
  const query = parseQuery(req, querySchema);
  const { facility } = await requireFacilityAccess(user, "VIEW_PATIENT_DOCUMENTS", req);

  const documents = await prisma.patientDocument.findMany({
    where: {
      issuingFacilityId: facility.id,
      deletedAt: null,
      ...(query.patient
        ? {
            patient: {
              OR: [
                { firstName: { contains: query.patient, mode: "insensitive" } },
                { lastName: { contains: query.patient, mode: "insensitive" } },
                { caseNumber: { contains: query.patient, mode: "insensitive" } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      category: true,
      title: true,
      issuedOn: true,
      notes: true,
      createdAt: true,
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
      uploader: { select: { name: true } },
    },
  });

  return NextResponse.json({ documents });
});
