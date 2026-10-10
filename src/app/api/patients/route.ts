import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseQuery } from "@/lib/api";
import { getVerifiedDoctorProfile, patientScope } from "@/lib/access";
import { generateCaseNumber } from "@/lib/case-number";
import { toPatientColumns, serializePatient } from "@/lib/patient";
import { patientInputSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";

// POST /api/patients — a doctor registers a new patient and admits them to their care.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, patientInputSchema);

  const patient = await prisma.patient.create({
    data: {
      caseNumber: generateCaseNumber(),
      ...toPatientColumns(data),
      assignments: { create: { doctorId: doctor.id } },
    },
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "PATIENT_CREATED",
    resourceType: "Patient",
    resourceId: patient.id,
    req,
  });

  return NextResponse.json(serializePatient(patient), { status: 201 });
});

const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/patients — doctors list their assigned patients; patients see their own record.
export const GET = withAuth(["DOCTOR", "PATIENT"], async (req, { user }) => {
  const { search, limit, offset } = parseQuery(req, listQuerySchema);
  const scope = await patientScope(user);

  const where: Prisma.PatientWhereInput = search
    ? {
        AND: [
          scope.where,
          {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { caseNumber: { contains: search, mode: "insensitive" } },
            ],
          },
        ],
      }
    : scope.where;

  const [rows, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      include: {
        assignments: {
          where: { doctorId: scope.doctorId ?? undefined },
          select: { status: true, admittedAt: true, dischargedAt: true },
        },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return NextResponse.json({ patients: rows.map(serializePatient), total });
});
