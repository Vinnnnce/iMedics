import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, apiHandler, parseBody, parseQuery } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

/**
 * Patient reviews of facilities (hospitals, laboratories, diagnostic centres).
 * GET is public: approved reviews for a facility, newest first.
 */

const listQuerySchema = z.object({
  facilityId: z.string().uuid(),
  take: z.coerce.number().int().min(1).max(50).optional(),
});

export const GET = apiHandler(async (req: NextRequest) => {
  const { facilityId, take } = parseQuery(req, listQuerySchema);

  const facility = await prisma.labStaffProfile.findUnique({
    where: { id: facilityId },
    select: { id: true, verificationStatus: true },
  });
  if (!facility) throw notFound("Facility not found");

  const reviews = await prisma.facilityReview.findMany({
    where: { facilityId, moderationStatus: "APPROVED" },
    orderBy: { createdAt: "desc" },
    take: take ?? 20,
    select: {
      id: true,
      rating: true,
      comment: true,
      facilityResponse: true,
      createdAt: true,
      patient: { select: { firstName: true } },
    },
  });

  return NextResponse.json({
    reviews: reviews.map(review => ({
      ...review,
      // First name only, so patient identity is not fully exposed publicly.
      author: review.patient?.firstName ? `${review.patient.firstName}.` : "A patient",
      patient: undefined,
    })),
  });
});

const createSchema = z.object({
  facilityId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

// POST /api/facility-reviews — a patient rates a facility. One review per
// patient per facility (upsert); the facility's aggregate rating is
// recomputed transactionally.
export const POST = withAuth(["PATIENT"], async (req, { user }) => {
  const data = await parseBody(req, createSchema);

  const facility = await prisma.labStaffProfile.findUnique({
    where: { id: data.facilityId },
    select: { id: true, verificationStatus: true },
  });
  if (!facility || facility.verificationStatus !== "VERIFIED") {
    throw notFound("Facility not found");
  }

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Only patients can review facilities" }, { status: 403 });
  }

  const review = await prisma.$transaction(async tx => {
    const existing = await tx.facilityReview.findUnique({
      where: { patientId_facilityId: { patientId: patient.id, facilityId: facility.id } },
    });
    const saved = existing
      ? await tx.facilityReview.update({
          where: { id: existing.id },
          data: { rating: data.rating, comment: data.comment ?? null },
        })
      : await tx.facilityReview.create({
          data: {
            facilityId: facility.id,
            patientId: patient.id,
            rating: data.rating,
            comment: data.comment ?? null,
          },
        });

    const aggregate = await tx.facilityReview.aggregate({
      where: { facilityId: facility.id, moderationStatus: "APPROVED" },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await tx.labStaffProfile.update({
      where: { id: facility.id },
      data: {
        ratingAvg: Math.round((aggregate._avg.rating ?? 0) * 10) / 10,
        ratingCount: aggregate._count.rating,
      },
    });

    return saved;
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "FACILITY_REVIEW_SUBMITTED",
    resourceType: "FacilityReview",
    resourceId: review.id,
    req,
  });

  return NextResponse.json({ review: { id: review.id, rating: review.rating } }, { status: 201 });
});
