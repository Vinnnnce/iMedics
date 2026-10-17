import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest, notFound } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { doctorServiceInputSchema, doctorServiceSelect, serializeDoctorService } from "@/lib/doctor-profile";
import { resolveDiagnoses } from "@/lib/icd10/service";



async function ownService(doctorId: string, id: string) {
  const service = await prisma.doctorService.findUnique({ where: { id }, select: { doctorId: true } });
  if (!service || service.doctorId !== doctorId) throw notFound("Service not found");
  return service;
}

// PUT /api/doctors/me/services/[id] — edit one of the doctor's own services.
// Existing appointments keep the name and price they were booked at (snapshotted).
export const PUT = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  await ownService(doctor.id, id);
  const data = await parseBody(req, doctorServiceInputSchema);

  // A service is priced in the doctor's own account currency; the booking flow relies on that.
  const doctorAccount = await prisma.doctorProfile.findUniqueOrThrow({ where: { id: doctor.id }, select: { currency: true } });
  if (data.currency !== doctorAccount.currency) throw badRequest("Services must be priced in your account currency");

  if (data.icd10Codes.length > 0) {
    const { release, missing } = await resolveDiagnoses(data.icd10Codes);
    if (!release) throw badRequest("No ICD-10 code set has been imported yet, so codes cannot be linked yet");
    if (missing.length > 0) throw badRequest(`Unknown or non-assignable ICD-10 code: ${missing.join(", ")}`);
  }

  const updated = await prisma.doctorService.update({
    where: { id },
    data: {
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
    action: "DOCTOR_SERVICE_UPDATED",
    resourceType: "DoctorService",
    resourceId: id,
    details: { name: data.name, kind: data.kind, price: data.price, currency: data.currency },
    req,
  });

  return NextResponse.json({ service: serializeDoctorService(updated) });
});

// DELETE /api/doctors/me/services/[id] — remove a service no doctor appointment still points at.
// Services referenced by appointments are deactivated instead, so history stays honest.
export const DELETE = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  await ownService(doctor.id, id);

  const referenced = await prisma.appointment.count({ where: { serviceId: id }, take: 1 });
  let service;
  if (referenced > 0) {
    service = await prisma.doctorService.update({ where: { id }, data: { isActive: false }, select: doctorServiceSelect });
  } else {
    await prisma.doctorService.delete({ where: { id } });
    await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_SERVICE_DELETED", resourceType: "DoctorService", resourceId: id, req });
    return NextResponse.json({ deleted: true });
  }

  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_SERVICE_DEACTIVATED", resourceType: "DoctorService", resourceId: id, req });
  return NextResponse.json({ deleted: false, service: serializeDoctorService(service) });
});
