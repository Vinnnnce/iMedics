import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId, parseQuery } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { resolveConsultationFee } from "@/lib/pricing";

const querySchema = z.object({ scheduledAt: z.coerce.date().optional(), serviceId: z.string().uuid().optional() });

// GET /api/doctors/[id]/pricing?scheduledAt=ISO — what this patient would pay for a consultation at that time,
// and whether the follow-up rate applies. The same calculation is repeated when booking.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const doctorId = parseId((await params).id);
  const { scheduledAt, serviceId } = parseQuery(req, querySchema);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  const patient =
    user.role === "PATIENT" ? await prisma.patient.findFirst({ where: { userId: user.id, deletedAt: null }, select: { id: true } }) : null;
  return NextResponse.json({ fee: await resolveConsultationFee(doctorId, patient?.id ?? null, scheduledAt ?? new Date(), undefined, serviceId ?? null) });
});
