import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { moduleForPath } from "@/lib/platform/policy";
import { assertStaffCanReachPatient, type StaffMembershipInfo } from "@/lib/staff-access";
const protectedModules = new Set(["PATIENTS", "CLINICAL_DOCUMENTS", "CONSULTATIONS", "PRESCRIPTIONS", "LABORATORY", "DIAGNOSTICS", "NURSING", "ADMISSIONS", "EMERGENCY"]);
/**
 * Common patient boundary for facility APIs. Limited/department users cannot
 * fall back to unfiltered collections or unknown patient-resource identifiers.
 * Detailed handlers still enforce their tenant, workflow and professional checks.
 */
export async function assertRequestPatientScope(membership: StaffMembershipInfo, req: Request) {
  const url = new URL(req.url), path = url.pathname;
  const featureModule = moduleForPath(path);
  if (!featureModule || !protectedModules.has(featureModule)) return;
  const limited = ["LIMITED", "DEPARTMENT"].includes(membership.accessLevel);
  const resource = path.match(/\/([^/]+)\/([0-9a-f-]{36})(?:\/|$)/i);
  let patientId: string | null = null;
  if (resource) {
    const [ , type, id ] = resource;
    const where = { id, facilityId: membership.facilityId };
    if (type === "documents" && path.includes("/his/")) patientId = (await prisma.clinicalDocument.findFirst({ where, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "encounters") patientId = (await prisma.encounter.findFirst({ where, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "admissions") patientId = (await prisma.admission.findFirst({ where, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "medication-orders") patientId = (await prisma.medicationOrder.findFirst({ where, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "media") patientId = (await prisma.medicalMedia.findFirst({ where, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "lab-orders") patientId = (await prisma.labOrder.findFirst({ where: { id, OR: [{ performingFacilityId: membership.facilityId }, { requestingFacilityId: membership.facilityId }] }, select: { patientId: true } }))?.patientId ?? null;
    else if (type === "patients") patientId = id;
    // Never let a supplied patientId override a different path resource.
    if (!patientId && limited) throw notFound("Patient-scoped access is required for this resource");
  } else {
    patientId = url.searchParams.get("patientId");
    if (!patientId && !["GET", "HEAD"].includes(req.method) && req.headers.get("content-type")?.includes("application/json")) {
      const body = await req.clone().json().catch(() => null);
      if (typeof body?.patientId === "string") patientId = body.patientId;
    }
  }
  if (patientId) {
    if (!/^[0-9a-f-]{36}$/i.test(patientId)) throw notFound("Patient not found");
    await assertStaffCanReachPatient(membership, patientId);
  } else if (limited) throw notFound("Select an assigned patient before accessing clinical records");
}
