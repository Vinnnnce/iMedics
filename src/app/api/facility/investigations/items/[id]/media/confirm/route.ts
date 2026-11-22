import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { conflict, notFound } from "@/lib/errors";
import { confirmUploadSchema, finalizeDiagnosticImage, safeFileName } from "@/lib/uploads";
import { auditInvestigation } from "@/lib/investigations/service";

type Params = { id: string };
const schema = confirmUploadSchema.extend({
  description: z.string().trim().max(300).optional(),
  dicomModality: z.string().trim().max(16).optional(),
  studyInstanceUid: z.string().trim().regex(/^[0-9]+(\.[0-9]+)*$/, "Invalid DICOM UID").max(64).optional(),
  seriesInstanceUid: z.string().trim().regex(/^[0-9]+(\.[0-9]+)*$/, "Invalid DICOM UID").max(64).optional(),
});

// POST — step 2: verify the uploaded bytes against their declared type and record the file against the study.
export const POST = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "UPLOAD_MEDIA", req);
  const body = await parseBody(req, schema);
  const { finalKey, sizeBytes } = await finalizeDiagnosticImage(body.key, id, body.mimeType);

  const media = await prisma.$transaction(async (tx) => {
    const item = await tx.investigation_order_items.findFirst({ where: { id, performingFacilityId: access.facility.id }, select: { id: true, status: true, order: { select: { patientId: true } }, results: { where: { isCurrent: true }, select: { id: true, status: true } } } });
    if (!item) throw notFound("Investigation not found");
    if (["SIGNED", "RELEASED", "DELIVERED", "CANCELLED"].includes(item.status)) throw conflict("Media cannot be added at this stage");
    const working = item.results.find((r) => !["SIGNED", "RELEASED", "SUPERSEDED"].includes(r.status));
    return tx.investigation_media.create({
      data: { itemId: id, resultId: working?.id ?? null, storageKey: finalKey, fileName: safeFileName(body.fileName), mimeType: body.mimeType, sizeBytes, description: body.description ?? null, dicomModality: body.dicomModality ?? null, studyInstanceUid: body.studyInstanceUid ?? null, seriesInstanceUid: body.seriesInstanceUid ?? null, uploadedById: user.id },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
  });
  await auditInvestigation(user, "INVESTIGATION_MEDIA_UPLOADED", id, { facilityId: access.facility.id, details: { fileName: media.fileName, mimeType: media.mimeType } });
  return NextResponse.json({ success: true, media }, { status: 201 });
});
