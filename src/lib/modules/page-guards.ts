/**
 * Server-side page guards for the three modules. The real authorization is
 * enforced by the API routes (see lib/modules/access-matrix.ts); these guards
 * only keep the navigation honest — a wrong-kind facility is redirected to
 * its own portal home instead of seeing module screens.
 */

import { redirect } from "next/navigation";
import { requireFacilityPortalPage } from "@/lib/guards";
import { resolveFacilityForPortalUser } from "@/lib/facility-auth";
import { prisma } from "@/lib/prisma";
import type { FacilityKindValue } from "./access-matrix";

/**
 * Resolve the signed-in facility and its organization kind. Returns null when
 * the user has no facility or the kind cannot be determined.
 */
export async function currentFacilityKind(): Promise<{ facilityId: string; kind: FacilityKindValue | null } | null> {
  const user = await requireFacilityPortalPage();
  const facility = await resolveFacilityForPortalUser(user);
  if (!facility) return null;
  if (facility.kind) return { facilityId: facility.id, kind: facility.kind };
  // Legacy facilities: derive the kind from the owner's account type.
  const owner = await prisma.user.findUnique({
    where: { id: facility.userId },
    select: { accountType: true },
  });
  const at = owner?.accountType;
  const kind: FacilityKindValue | null =
    at === "HOSPITAL" || at === "LABORATORY" || at === "DIAGNOSTIC_CENTRE" ? at : null;
  return { facilityId: facility.id, kind };
}

/** Guard a module page for the given facility kinds (redirects otherwise). */
export async function requireModulePage(...kinds: FacilityKindValue[]) {
  const resolved = await currentFacilityKind();
  if (!resolved || !resolved.kind) redirect("/lab/dashboard");
  if (!kinds.includes(resolved.kind)) redirect("/lab/dashboard");
  return resolved;
}
