import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { doctorServiceSelect, serializeDoctorService } from "@/lib/doctor-profile";

// GET /api/doctors/[id]/services — a verified doctor's active services, as patients may book them.
// Prices are display data only; the booking route re-validates and re-prices on the server.
export const GET = withAuth<{ id: string }>(null, async (_req, { params }) => {
  const doctorId = parseId((await params).id);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  const services = await prisma.doctorService.findMany({
    where: { doctorId, isActive: true },
    orderBy: [{ kind: "asc" }, { price: "asc" }],
    select: doctorServiceSelect,
  });

  return NextResponse.json({ services: services.map(serializeDoctorService) });
});
