import { prisma } from "@/lib/prisma";
import { forbidden } from "@/lib/errors";
import type { FacilityPermission } from "@/lib/facility-staff";

export const REGULATED_PERMISSIONS: readonly FacilityPermission[] = [
  "VERIFY_RESULTS", "RELEASE_RESULTS", "REVIEW_DOCUMENTS", "SIGN_DOCUMENTS",
  "APPROVE_DOCUMENTS", "ORDER_MEDICATIONS", "REVIEW_MEDICATIONS", "ADMINISTER_MEDICATIONS",
];
export async function filterClinicalPrivileges(staffId: string, permissions: readonly FacilityPermission[]): Promise<FacilityPermission[]> {
  if (!permissions.some((p) => REGULATED_PERMISSIONS.includes(p))) return [...permissions];
  const now = new Date();
  const grants = await prisma.clinicalPrivilege.findMany({
    where: { staffId, revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now },
      credential: { staffId, verificationStatus: "VERIFIED", renewalStatus: { not: "LAPSED" },
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] } },
    select: { permission: true },
  });
  const allowed = new Set(grants.map((g) => g.permission));
  return permissions.filter((p) => !REGULATED_PERMISSIONS.includes(p) || allowed.has(p));
}
/** Rank, owner status and global administration never confer regulated authorization. */
export async function assertClinicalPrivilege(staffId: string, permission: FacilityPermission) {
  if (!REGULATED_PERMISSIONS.includes(permission)) return;
  const now = new Date();
  const grant = await prisma.clinicalPrivilege.findFirst({
    where: { staffId, permission, revokedAt: null, startsAt: { lte: now }, expiresAt: { gt: now },
      credential: { staffId, verificationStatus: "VERIFIED", renewalStatus: { not: "LAPSED" },
        OR: [{ expiryDate: null }, { expiryDate: { gt: now } }] } },
    select: { id: true },
  });
  if (!grant) throw forbidden("A separately authorized clinical privilege and verified current credential are required");
}
