import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId, parseQuery } from "@/lib/api";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { hasPermission, requireHisAccess } from "@/lib/his/access";
import { auditHis } from "@/lib/his/audit";
import { formatByKey } from "@/lib/his/media-formats";
import { DOWNLOAD_URL_TTL_SECONDS, presignDownload, presignView } from "@/lib/storage";

const getSchema = z.object({ mode: z.enum(["view", "download"]).default("view") });
const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("release"), confirmProtected: z.boolean().optional() }),
  z.object({ action: z.literal("reportStatus"), reportStatus: z.enum(["UNREPORTED", "PRELIMINARY", "VERIFIED", "AMENDED"]), reportingClinician: z.string().trim().max(160).optional() }),
  z.object({ action: z.literal("delete"), reason: z.string().trim().min(5).max(500) }),
]);

// GET /api/facility/his/media/[id] — a 60-second signed URL (inline preview only for safe formats).
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "VIEW_PATIENT_DOCUMENTS", req);
  const { mode } = parseQuery(req, getSchema);
  const media = await prisma.medicalMedia.findFirst({ where: { id: parseId((await params).id), facilityId: access.facility.id, deletedAt: null } });
  if (!media) throw notFound("File not found");
  if (media.sensitivity === "SPECIALLY_PROTECTED" && !hasPermission(access, "REVIEW_DOCUMENTS")) throw forbidden("This record is specially protected");
  const preview = formatByKey(media.formatKey)?.preview ?? "none";
  const inline = mode === "view" && ["image", "pdf", "video", "audio"].includes(preview);
  const url = inline ? await presignView(media.storageKey, media.fileName) : await presignDownload(media.storageKey, media.fileName);
  await auditHis(access, inline ? "HIS_MEDIA_VIEWED" : "HIS_MEDIA_DOWNLOADED", "MedicalMedia", media.id, req, { patientId: media.patientId });
  return NextResponse.json({ url, preview: inline ? preview : "none", expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS });
});

// PATCH /api/facility/his/media/[id] — release to the patient portal, update report status, or soft-delete.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, null, req);
  const id = parseId((await params).id);
  const body = await parseBody(req, patchSchema);
  const media = await prisma.medicalMedia.findFirst({ where: { id, facilityId: access.facility.id, deletedAt: null } });
  if (!media) throw notFound("File not found");
  const need = (p: Parameters<typeof hasPermission>[1]) => { if (!hasPermission(access, p)) throw forbidden("Your role does not allow this action"); };

  if (body.action === "release") {
    need("RELEASE_DOCUMENTS");
    if (media.releasedToPatientAt) throw conflict("Already released");
    if (media.reportStatus !== "VERIFIED" && media.reportStatus !== "AMENDED") throw badRequest("Only verified results can be released to the patient");
    if (media.sensitivity === "SPECIALLY_PROTECTED" && body.confirmProtected !== true) throw badRequest("Confirm release of a specially protected record complies with policy");
    await prisma.medicalMedia.update({ where: { id }, data: { releasedToPatientAt: new Date() } });
  } else if (body.action === "reportStatus") {
    need("REVIEW_DOCUMENTS");
    await prisma.medicalMedia.update({ where: { id }, data: { reportStatus: body.reportStatus, ...(body.reportingClinician ? { reportingClinician: body.reportingClinician } : {}) } });
  } else {
    need("APPROVE_DOCUMENTS");
    await prisma.medicalMedia.update({ where: { id }, data: { deletedAt: new Date(), releasedToPatientAt: null } });
  }
  await auditHis(access, `HIS_MEDIA_${body.action.toUpperCase()}`, "MedicalMedia", id, req, { patientId: media.patientId, details: body.action === "delete" ? { reason: body.reason } : {} });
  return NextResponse.json({ ok: true });
});
