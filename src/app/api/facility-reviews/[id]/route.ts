import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { notifyUser } from "@/lib/notifications/service";

const responseSchema = z.object({
  facilityResponse: z.string().trim().min(1, "A response cannot be empty").max(4000),
});

// PATCH /api/facility-reviews/[id] — a facility staff member responds to (or
// edits their response to) a patient review of their own facility. Only the
// reviewed facility can respond; the response is attributed and timestamped,
// and the patient is notified. Responses are never silently attached to
// other organizations' reviews.
export const PATCH = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireFacilityAccess(user, "MANAGE_PROFILE", req);
  const id = parseId((await params).id);
  const data = await parseBody(req, responseSchema);

  const review = await prisma.facilityReview.findFirst({
    where: { id, facilityId: access.facility.id },
    select: { id: true, facilityResponse: true, patient: { select: { userId: true, firstName: true } } },
  });
  if (!review) throw notFound("Review not found");

  const updated = await prisma.facilityReview.update({
    where: { id },
    data: { facilityResponse: data.facilityResponse, respondedAt: new Date() },
    select: { id: true, facilityResponse: true, respondedAt: true },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_REVIEW_RESPONSE",
    resourceType: "FacilityReview",
    resourceId: id,
    details: { firstResponse: !review.facilityResponse },
    req,
  });

  // Tell the patient their review received a reply (fire-and-forget).
  if (review.patient.userId) {
    await notifyUser(review.patient.userId, { kind: "REVIEW_RESPONSE", reviewId: id }).catch(() => undefined);
  }

  return NextResponse.json({ success: true, review: updated });
});
