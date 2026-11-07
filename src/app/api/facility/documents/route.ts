import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/shared";
import { FACILITY_DOCUMENT_SCOPES, listFacilityDocuments } from "@/lib/facility-documents";

const querySchema = z.object({
  facilityId: z.string().uuid().optional(),
  patient: z.string().trim().max(100).optional(),
  scope: z.enum(FACILITY_DOCUMENT_SCOPES).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

/**
 * GET /api/facility/documents — patient documents the caller's facility may
 * read (VIEW_PATIENT_DOCUMENTS permission): those it issued and those patients
 * shared with it. Paginated with a cursor (`nextCursor` is null on the last
 * page). Metadata only: storage keys never leave the server.
 */
export const GET = withAuth(["PATIENT", "DOCTOR", "ADMIN", "LAB_SCIENTIST"], async (req, { user }) => {
  const query = parseQuery(req, querySchema);
  const { facility } = await requireFacilityAccess(user, "VIEW_PATIENT_DOCUMENTS", req);

  const result = await listFacilityDocuments({
    facilityId: facility.id,
    scope: query.scope,
    category: query.category,
    patient: query.patient,
    cursor: query.cursor,
    limit: query.limit,
  });
  return NextResponse.json(result);
});
