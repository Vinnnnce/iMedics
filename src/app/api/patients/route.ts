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
import { notFound } from "@/lib/errors";

/** The registration payload may carry duplicate-review decisions. */
const createPatientSchema = patientInputSchema.extend({
  /** Register despite a possible-duplicate warning after human review. */
  force: z.boolean().optional(),
  /** Link the doctor's care to an existing patient record instead of creating one. */
  linkTo: z.string().uuid().optional(),
});

// POST /api/patients — a doctor registers a new patient and admits them to their care.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, createPatientSchema);

  // Duplicate prevention (spec: patient identity matching). Before creating a
  // record, the server looks for live patients with the same first and last
  // name (case-insensitive) born on the same date. Matches are returned for
  // the doctor's review — the system never merges or creates silently.
  const dob = new Date(data.dateOfBirth);
  const dobStart = new Date(Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate()));
  const dobEnd = new Date(Date.UTC(dob.getUTCFullYear(), dob.getUTCMonth(), dob.getUTCDate() + 1));

  // Linking: the doctor confirmed an existing record is this patient, so the
  // existing identity is reused and the doctor joins that record's care team.
  if (data.linkTo) {
    const existing = await prisma.patient.findFirst({
      where: { id: data.linkTo, deletedAt: null },
    });
    if (!existing) throw notFound("The selected patient record was not found");
    const assignment = await prisma.patientAssignment.upsert({
      where: { patientId_doctorId: { patientId: existing.id, doctorId: doctor.id } },
      create: { patientId: existing.id, doctorId: doctor.id },
      update: { status: "ACTIVE", dischargedAt: null },
    });
    await writeAudit({
      userId: user.id,
      actorRole: user.role,
      action: "PATIENT_LINKED",
      resourceType: "Patient",
      resourceId: existing.id,
      req,
    });
    return NextResponse.json({
      ...serializePatient(existing),
      linked: true,
      assignmentStatus: assignment.status,
    });
  }

  if (!data.force) {
    const matches = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        firstName: { equals: data.firstName.trim(), mode: "insensitive" },
        lastName: { equals: data.lastName.trim(), mode: "insensitive" },
        dateOfBirth: { gte: dobStart, lt: dobEnd },
      },
      take: 5,
      select: {
        id: true,
        caseNumber: true,
        firstName: true,
        lastName: true,
        dateOfBirth: true,
        assignments: { where: { status: "ACTIVE" }, select: { doctorId: true } },
      },
    });
    if (matches.length > 0) {
      return NextResponse.json(
        {
          error: "Possible existing patient records were found. Review them before creating a duplicate.",
          matches: matches.map((m) => ({
            id: m.id,
            caseNumber: m.caseNumber,
            firstName: m.firstName,
            lastName: m.lastName,
            dateOfBirth: m.dateOfBirth,
          })),
        },
        { status: 409 },
      );
    }
  }

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
