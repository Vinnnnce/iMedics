/**
 * POST /api/facility/his/registration/search
 *
 * Patient search / duplicate-check step of the registration workspace.
 * Accepts any combination of case number, name, date of birth, phone, email,
 * identity or insurance number and returns the patient records registered at
 * this facility that match — both for finding an existing patient and for
 * reviewing possible duplicates before a new registration.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { requireHisAccess } from "@/lib/his/access";
import { newPatientSchema, findPotentialDuplicates } from "@/lib/his/registration";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(160),
});

const newPatientCheckSchema = newPatientSchema;

export const POST = withAuth(null, async (req, { user }) => {
  const access = await requireHisAccess(user, "MANAGE_ENCOUNTERS", req, ["HOSPITAL"]);
  const facilityId = access.facility.id;
  const body = await parseBody(req, searchSchema);
  const query = body.query.trim();

  // A structured new-patient form produces better duplicate detection than a
  // free-text query: if the payload parses as new-patient data, run the scored
  // duplicate finder as well.
  let newPatientData: z.infer<typeof newPatientCheckSchema> | null = null;
  try {
    newPatientData = newPatientCheckSchema.parse(JSON.parse(query));
  } catch {
    newPatientData = null;
  }

  const where = {
    deletedAt: null,
    OR: [
      { caseNumber: { contains: query.toUpperCase(), mode: "insensitive" as const } },
      { firstName: { contains: query, mode: "insensitive" as const } },
      { lastName: { contains: query, mode: "insensitive" as const } },
      { phone: { contains: query } },
      { email: { contains: query } },
      { identityNumber: { contains: query } },
      { insuranceNumber: { contains: query } },
    ],
  };

  const [patients, duplicates] = await Promise.all([
    prisma.patient.findMany({
      where: {
        ...where,
        encounters: { some: { facilityId } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true, caseNumber: true, firstName: true, lastName: true, middleName: true, gender: true,
        dateOfBirth: true, phone: true, email: true, identityNumber: true, unidentified: true,
      },
    }),
    newPatientData ? findPotentialDuplicates(prisma, facilityId, newPatientData) : Promise.resolve([]),
  ]);

  // Merge scored duplicates into the plain matches, de-duplicated by id.
  const seen = new Set<string>();
  const results = [
    ...duplicates,
    ...patients.map((p) => ({
      id: p.id,
      caseNumber: p.caseNumber,
      firstName: p.firstName,
      lastName: p.lastName,
      middleName: p.middleName,
      gender: p.gender,
      dateOfBirth: p.dateOfBirth.toISOString().slice(0, 10),
      phone: p.phone,
      email: p.email,
      unidentified: p.unidentified,
      score: 0,
      reasons: [] as string[],
    })),
  ].filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));

  return NextResponse.json({ patients: results });
});
