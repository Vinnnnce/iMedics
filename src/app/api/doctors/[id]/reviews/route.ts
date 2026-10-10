import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { forbidden, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

// POST /api/doctors/[id]/reviews — rate (and optionally comment on) a doctor.
// Only patients who have had a completed appointment with the doctor may review; one review each.
export const POST = withAuth<{ id: string }>(["PATIENT"], async (req, { user, params }) => {
  const doctorId = parseId((await params).id);
  const { rating, comment } = await parseBody(req, schema);

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
      create: { patientId: patient.id, doctorId, rating, comment: comment || null },
      update: { rating, comment: comment || null },
    });
    const stats = await tx.doctorReview.aggregate({ where: { doctorId }, _avg: { rating: true }, _count: { _all: true } });
    const ratingAvg = Math.round((stats._avg.rating ?? 0) * 100) / 100;
    await tx.doctorProfile.update({ where: { id: doctorId }, data: { ratingAvg, ratingCount: stats._count._all } });
    return { ratingAvg, ratingCount: stats._count._all };
  });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_REVIEWED", resourceType: "DoctorProfile", resourceId: doctorId, req });
  return NextResponse.json({ success: true, ...aggregates }, { status: 201 });
});
