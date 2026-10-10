import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";

async function setLike(userId: string, doctorId: string, liked: boolean) {
  const patient = await prisma.patient.findFirst({ where: { userId, deletedAt: null }, select: { id: true } });
  if (!patient) throw notFound("Patient record not found");
  const doctor = await prisma.doctorProfile.findFirst({ where: { id: doctorId, verificationStatus: "VERIFIED" }, select: { id: true } });
  if (!doctor) throw notFound("Doctor not found");

  const likeCount = await prisma.$transaction(async (tx) => {
    if (liked) {
      await tx.doctorLike.upsert({
        where: { patientId_doctorId: { patientId: patient.id, doctorId } },
        create: { patientId: patient.id, doctorId },
        update: {},
      });
    } else {
      await tx.doctorLike.deleteMany({ where: { patientId: patient.id, doctorId } });
    }
    const count = await tx.doctorLike.count({ where: { doctorId } });
    await tx.doctorProfile.update({ where: { id: doctorId }, data: { likeCount: count } });
    return count;
  });
  return NextResponse.json({ liked, likeCount });
}

// POST /api/doctors/[id]/like — like a doctor
export const POST = withAuth<{ id: string }>(["PATIENT"], async (_req, { user, params }) =>
  setLike(user.id, parseId((await params).id), true),
);

// DELETE /api/doctors/[id]/like — remove the like
export const DELETE = withAuth<{ id: string }>(["PATIENT"], async (_req, { user, params }) =>
  setLike(user.id, parseId((await params).id), false),
);
