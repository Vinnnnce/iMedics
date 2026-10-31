import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireFacilityAccess } from "@/lib/facility-auth";
import { forbidden } from "@/lib/errors";

/** Shared by the page and API so preview and writes never select different tenants. */
export async function requireWebsiteAccess(user: User, req?: Request) {
  if (user.status !== "ACTIVE") throw forbidden("Your account is not active");
  // Owners without backfilled staff rows remain supported. Existing membership
  // rows, including suspended ones, must always pass the normal access guard.
  if (user.role === "LAB_SCIENTIST") {
    const own = await prisma.labStaffProfile.findUnique({ where: { userId: user.id } });
    const requested = req && (new URL(req.url).searchParams.get("facilityId") || req.headers.get("x-facility-id"));
    if (own && (!requested || requested === own.id)) {
      const ownMemberships = await prisma.facilityStaff.count({ where: { userId: user.id, facilityId: own.id } });
      if (ownMemberships === 0) return { facility: own };
    }
  }
  return requireFacilityAccess(user, "MANAGE_PROFILE", req, { requireVerified: false });
}
