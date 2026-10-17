import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";

const respondSchema = z.object({ response: z.string().trim().min(1).max(2000) });

// POST /api/doctor-reviews/[id]/respond — a doctor replies publicly to a review of themselves.
// The reply must not contain patient details; moderation can still hide the whole review.
export const POST = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  const { response } = await parseBody(req, respondSchema);

  const review = await prisma.doctorReview.findUnique({ where: { id }, select: { id: true, doctorId: true } });
  if (!review || review.doctorId !== doctor.id) throw notFound("Review not found");

  const updated = await prisma.doctorReview.update({
    where: { id },
    data: { doctorResponse: response, doctorRespondedAt: new Date() },
    select: { id: true, doctorResponse: true, doctorRespondedAt: true },
  });

  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_REVIEW_RESPONSE", resourceType: "DoctorReview", resourceId: id, req });
  return NextResponse.json({ response: updated });
});

// A doctor may retract or correct their reply by sending an empty response.
export const DELETE = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);

  const review = await prisma.doctorReview.findUnique({ where: { id }, select: { doctorId: true } });
  if (!review || review.doctorId !== doctor.id) throw notFound("Review not found");

  await prisma.doctorReview.update({ where: { id }, data: { doctorResponse: null, doctorRespondedAt: null } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_REVIEW_RESPONSE_REMOVED", resourceType: "DoctorReview", resourceId: id, req });
  return NextResponse.json({ success: true });
});
