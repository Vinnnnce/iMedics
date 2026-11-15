import type { Role } from "@prisma/client";
import { getRoleNavigation, type NavItem } from "./navigation";
import { ADMIN_LINKS } from "@/components/admin/admin-links";

export type FacilityKind = "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE" | "PHARMACY";

const H: FacilityKind = "HOSPITAL";
const L: FacilityKind = "LABORATORY";
const D: FacilityKind = "DIAGNOSTIC_CENTRE";
const P: FacilityKind = "PHARMACY";

/**
 * Facility modules that only make sense for some organisation kinds. Items that are
 * not listed here are shown to every facility. This only shapes the menu: each page and
 * API route still enforces the facility kind and permissions on the server.
 */
const FACILITY_ITEM_KINDS: Record<string, readonly FacilityKind[]> = {
  "/lab/his": [H],
  "/lab/clinical-documents": [H, L, D],
  "/lab/encounters": [H],
  "/lab/media": [H, D],
  "/lab/insurance": [H],
  "/lab/admissions": [H],
  "/lab/orders": [L],
  "/lab/specimens": [L],
  "/lab/examinations": [D],
  "/lab/investigations": [H],
  "/lab/critical-alerts": [H, L],
  "/lab/upload": [L],
  "/lab/emergency": [H],
  "/lab/wards": [H],
  "/lab/nursing": [H],
  "/lab/pharmacy": [H, P],
  "/lab/lab-equipment": [L],
  "/lab/registration": [H, L, D],
};

function pathOf(href: string): string {
  return href.split("?")[0];
}

/** The menu for an account: its role navigation, narrowed to the facility's kind. */
export function visibleNavigation(
  role: Role | null | undefined,
  facilityKind: FacilityKind | null | undefined,
): readonly NavItem[] {
  // Administrators use the single admin link list, so the app menu and the admin sidebar never drift.
  if (role === "ADMIN") return ADMIN_LINKS.map(({ href, label, icon }) => ({ href, label, icon }));
  const items = getRoleNavigation(role);
  if (role !== "LAB_SCIENTIST" || !facilityKind) return items;
  return items.filter((item) => {
    const kinds = FACILITY_ITEM_KINDS[pathOf(item.href)];
    return !kinds || kinds.includes(facilityKind);
  });
}
