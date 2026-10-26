import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import { permissionsForRole, FACILITY_PERMISSIONS, type FacilityPermission } from "@/lib/facility-staff";
import { currentFacilityKind } from "@/lib/modules/page-guards";
import type { FacilityKindValue } from "@/lib/modules/access-matrix";

/**
 * Page guard for HIS screens: facility membership, organization kind and a
 * facility permission. Pages only shape navigation — the APIs enforce the
 * same rules independently.
 */
export async function requireHisPage(permission: FacilityPermission | null, kinds: FacilityKindValue[] = ["HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"]) {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  const resolved = await currentFacilityKind();
  const kind = resolved?.kind ?? null;
  if (!kind || !kinds.includes(kind)) redirect("/lab/dashboard");
  const own = facility.userId === user.id;
  const memberships = await prisma.facilityStaff.findMany({
    where: { userId: user.id, facilityId: facility.id, status: { in: ["ACTIVE", "ON_LEAVE"] } },
    select: { facilityRole: true },
  });
  const permissions = new Set<FacilityPermission>(own ? FACILITY_PERMISSIONS : memberships.flatMap((m) => [...permissionsForRole(m.facilityRole)]));
  if (permission && !permissions.has(permission)) redirect("/lab/dashboard");
  return { user, facility, kind, permissions, can: (p: FacilityPermission) => permissions.has(p) };
}
