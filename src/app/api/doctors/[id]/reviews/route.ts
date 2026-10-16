import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { queueNotification } from "@/lib/notifications/service";

const ratingSchema = z.number().int().min(1).max(5).nullable();

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  // Optional 1-5 ratings per category; the overall rating stays the required headline number.
  communicationRating: ratingSchema.optional(),
  professionalismRating: ratingSchema.optional(),
  punctualityRating: ratingSchema.optional(),
  explanationRating: ratingSchema.optional(),
});

// POST /api/doctors/[id]/reviews — rate (and optionally comment on) a doctor.
// Only patients who have had a completed appointment with the doctor may review; one review each.
// Reviews publish immediately (the platform's existing behaviour); admins can hide one via moderation.
export const POST = withAuth<{ id: string }>(["PATIENT"], async (req, { user, params }) => {
  const doctorId = parseId((await params).id);
  const data = await parseBody(req, schema);

  const patient = await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } });
  if (!patient) throw notFound("Patient record not found");

  const completed = await prisma.appointment.findFirst({
    where: { patientId: patient.id, doctorId, status: "COMPLETED" },
    select: { id: true },
  });
  if (!completed) throw forbidden("You can review a doctor after a completed appointment");

  const aggregates = await prisma.$transaction(async (tx) => {
    await tx.doctorReview.upsert({
      where: { patientId_doctorId: { patientId: patient.id, doctorId } },
      create: {
        patientId: patient.id,
        doctorId,
        rating: data.rating,
        comment: data.comment || null,
        communicationRating: data.communicationRating ?? null,
        professionalismRating: data.professionalismRating ?? null,
        punctualityRating: data.punctualityRating ?? null,
        explanationRating: data.explanationRating ?? null,
      },
      update: {
        rating: data.rating,
        comment: data.comment || null,
        communicationRating: data.communicationRating ?? null,
        professionalismRating: data.professionalismRating ?? null,
        punctualityRating: data.punctualityRating ?? null,
        explanationRating: data.explanationRating ?? null,
      },
    });
    // Averages only ever count approved reviews.
    const stats = await tx.doctorReview.aggregate({ where: { doctorId, moderationStatus: "APPROVED" }, _avg: { rating: true }, _count: { _all: true } });
    const ratingAvg = Math.round((stats._avg.rating ?? 0) * 100) / 100;
    await tx.doctorProfile.update({ where: { id: doctorId }, data: { ratingAvg, ratingCount: stats._count._all } });
    return { ratingAvg, ratingCount: stats._count._all };
  });

  const doctor = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctorId }, select: { userId: true } });
  await queueNotification(doctor.userId, { kind: "REVIEW_SUBMITTED", reviewId: doctorId });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_REVIEWED", resourceType: "DoctorProfile", resourceId: doctorId, req });
  return NextResponse.json({ success: true, ...aggregates }, { status: 201 });
});
