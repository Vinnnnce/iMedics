import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { HisAccess } from "./access";
import { assertPatientLinked } from "./access";
import { auditHis } from "./audit";
import { THERAPY_CATEGORIES, resolveFormat } from "./media-formats";
import { finalizeMedia } from "./media-storage";
import { safeFileName } from "@/lib/uploads";
import { deleteObject } from "@/lib/storage";
import { badRequest, forbidden, notFound } from "@/lib/errors";
import type { User } from "@prisma/client";

/**
 * Shared tail of the diagnostic-media upload flow: verify the staged bytes and
 * register the file against the correct patient. Used by both the single
 * presigned-PUT confirmation and the multipart completion route so the two
 * paths cannot drift.
 */

export const MEDIA_CATEGORIES = ["XRAY", "CT", "MRI", "ULTRASOUND", "ECHOCARDIOGRAPHY", "ECG_HOLTER", "EEG", "ENDOSCOPY", "GASTROSCOPY", "COLONOSCOPY", "ANGIOGRAPHY", "MAMMOGRAPHY", "DOPPLER", "FLUOROSCOPY", "NUCLEAR_MEDICINE", "PULMONARY_FUNCTION", "LABORATORY_REPORT", "PATHOLOGY_HISTOLOGY", "MICROBIOLOGY", "AUDIOLOGY", "OPHTHALMIC", "PRESSURE_THERAPY", "REHABILITATION", "OTHER"] as const;

export const confirmMediaSchema = z.object({
  key: z.string().min(1).max(300),
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().nullish(),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.string().trim().min(1).max(100),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  category: z.enum(MEDIA_CATEGORIES),
  examinationType: z.string().trim().min(2).max(160),
  examinationAt: z.string().datetime({ offset: true }).nullish(),
  department: z.string().trim().max(120).nullish(),
  orderingClinician: z.string().trim().max(160).nullish(),
  performingFacility: z.string().trim().max(200).nullish(),
  reportingClinician: z.string().trim().max(160).nullish(),
  reportStatus: z.enum(["UNREPORTED", "PRELIMINARY", "VERIFIED", "AMENDED"]).default("UNREPORTED"),
  modality: z.string().trim().max(40).nullish(),
  device: z.string().trim().max(160).nullish(),
  bodySite: z.string().trim().max(120).nullish(),
  contrastDetails: z.string().trim().max(300).nullish(),
  accessionNumber: z.string().trim().max(80).nullish(),
  studyInstanceUid: z.string().regex(/^[0-9.]{1,128}$/, "DICOM UIDs contain digits and dots").nullish(),
  externalReference: z.string().trim().max(160).nullish(),
  relatedOrderRef: z.string().trim().max(80).nullish(),
  sensitivity: z.enum(["STANDARD", "RESTRICTED", "SPECIALLY_PROTECTED"]).default("STANDARD"),
});

export type ConfirmMediaInput = z.infer<typeof confirmMediaSchema>;

/** Verify the staged object and persist the media record; returns the row id. */
export async function recordConfirmedMedia(
  access: HisAccess,
  user: User,
  req: NextRequest,
  body: ConfirmMediaInput,
): Promise<string> {
  if (["VERIFIED", "AMENDED"].includes(body.reportStatus) && !access.permissions.includes("REVIEW_DOCUMENTS")) {
    throw forbidden("Your role cannot verify diagnostic reports");
  }
  await assertPatientLinked(access.facility.id, body.patientId);
  if (body.encounterId) {
    const enc = await prisma.encounter.findFirst({ where: { id: body.encounterId, facilityId: access.facility.id, patientId: body.patientId }, select: { id: true } });
    if (!enc) throw notFound("Encounter not found");
  }
  const resolved = resolveFormat(body.fileName, body.mimeType);
  if ("error" in resolved) throw badRequest(resolved.error);
  const settings = await prisma.hospitalSettings.findUnique({ where: { facilityId: access.facility.id }, select: { defaultRetentionCategory: true } });
  const { finalKey, sizeBytes, sha256, scanStatus } = await finalizeMedia(body.key, access.facility.id, body.patientId, resolved.format, body.sha256);

  let mediaId: string;
  try {
    const media = await prisma.medicalMedia.create({
      data: {
        facilityId: access.facility.id, patientId: body.patientId, encounterId: body.encounterId ?? null, category: body.category,
        isTherapyRecord: THERAPY_CATEGORIES.includes(body.category), examinationType: body.examinationType,
        examinationAt: body.examinationAt ? new Date(body.examinationAt) : null, department: body.department ?? null,
        orderingClinician: body.orderingClinician ?? null, performingFacility: body.performingFacility ?? null, reportingClinician: body.reportingClinician ?? null,
        reportStatus: body.reportStatus, modality: body.modality ?? null, device: body.device ?? null, bodySite: body.bodySite ?? null,
        contrastDetails: body.contrastDetails ?? null, accessionNumber: body.accessionNumber ?? null, studyInstanceUid: body.studyInstanceUid ?? null,
        externalReference: body.externalReference ?? null, relatedOrderRef: body.relatedOrderRef ?? null,
        fileName: safeFileName(body.fileName), formatKey: resolved.format.key, mimeType: resolved.format.mimeTypes[0], sizeBytes: BigInt(sizeBytes),
        sha256, storageKey: finalKey, scanStatus, sensitivity: body.sensitivity, retentionCategory: settings?.defaultRetentionCategory ?? "STANDARD",
        uploadedById: user.id,
      },
      select: { id: true },
    });
    mediaId = media.id;
  } catch (error) {
    await deleteObject(finalKey);
    throw error;
  }
  await auditHis(access, "HIS_MEDIA_UPLOADED", "MedicalMedia", mediaId, req, { patientId: body.patientId, details: { category: body.category, format: resolved.format.key, sizeBytes } });
  return mediaId;
}

export function mediaRecordedResponse(mediaId: string): NextResponse {
  return NextResponse.json({ media: { id: mediaId } }, { status: 201 });
}
