import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";

const querySchema = z.object({
  patientId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// GET /api/prescriptions — doctors see the prescriptions they wrote, patients see their own.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { patientId, limit } = parseQuery(req, querySchema);

  const where: Prisma.PrescriptionWhereInput =
    user.role === "DOCTOR"
      ? { doctorId: (await getVerifiedDoctorProfile(user)).id, ...(patientId ? { patientId } : {}) }
      : { patient: { userId: user.id, deletedAt: null } };

  const prescriptions = await prisma.prescription.findMany({
    where,
    orderBy: { issuedAt: "desc" },
    take: limit,
    include: {
      items: true,
      doctor: { select: { id: true, user: { select: { name: true } } } },
      patient: { select: { id: true, firstName: true, lastName: true, caseNumber: true } },
    },
  });

  return NextResponse.json({
    prescriptions: prescriptions.map(({ doctor, patient, ...p }) => ({
      ...p,
      doctor: { id: doctor.id, name: doctor.user.name },
      patient: { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, caseNumber: patient.caseNumber },
    })),
  });
});
