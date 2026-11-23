import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { conflict, notFound } from "@/lib/errors";
import { confirmUploadSchema, finalizeDiagnosticImage, safeFileName } from "@/lib/uploads";
import { auditInvestigation } from "@/lib/investigations/service";
import { newId } from "@/lib/investigations/db";
import { toDto } from "@/lib/investigations/serialize";

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
    const item = await tx.investigation_order_items.findFirst({ where: { id, performing_facility_id: access.facility.id }, select: { id: true, status: true } });
    if (!item) throw notFound("Investigation not found");
    if (["SIGNED", "RELEASED", "DELIVERED", "CANCELLED"].includes(item.status)) throw conflict("Media cannot be added at this stage");
    const currentResult = await tx.investigation_results.findFirst({ where: { item_id: id, is_current: true }, select: { id: true, status: true } });
    const working = currentResult && !["SIGNED", "RELEASED", "SUPERSEDED"].includes(currentResult.status) ? currentResult : null;
    return tx.investigation_media.create({
      data: { id: newId(), item_id: id, result_id: working?.id ?? null, storage_key: finalKey, file_name: safeFileName(body.fileName), mime_type: body.mimeType, size_bytes: sizeBytes, description: body.description ?? null, dicom_modality: body.dicomModality ?? null, study_instance_uid: body.studyInstanceUid ?? null, series_instance_uid: body.seriesInstanceUid ?? null, uploaded_by_id: user.id },
      select: { id: true, file_name: true, mime_type: true, size_bytes: true, created_at: true },
    });
  });
  await auditInvestigation(user, "INVESTIGATION_MEDIA_UPLOADED", id, { facilityId: access.facility.id, details: { fileName: media.file_name, mimeType: media.mime_type } });
  return NextResponse.json({ success: true, media: toDto("media", media) }, { status: 201 });
});
