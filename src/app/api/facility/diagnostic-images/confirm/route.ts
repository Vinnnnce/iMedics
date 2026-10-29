import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { conflict, notFound } from "@/lib/errors";
import { confirmUploadSchema, finalizeDiagnosticImage, safeFileName } from "@/lib/uploads";
import { writeAudit } from "@/lib/audit";

const MAX_IMAGES_PER_BOOKING = 10;

const confirmSchema = confirmUploadSchema.extend({ bookingId: z.string().uuid() });

// POST /api/facility/diagnostic-images/confirm — step 2 of an upload: the file
// has been PUT to storage; verify its magic bytes, copy the verified content to
// a server-only final key and record it against the examination. The staging
// key is booking-scoped and only the owning diagnostic centre can confirm, so
// a still-valid presigned URL can never replace already-verified content.
export const POST = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req);
  await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]);

  const { bookingId, key, fileName, mimeType } = await parseBody(req, confirmSchema);

  const { finalKey, sizeBytes } = await finalizeDiagnosticImage(key, bookingId, mimeType);

  // The image belongs to the booking and, when one exists, to its report —
  // but it is never written into a finalized report's snapshot. The state and
  // limit checks run again inside the insert transaction, so a report that is
  // issued between the presign request and this confirmation (or a concurrent
  // upload that hits the limit) cannot slip an image past the release boundary.
  const image = await prisma.$transaction(async (tx) => {
    const booking = await tx.facilityBooking.findFirst({
      where: { id: bookingId, service: { facilityId: access.facility.id }, status: { not: "CANCELLED" } },
      select: { id: true, diagnosticReport: { select: { id: true, status: true } }, _count: { select: { diagnosticImages: true } } },
    });
    if (!booking) throw notFound("This examination no longer accepts image uploads");
    const report = booking.diagnosticReport;
    if (report && !["DRAFT", "AWAITING_VERIFICATION"].includes(report.status)) {
      throw conflict("This examination's report has been issued; images can only be changed through an amendment");
    }
    if (booking._count.diagnosticImages >= MAX_IMAGES_PER_BOOKING) {
      throw conflict(`This examination already has the maximum number of images (${MAX_IMAGES_PER_BOOKING})`);
    }

    return tx.diagnosticImage.create({
      data: {
        bookingId,
        reportId: report?.id ?? null,
        uploadedById: user.id,
        fileName: safeFileName(fileName),
        mimeType,
        sizeBytes,
        storageKey: finalKey,
      },
      select: { id: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true },
    });
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DIAGNOSTIC_IMAGE_UPLOADED",
    resourceType: "DiagnosticImage",
    resourceId: image.id,
    details: { bookingId, fileName: safeFileName(fileName), mimeType },
    req,
  });

  return NextResponse.json({ image }, { status: 201 });
});
