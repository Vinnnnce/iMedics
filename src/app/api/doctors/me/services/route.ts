import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { doctorServiceInputSchema, doctorServiceSelect, serializeDoctorService } from "@/lib/doctor-profile";
import { resolveDiagnoses } from "@/lib/icd10/service";

// GET /api/doctors/me/services — the signed-in doctor's service catalogue (active and inactive).
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const services = await prisma.doctorService.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ isActive: "desc" }, { kind: "asc" }, { createdAt: "asc" }],
    select: doctorServiceSelect,
  });
  return NextResponse.json({ services: services.map(serializeDoctorService) });
});

// POST /api/doctors/me/services — add a service to the catalogue.
// ICD-10 codes are validated against the platform's active code set: unknown codes are rejected.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, doctorServiceInputSchema);

  // A service is priced in the doctor's own account currency; the booking flow relies on that.
  const doctorAccount = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctor.id }, select: { currency: true } });
  if (data.currency !== doctorAccount.currency) throw badRequest("Services must be priced in your account currency");

  if (data.icd10Codes.length > 0) {
    const { release, missing } = await resolveDiagnoses(data.icd10Codes);
    if (!release) throw badRequest("No ICD-10 code set has been imported yet, so codes cannot be linked yet");
    if (missing.length > 0) throw badRequest(`Unknown or non-assignable ICD-10 code: ${missing.join(", ")}`);
  }

  const created = await prisma.doctorService.create({
    data: {
      doctorId: doctor.id,
      kind: data.kind,
      name: data.name,
      description: data.description || null,
      modes: data.modes,
      durationMinutes: data.durationMinutes,
      currency: data.currency,
      price: data.price,
      followUpPrice: data.followUpPrice,
      followUpWindowDays: data.followUpWindowDays,
      isActive: data.isActive,
      icd10Codes: [...new Set(data.icd10Codes.map((c) => c.toUpperCase()))],
      cancellationTerms: data.cancellationTerms || null,
      refundTerms: data.refundTerms || null,
      includes: data.includes,
      addOns: data.addOns,
    },
    select: doctorServiceSelect,
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DOCTOR_SERVICE_CREATED",
    resourceType: "DoctorService",
    resourceId: created.id,
    details: { name: data.name, kind: data.kind, price: data.price, currency: data.currency },
    req,
  });

  return NextResponse.json({ service: serializeDoctorService(created) }, { status: 201 });
});
