import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { notFound, conflict } from "@/lib/errors";
import { UPLOAD_URL_TTL_SECONDS, presignUpload } from "@/lib/storage";
import { newObjectKey, uploadRequestSchema } from "@/lib/uploads";

const MAX_IMAGES_PER_BOOKING = 10;

const presignSchema = uploadRequestSchema.extend({ bookingId: z.string().uuid() });
const listSchema = z.object({ bookingId: z.string().uuid() });

// POST /api/facility/diagnostic-images — step 1 of an upload: ask for a
// presigned URL for one imaging study (X-ray, CT, MRI, ultrasound, DICOM...).
// The browser then PUTs the file straight to storage and calls /confirm.
export const POST = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);

  const { bookingId, mimeType, sizeBytes } = await parseBody(req, presignSchema);

  // Only the diagnostic centre that owns the booking's service may attach
  // images to it, only while the booking is still active, and only before the
  // report is finalized — once a report is issued, images change exclusively
  // through the amendment workflow, preserving the release boundary.
  const booking = await prisma.facilityBooking.findFirst({
    where: { id: bookingId, service: { facilityId: access.facility.id }, status: { not: "CANCELLED" } },
    select: { id: true, diagnosticReport: { select: { id: true, status: true } }, _count: { select: { diagnosticImages: true } } },
  });
  const report = booking?.diagnosticReport ?? null;
  if (!booking) throw notFound("Booking not found");
  if (report && !["DRAFT", "AWAITING_VERIFICATION"].includes(report.status)) {
    throw conflict("This examination's report has been issued; images can only be changed through an amendment");
  }
  if (booking._count.diagnosticImages >= MAX_IMAGES_PER_BOOKING) {
    return NextResponse.json(
      { error: `This examination already has the maximum number of images (${MAX_IMAGES_PER_BOOKING})` },
      { status: 409 },
    );
  }

  const key = newObjectKey(`diagnostic-images/staging/${bookingId}`);
  const uploadUrl = await presignUpload(key, mimeType, sizeBytes);

  return NextResponse.json({
    key,
    uploadUrl,
    method: "PUT",
    headers: { "Content-Type": mimeType },
    expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
  });
});

// GET /api/facility/diagnostic-images?bookingId= — list an examination's
// images (metadata only; downloads are issued per image). Read access for the
// owning centre; recipients and patients go through /patient and report
// endpoints, which only expose issued reports.
export const GET = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const access = await requireFacilityAccess(user, "PROCESS_ORDERS", req);
  const { bookingId } = await parseQuery(req, listSchema);

  const booking = await prisma.facilityBooking.findFirst({
    where: { id: bookingId, service: { facilityId: access.facility.id } },
    select: { id: true },
  });
  if (!booking) throw notFound("Booking not found");

  const images = await prisma.diagnosticImage.findMany({
    where: { bookingId },
    orderBy: { createdAt: "asc" },
    select: { id: true, fileName: true, mimeType: true, sizeBytes: true, uploadedById: true, createdAt: true },
  });

  return NextResponse.json({ images });
});
