import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { conflict, notFound } from "@/lib/errors";
import { UPLOAD_URL_TTL_SECONDS, presignUpload, presignView } from "@/lib/storage";
import { newObjectKey, uploadRequestSchema } from "@/lib/uploads";

type Params = { id: string };
const MAX_MEDIA = 40;

async function ownedItem(id: string, facilityId: string) {
  const item = await prisma.investigation_order_items.findFirst({ where: { id, performing_facility_id: facilityId, status: { notIn: ["CANCELLED"] } }, select: { id: true, status: true, _count: { select: { investigation_media: true } } } });
  if (!item) throw notFound("Investigation not found");
  return item;
}

// POST — step 1: presigned upload URL for an image / PDF / DICOM object (UPLOAD_MEDIA).
export const POST = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "UPLOAD_MEDIA", req);
  const { mimeType, sizeBytes } = await parseBody(req, uploadRequestSchema);
  const item = await ownedItem(id, access.facility.id);
  if (["SIGNED", "RELEASED", "DELIVERED"].includes(item.status)) throw conflict("Media cannot be added after the report is signed; start an amendment");
  if (item._count.investigation_media >= MAX_MEDIA) throw conflict(`This examination already has the maximum of ${MAX_MEDIA} files`);
  // Same staging prefix as legacy diagnostic images so the verified-upload pipeline is reused unchanged.
  const key = newObjectKey(`diagnostic-images/staging/${id}`);
  return NextResponse.json({ key, uploadUrl: await presignUpload(key, mimeType, sizeBytes), method: "PUT", headers: { "Content-Type": mimeType }, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
});

// GET ?mediaId= — facility-side view URL of an uploaded file.
export const GET = withAuth<Params>(null, async (req, { user, params }) => {
  const id = parseId((await params).id);
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  await ownedItem(id, access.facility.id);
  const mediaId = new URL(req.url).searchParams.get("mediaId");
  if (!mediaId) return NextResponse.json({ error: "mediaId is required" }, { status: 400 });
  const media = await prisma.investigation_media.findFirst({ where: { id: parseId(mediaId), item_id: id } });
  if (!media) throw notFound("Media not found");
  return NextResponse.json({ url: await presignView(media.storage_key, media.file_name), fileName: media.file_name, mimeType: media.mime_type });
});
