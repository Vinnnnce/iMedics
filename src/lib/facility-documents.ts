import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/shared";

export const FACILITY_DOCUMENT_SCOPES = ["all", "issued", "shared"] as const;
export type FacilityDocumentScope = (typeof FACILITY_DOCUMENT_SCOPES)[number];
export const FACILITY_DOCUMENTS_PAGE_SIZE = 25;

export interface FacilityDocumentQuery {
  facilityId: string;
  scope?: FacilityDocumentScope;
  category?: (typeof DOCUMENT_CATEGORIES)[number];
  patient?: string;
  cursor?: string;
  limit?: number;
}

export interface FacilityDocumentRow {
  id: string;
  category: string;
  title: string;
  issuedOn: string | null;
  notes: string | null;
  createdAt: string;
  patient: { name: string; caseNumber: string };
  uploadedBy: string;
  /** ISSUED: created by this facility. SHARED: a patient shared it with this facility. */
  source: "ISSUED" | "SHARED";
}

/**
 * Patient documents a facility may read, newest first, with cursor pagination:
 * the documents it issued and the documents patients shared with it (an active
 * facility share). The caller must already have checked the facility's
 * VIEW_PATIENT_DOCUMENTS permission. Metadata only — storage keys never leave
 * the server, and downloads go through the audited presigned-URL route.
 */
export async function listFacilityDocuments(query: FacilityDocumentQuery) {
  const { facilityId, scope = "all", category, patient, cursor } = query;
  const limit = Math.min(Math.max(query.limit ?? FACILITY_DOCUMENTS_PAGE_SIZE, 1), 100);

  const issued: Prisma.PatientDocumentWhereInput = { issuingFacilityId: facilityId };
  const shared: Prisma.PatientDocumentWhereInput = {
    facilityShares: { some: { facilityId, revokedAt: null } },
  };
  const access: Prisma.PatientDocumentWhereInput =
    scope === "issued" ? issued : scope === "shared" ? shared : { OR: [issued, shared] };

  const where: Prisma.PatientDocumentWhereInput = {
    AND: [
      access,
      { deletedAt: null },
      ...(category ? [{ category }] : []),
      ...(patient
        ? [{
            patient: {
              OR: [
                { firstName: { contains: patient, mode: "insensitive" as const } },
                { lastName: { contains: patient, mode: "insensitive" as const } },
                { caseNumber: { contains: patient, mode: "insensitive" as const } },
              ],
            },
          }]
        : []),
    ],
  };

  const rows = await prisma.patientDocument.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true, category: true, title: true, issuedOn: true, notes: true, createdAt: true, issuingFacilityId: true,
      patient: { select: { firstName: true, lastName: true, caseNumber: true } },
      uploader: { select: { name: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const documents: FacilityDocumentRow[] = page.map((d) => ({
    id: d.id,
    category: d.category,
    title: d.title,
    issuedOn: d.issuedOn?.toISOString() ?? null,
    notes: d.notes,
    createdAt: d.createdAt.toISOString(),
    patient: { name: `${d.patient.firstName} ${d.patient.lastName}`, caseNumber: d.patient.caseNumber },
    uploadedBy: d.uploader.name,
    source: d.issuingFacilityId === facilityId ? "ISSUED" : "SHARED",
  }));
  return { documents, nextCursor: hasMore ? page[page.length - 1].id : null };
}
