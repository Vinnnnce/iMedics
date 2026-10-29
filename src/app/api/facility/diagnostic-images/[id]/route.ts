import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { requireFacilityKind } from "@/lib/modules/access-matrix";
import { notFound, forbidden } from "@/lib/errors";
import { presignDownload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";

const IMAGE_SELECT = {
  id: true,
  fileName: true,
  storageKey: true,
  booking: {
    select: {
      id: true,
      service: { select: { facilityId: true } },
      requestingFacilityId: true,
      diagnosticReport: { select: { id: true, status: true, facilityId: true } },
    },
  },
} as const;

// GET /api/facility/diagnostic-images/[id] — a short-lived, audited download
// URL for one imaging study. Access mirrors the diagnostic report rules:
//   - the owning diagnostic centre (staff with result-entry rights), and
//   - the requesting hospital, but only for studies on bookings whose report
//     has been issued to them (SENT / AMENDED) — drafts stay invisible.
// Patients reach their released studies through the patient portal.
export const GET = withAuth<{ id: string }>(["LAB_SCIENTIST"], async (req, { user, params }) => {
  const id = parseId((await params).id);

  const image = await prisma.diagnosticImage.findFirst({
    where: { id },
    select: IMAGE_SELECT,
  });
  if (!image) throw notFound("Image not found");

  const access = await requireFacilityAccess(user, "ENTER_RESULTS", req).catch(() => null);

  const isOwner =
    access != null && access.facility.id === image.booking.service.facilityId &&
    (await requireFacilityKind(access, ["DIAGNOSTIC_CENTRE"]).then(() => true).catch(() => false));

  if (!isOwner) {
    // Requesting hospital: read-only, issued reports only.
    const hospitalAccess = await requireFacilityAccess(user, "REGISTER_PATIENTS", req);
    await requireFacilityKind(hospitalAccess, ["HOSPITAL"]);
    const report = image.booking.diagnosticReport;
    const issued = report != null && ["SENT", "AMENDED"].includes(report.status);
    const isRequester = image.booking.requestingFacilityId === hospitalAccess.facility.id;
    if (!issued || !isRequester) throw forbidden("This image has not been issued to your organization");
  }

  const downloadUrl = await presignDownload(image.storageKey, image.fileName);

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DIAGNOSTIC_IMAGE_DOWNLOADED",
    resourceType: "DiagnosticImage",
    resourceId: id,
    details: { bookingId: image.booking.id },
    req,
  });

  return NextResponse.json({ downloadUrl, expiresIn: 60 });
});
