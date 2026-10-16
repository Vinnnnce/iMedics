import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const moderationSchema = z.object({
  id: z.string().uuid(),
  moderationStatus: z.enum(["PENDING", "APPROVED", "REJECTED"]),
});

// GET /api/admin/reviews — recent reviews across the platform, with their moderation state.
export const GET = withAuth(["ADMIN"], async () => {
  const reviews = await prisma.doctorReview.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true, rating: true, comment: true, moderationStatus: true, updatedAt: true,
      doctorResponse: true,
      doctor: { select: { id: true, user: { select: { name: true } } } },
    },
  });
  return NextResponse.json({
    reviews: reviews.map(({ doctor, ...r }) => ({ ...r, doctorId: doctor.id, doctorName: doctor.user.name })),
  });
});

// PATCH /api/admin/reviews — moderate a review. Hiding a review also removes it from the doctor's
// averages. Moderation is admin-only: doctors cannot hide reviews of themselves.
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, moderationStatus } = await parseBody(req, moderationSchema);

  const review = await prisma.doctorReview.findUnique({ where: { id }, select: { id: true, doctorId: true } });
  if (!review) throw notFound("Review not found");

  const result = await prisma.$transaction(async (tx) => {
    await tx.doctorReview.update({
      where: { id },
      data: { moderationStatus, moderatedAt: new Date() },
    });
    // Averages only ever count approved reviews.
    const stats = await tx.doctorReview.aggregate({ where: { doctorId: review.doctorId, moderationStatus: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
    const ratingAvg = Math.round((stats._avg.rating ?? 0) * 100) / 100;
    await tx.doctorProfile.update({ where: { id: review.doctorId }, data: { ratingAvg, ratingCount: stats._count._all } });
    return { ratingAvg, ratingCount: stats._count._all };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "ADMIN_MODERATED_REVIEW",
    resourceType: "DoctorReview",
    resourceId: id,
    details: { moderationStatus },
    req,
  });

  return NextResponse.json({ success: true, ...result });
});
