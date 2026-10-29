import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { findAccessibleDocument, auditDocumentAccess } from "@/lib/documents";
import { badRequest, forbidden, notFound } from "@/lib/errors";

/**
 * Sharing a patient document with a whole facility (hospital, laboratory or
 * diagnostic centre) so its authorised staff can read it. Only the patient (or
 * the clinician who manages the document) can grant or revoke a share, staff
 * access is still limited by their VIEW_PATIENT_DOCUMENTS permission, and every
 * change is audited.
 */

const grantSchema = z.object({ facilityId: z.string().uuid() });

// GET — facilities this document is currently shared with.
export const GET = withAuth<{ id: string }>(["PATIENT", "DOCTOR"], async (_req, { params, user }) => {
  const id = parseId((await params).id);
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) throw forbidden("You cannot view this document's sharing");

  const shares = await prisma.documentFacilityShare.findMany({
    where: { documentId: document.id, revokedAt: null },
    orderBy: { grantedAt: "desc" },
    take: 50,
    select: { id: true, grantedAt: true, facility: { select: { id: true, laboratoryName: true } } },
  });
  return NextResponse.json({ shares });
});

// POST — share with a facility.
export const POST = withAuth<{ id: string }>(["PATIENT", "DOCTOR"], async (req: NextRequest, { params, user }) => {
  const id = parseId((await params).id);
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) throw forbidden("You cannot share this document");
  const { facilityId } = await parseBody(req, grantSchema);

  const facility = await prisma.labStaffProfile.findFirst({
    where: { id: facilityId, isPublished: true, verificationStatus: "VERIFIED" },
    select: { id: true, laboratoryName: true },
  });
  if (!facility) throw notFound("Facility not found");
  if (document.issuingFacilityId === facility.id) throw badRequest("This facility already has this document");

  const share = await prisma.documentFacilityShare.upsert({
    where: { documentId_facilityId: { documentId: document.id, facilityId: facility.id } },
    create: { documentId: document.id, facilityId: facility.id, grantedById: user.id },
    update: { revokedAt: null, grantedById: user.id, grantedAt: new Date() },
    select: { id: true, grantedAt: true },
  });

  await auditDocumentAccess(user, document.id, document.patientId, "DOCUMENT_SHARED_WITH_FACILITY", { facilityId: facility.id });
  return NextResponse.json({ share: { ...share, facility } }, { status: 201 });
});

// DELETE ?facilityId=... — withdraw the share.
export const DELETE = withAuth<{ id: string }>(["PATIENT", "DOCTOR"], async (req: NextRequest, { params, user }) => {
  const id = parseId((await params).id);
  const { document, canManage } = await findAccessibleDocument(user, id);
  if (!canManage) throw forbidden("You cannot manage this document's sharing");

  const facilityId = z.string().uuid().safeParse(new URL(req.url).searchParams.get("facilityId"));
  if (!facilityId.success) throw badRequest("facilityId is required");

  const updated = await prisma.documentFacilityShare.updateMany({
    where: { documentId: document.id, facilityId: facilityId.data, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await auditDocumentAccess(user, document.id, document.patientId, "DOCUMENT_FACILITY_SHARE_REVOKED", { facilityId: facilityId.data });
  return NextResponse.json({ revoked: updated.count });
});
