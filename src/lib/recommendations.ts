import type { AccountType, Role } from "@prisma/client";

/**
 * Personalized recommendation categories shown on the dashboards.
 *
 * Each account type sees the four categories it does not belong to:
 * - Patients: doctors, hospitals, laboratories, diagnostic centres
 * - Doctors: patients, hospitals, laboratories, diagnostic centres
 * - Hospitals: doctors, patients, laboratories, diagnostic centres
 * - Laboratories: doctors, patients, hospitals, diagnostic centres
 * - Diagnostic centres: doctors, patients, hospitals, laboratories
 */

export const RECOMMENDATION_CATEGORY_KEYS = [
  "doctors",
  "patients",
  "hospitals",
  "laboratories",
  "diagnosticCentres",
] as const;

export type RecommendationCategoryKey = (typeof RECOMMENDATION_CATEGORY_KEYS)[number];

export const RECOMMENDATION_CATEGORY_LABELS: Record<RecommendationCategoryKey, string> = {
  doctors: "Doctors",
  patients: "Patients",
  hospitals: "Hospitals",
  laboratories: "Laboratories",
  diagnosticCentres: "Diagnostic centres",
};

/** The account perspective a dashboard renders recommendations for. */
export type RecommendationViewer =
  | { type: "PATIENT" }
  | { type: "DOCTOR" }
  | { type: "HOSPITAL" }
  | { type: "LABORATORY" }
  | { type: "DIAGNOSTIC_CENTRE" };

export type RecommendationViewerType = RecommendationViewer["type"];

/** Dashboard context that selects which perspective to build recommendations for. */
export const RECOMMENDATION_CONTEXTS = ["patient", "doctor", "facility"] as const;
export type RecommendationContext = (typeof RECOMMENDATION_CONTEXTS)[number];

export interface RecommendationItem {
  id: string;
  name: string;
  subtitle: string | null;
  href: string;
}

export interface RecommendationCategory {
  key: RecommendationCategoryKey;
  label: string;
  items: RecommendationItem[];
}

/** The categories a viewer should see: every category except its own account type. */
export function categoriesForViewer(
  viewer: RecommendationViewerType,
): RecommendationCategoryKey[] {
  const ownKey: Record<RecommendationViewerType, RecommendationCategoryKey> = {
    PATIENT: "patients",
    DOCTOR: "doctors",
    HOSPITAL: "hospitals",
    LABORATORY: "laboratories",
    DIAGNOSTIC_CENTRE: "diagnosticCentres",
  };
  return RECOMMENDATION_CATEGORY_KEYS.filter((key) => key !== ownKey[viewer]);
}

/** Map an existing account type to the viewer perspective, if it is one. */
export function viewerFromAccountType(accountType: AccountType | null): RecommendationViewerType | null {
  switch (accountType) {
    case "PATIENT":
      return "PATIENT";
    case "DOCTOR":
      return "DOCTOR";
    case "HOSPITAL":
      return "HOSPITAL";
    case "LABORATORY":
      return "LABORATORY";
    case "DIAGNOSTIC_CENTRE":
      return "DIAGNOSTIC_CENTRE";
    default:
      return null;
  }
}

/** Map a role to the default dashboard perspective (facilities resolve via the portal). */
export function viewerFromRole(role: Role): RecommendationContext {
  switch (role) {
    case "PATIENT":
      return "patient";
    case "DOCTOR":
      return "doctor";
    case "LAB_SCIENTIST":
      return "facility";
    default:
      return "patient";
  }
}

function displayName(firstName: string | null, lastName: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ");
}

/** Map a public doctor row to a clickable recommendation. */
export function toDoctorRecommendation(row: {
  id: string;
  specialty: string | null;
  name: string;
}): RecommendationItem {
  return {
    id: row.id,
    name: row.name,
    subtitle: row.specialty,
    href: `/doctors/${row.id}`,
  };
}

/** Map a public facility row to a clickable recommendation. Unpublished rows have no slug. */
export function toFacilityRecommendation(
  directory: "hospitals" | "laboratories" | "diagnostic-centres",
  row: {
    id: string;
    slug: string | null;
    laboratoryName: string | null;
    city: string | null;
    state: string | null;
  },
): RecommendationItem | null {
  if (!row.slug || !row.laboratoryName) return null;
  const region = [row.city, row.state].filter(Boolean).join(", ");
  return {
    id: row.id,
    name: row.laboratoryName,
    subtitle: region || null,
    href: `/${directory}/${row.slug}`,
  };
}

/** Map an assigned patient (doctor-facing) to a clickable recommendation. */
export function toPatientRecommendation(row: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  caseNumber: string;
}): RecommendationItem {
  return {
    id: row.id,
    name: displayName(row.firstName, row.lastName),
    subtitle: `Case ${row.caseNumber}`,
    href: `/patients/${row.id}`,
  };
}

/** Map a facility-served patient to a recommendation linking to the relevant portal listing. */
export function toFacilityPatientRecommendation(
  destination: "orders" | "bookings",
  row: {
    patient: { id: string; firstName: string | null; lastName: string | null };
  },
  subtitle: string | null,
): RecommendationItem {
  return {
    id: row.patient.id,
    name: displayName(row.patient.firstName, row.patient.lastName),
    subtitle,
    href: destination === "orders" ? "/lab/orders" : "/lab/bookings",
  };
}

/** Keep at most `limit` items. */
export function capRecommendations<T>(items: T[], limit: number): T[] {
  return items.slice(0, limit);
}
