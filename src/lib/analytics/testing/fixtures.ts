/**
 * Synthetic, de-identified dataset used to verify metric calculations. Every expected value in
 * analytics.int.test.ts is worked out by hand from this list, independently of the SQL.
 *
 * Time zone Africa/Lagos (UTC+1). Reporting period: 2026-11-01 … 2026-11-30 local.
 */
import type { PrismaClient } from "@prisma/client";

const d = (iso: string) => new Date(iso);

export interface Fixture {
  facilityId: string;
  ownerId: string;
  otherFacilityId: string;
  patients: Record<string, string>;
  wardAId: string;
  departmentId: string;
}

export async function seedHospital(db: PrismaClient, run: string): Promise<Fixture> {
  const owner = await db.user.create({ data: { clerkId: `an_${run}_owner`, email: `an-${run}-owner@example.test`, name: "Synthetic Owner", role: "LAB_SCIENTIST", accountType: "HOSPITAL", status: "ACTIVE", onboardingComplete: true } });
  const other = await db.user.create({ data: { clerkId: `an_${run}_other`, email: `an-${run}-other@example.test`, name: "Synthetic Other", role: "LAB_SCIENTIST", accountType: "HOSPITAL", status: "ACTIVE", onboardingComplete: true } });
  const facility = await db.labStaffProfile.create({ data: { userId: owner.id, laboratoryName: `SYNTHETIC ${run} A`, kind: "HOSPITAL", verificationStatus: "VERIFIED", isPublished: false, departments: [] } });
  const otherFacility = await db.labStaffProfile.create({ data: { userId: other.id, laboratoryName: `SYNTHETIC ${run} B`, kind: "HOSPITAL", verificationStatus: "VERIFIED", isPublished: false, departments: [] } });
  await db.hospitalSettings.create({ data: { facilityId: facility.id, timeZone: "Africa/Lagos", weekStartsOn: 1, financialYearStartMonth: 1 } });
  const department = await db.facilityDepartment.create({ data: { facilityId: facility.id, name: "Medicine", slug: "medicine", equipment: [] } });

  const mk = async (key: string, dob: string) => (await db.patient.create({ data: { caseNumber: `QA-${run}-${key}`, firstName: "Synthetic", lastName: key, dateOfBirth: d(dob), gender: "OTHER" } })).id;
  const patients = { P1: await mk("P1", "1990-05-01"), P2: await mk("P2", "1950-03-01"), P3: await mk("P3", "2015-01-01"), P4: await mk("P4", "1985-07-01"), P5: await mk("P5", "1970-01-01"), P6: await mk("P6", "2000-01-01") };

  const wardA = await db.ward.create({ data: { facilityId: facility.id, name: "Ward A", departmentId: department.id } });
  const icu = await db.ward.create({ data: { facilityId: facility.id, name: "ICU" } });
  const bedsA = await Promise.all([["A-1", "OCCUPIED"], ["A-2", "AVAILABLE"], ["A-3", "MAINTENANCE"]].map(([label, status]) => db.bed.create({ data: { facilityId: facility.id, wardId: wardA.id, label, status } })));
  await db.bed.create({ data: { facilityId: facility.id, wardId: icu.id, label: "ICU-1", status: "AVAILABLE" } });

  const adm = (patientId: string, over: Record<string, unknown>) => db.admission.create({ data: { facilityId: facility.id, patientId, ward: "Ward A", ...over } as never });
  const A1 = await adm(patients.P1, { admissionDate: d("2026-11-02T10:00:00Z"), status: "DISCHARGED", dischargeDate: d("2026-11-06T10:00:00Z"), disposition: "RECOVERED", epicrisis: "Summary", finalDiagnosisName: "Pneumonia" });
  const A2 = await adm(patients.P2, { ward: "ICU", admissionDate: d("2026-11-03T10:00:00Z"), status: "DISCHARGED", dischargeDate: d("2026-11-05T10:00:00Z"), disposition: "DECEASED", epicrisis: "Summary", finalDiagnosisName: "Sepsis" });
  const A3 = await adm(patients.P3, { admissionDate: d("2026-11-10T10:00:00Z"), status: "DISCHARGED", dischargeDate: d("2026-11-20T10:00:00Z"), disposition: "IMPROVED", epicrisis: null, finalDiagnosisName: "Asthma" });
  const A4 = await adm(patients.P1, { admissionDate: d("2026-11-12T10:00:00Z"), status: "ACTIVE", currentBedId: bedsA[0].id, currentWardId: wardA.id });
  const A5 = await adm(patients.P4, { admissionDate: d("2026-11-15T10:00:00Z"), status: "TRANSFERRED", transferredToFacilityId: otherFacility.id });
  await adm(patients.P5, { admissionDate: d("2026-10-28T10:00:00Z"), status: "DISCHARGED", dischargeDate: d("2026-11-02T10:00:00Z"), disposition: "IMPROVED", epicrisis: "Summary" });
  await adm(patients.P6, { admissionDate: d("2026-11-05T10:00:00Z"), status: "CANCELLED" });
  await db.bed.update({ where: { id: bedsA[0].id }, data: { currentAdmissionId: A4.id } });
  await db.auditLog.create({ data: { facilityId: facility.id, action: "ADMISSION_INTERFACILITY_TRANSFER", resourceType: "Admission", resourceId: A5.id, createdAt: d("2026-11-18T10:00:00Z") } });
  await db.wardTransfer.create({ data: { admissionId: A3.id, fromWard: "Ward A", toWard: "ICU", actorId: owner.id, transferredAt: d("2026-11-11T10:00:00Z") } });

  const enc = (n: string, patientId: string, over: Record<string, unknown>) => db.encounter.create({ data: { facilityId: facility.id, patientId, encounterNumber: `E-${run}-${n}`, createdById: owner.id, department: "Medicine", ...over } as never });
  await enc("1", patients.P1, { type: "EMERGENCY_INPATIENT", isEmergency: true, priority: "EMERGENCY", status: "ADMITTED", registeredAt: d("2026-11-02T08:00:00Z"), admissionId: A1.id, triagedAt: d("2026-11-02T08:10:00Z") });
  await enc("2", patients.P2, { type: "EMERGENCY_INPATIENT", isEmergency: true, priority: "EMERGENCY", status: "ADMITTED", registeredAt: d("2026-11-03T08:00:00Z"), admissionId: A2.id, triagedAt: d("2026-11-03T08:30:00Z") });
  await enc("3", patients.P3, { type: "PLANNED_INPATIENT", priority: "ELECTIVE", status: "ADMITTED", registeredAt: d("2026-11-10T08:00:00Z"), admissionId: A3.id });
  await enc("4", patients.P5, { type: "SCHEDULED_OUTPATIENT", priority: "ROUTINE", status: "DISCHARGED", registeredAt: d("2026-11-04T08:00:00Z"), closedAt: d("2026-11-04T09:00:00Z") });
  await enc("5", patients.P6, { type: "EMERGENCY_DEPARTMENT", isEmergency: true, priority: "URGENT", status: "DID_NOT_ATTEND", registeredAt: d("2026-11-05T08:00:00Z") });
  await enc("6", patients.P6, { type: "SCHEDULED_OUTPATIENT", priority: "ROUTINE", status: "CANCELLED", registeredAt: d("2026-11-06T08:00:00Z") });
  return { facilityId: facility.id, ownerId: owner.id, otherFacilityId: otherFacility.id, patients, wardAId: wardA.id, departmentId: department.id };
}

export async function cleanup(db: PrismaClient, run: string): Promise<void> {
  const facilities = await db.labStaffProfile.findMany({ where: { laboratoryName: { startsWith: `SYNTHETIC ${run}` } }, select: { id: true } });
  const ids = facilities.map((f) => f.id);
  // audit_logs is append-only by design; the disposable test database is dropped instead.
  await db.encounter.deleteMany({ where: { facilityId: { in: ids } } });
  await db.admission.updateMany({ where: { facilityId: { in: ids } }, data: { currentBedId: null } });
  await db.bed.deleteMany({ where: { facilityId: { in: ids } } });
  await db.admission.deleteMany({ where: { facilityId: { in: ids } } });
  await db.ward.deleteMany({ where: { facilityId: { in: ids } } });
}
