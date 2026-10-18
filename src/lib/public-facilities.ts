import type { AccountType } from "@prisma/client";
import { prisma } from "./prisma";
import { notFound } from "./errors";

/** Public URL directory per facility type (the patient-facing accountType). */
export const FACILITY_TYPE_DIRECTORY: Record<
  Exclude<AccountType, "PATIENT" | "DOCTOR">,
  string
> = {
  HOSPITAL: "hospitals",
  LABORATORY: "laboratories",
  DIAGNOSTIC_CENTRE: "diagnostic-centres",
};

export const DIRECTORY_TYPE_LABEL: Record<string, string> = {
  hospitals: "Hospital",
  laboratories: "Laboratory",
  "diagnostic-centres": "Diagnostic centre",
};

/** The directory slug for a facility account type, or null for non-facility types. */
export function directoryForAccountType(
  accountType: AccountType | null,
): string | null {
  return (
    FACILITY_TYPE_DIRECTORY[
      accountType as Exclude<AccountType, "PATIENT" | "DOCTOR">
    ] ?? null
  );
}

/**
 * Normalize a facility name into a URL slug: lowercase, hyphen-separated,
 * ASCII-safe. Returns null when nothing usable remains.
 */
export function slugifyFacility(name: string): string | null {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || null;
}

/** Validate a slug chosen by a facility: URL-safe, not a reserved word. */
const RESERVED_SLUGS = new Set([
  "new",
  "search",
  "all",
  "admin",
  "api",
  "settings",
  "profile",
]);

export function validateFacilitySlug(slug: string): string | null {
  const normalized = slugifyFacility(slug);
  if (!normalized) return null;
  if (RESERVED_SLUGS.has(normalized)) return null;
  if (normalized.length < 3) return null;
  return normalized;
}

/**
 * Public portfolio visibility rules. A facility appears on the public site only
 * when ALL hold: publication explicitly switched on (a slug alone never
 * publishes), verification VERIFIED, an active owner, and a matching account
 * type for the directory the page lives under.
 */
export const PUBLIC_FACILITY_WHERE = {
  isPublished: true,
  verificationStatus: "VERIFIED" as const,
  user: { status: "ACTIVE" as const, deletedAt: null },
};

/** Strict field selection for public responses — never email, phone of owner, or private fields. */
export const PUBLIC_FACILITY_SELECT = {
  id: true,
  slug: true,
  laboratoryName: true,
  tagline: true,
  about: true,
  mission: true,
  vision: true,
  addressLine: true,
  city: true,
  state: true,
  operatingHours: true,
  ownershipType: true,
  establishedYear: true,
  bedCount: true,
  theatreCount: true,
  laboratoryCount: true,
  imagingRoomCount: true,
  languagesSpoken: true,
  paymentMethods: true,
  emergencyContact: true,
  phone: true,
  email: true,
  logoUrl: true,
  galleryImageKeys: true,
  user: { select: { accountType: true } },
} as const;

export async function listPublicFacilities(input: {
  directory: string;
  q?: string;
  city?: string;
  limit?: number;
}) {
  const where = {
    ...PUBLIC_FACILITY_WHERE,
    user: {
      ...PUBLIC_FACILITY_WHERE.user,
      accountType: directoryAccountType(input.directory),
    },
    ...(input.q
      ? {
          OR: [
            {
              laboratoryName: {
                contains: input.q,
                mode: "insensitive" as const,
              },
            },
            { city: { contains: input.q, mode: "insensitive" as const } },
            { state: { contains: input.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(input.city
      ? { city: { contains: input.city, mode: "insensitive" as const } }
      : {}),
  };
  return prisma.labStaffProfile.findMany({
    where,
    select: PUBLIC_FACILITY_SELECT,
    orderBy: [{ laboratoryName: "asc" }],
    take: input.limit ?? 50,
  });
}

export async function getPublicFacilityBySlug(directory: string, slug: string) {
  const facility = await prisma.labStaffProfile.findFirst({
    where: {
      ...PUBLIC_FACILITY_WHERE,
      slug,
      user: {
        ...PUBLIC_FACILITY_WHERE.user,
        accountType: directoryAccountType(directory),
      },
    },
    select: {
      ...PUBLIC_FACILITY_SELECT,
      branches: {
        where: {},
        select: {
          id: true,
          name: true,
          addressLine: true,
          city: true,
          state: true,
          phone: true,
          openingHours: true,
          isPrimary: true,
        },
      },
      facilityDepartments: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          openingHours: true,
          equipment: true,
          leadStaff: {
            select: { fullName: true, professionalTitle: true },
          },
        },
      },
      accreditations: {
        select: {
          id: true,
          name: true,
          issuer: true,
          issuedAt: true,
          expiresAt: true,
          verified: true,
        },
      },
    },
  });
  if (!facility) throw notFound("Facility not found");
  return facility;
}

/** Directory path segments that map to a facility account type. */
function directoryAccountType(directory: string): AccountType | null {
  switch (directory) {
    case "hospitals":
      return "HOSPITAL";
    case "laboratories":
      return "LABORATORY";
    case "diagnostic-centres":
      return "DIAGNOSTIC_CENTRE";
    default:
      return null;
  }
}

/**
 * Team members published on the portfolio. Requires BOTH the facility's
 * visibility switch AND the staff member's own affirmative consent, plus an
 * active status and linked active account. Selection excludes contact details,
 * invite tokens and any private field.
 */
export async function listPublicFacilityStaff(facilityId: string) {
  return prisma.facilityStaff.findMany({
    where: {
      facilityId,
      status: "ACTIVE",
      publicProfileVisible: true,
      profileConsent: true,
      user: { status: "ACTIVE", deletedAt: null },
    },
    select: {
      id: true,
      fullName: true,
      professionalTitle: true,
      department: { select: { name: true } },
      specialty: true,
      qualifications: true,
      yearsExperience: true,
      photoUrl: true,
      bio: true,
      languages: true,
      bookingEligible: true,
      linkedinUrl: true,
      linkedinPublic: true,
    },
    orderBy: [{ fullName: "asc" }],
  });
}

/** Strip the LinkedIn URL unless the staff member opted in to showing it. */
export function publicStaffProfile<
  T extends { linkedinUrl: string | null; linkedinPublic: boolean },
>(
  staff: T,
): Omit<T, "linkedinUrl" | "linkedinPublic"> & { linkedinUrl: string | null } {
  const { linkedinUrl, linkedinPublic, ...rest } = staff;
  return { ...rest, linkedinUrl: linkedinPublic ? linkedinUrl : null };
}

/** Published services for the portfolio: active services only. */
export async function listPublicFacilityServices(facilityId: string) {
  return prisma.facilityService.findMany({
    where: { facilityId, isActive: true },
    select: {
      id: true,
      name: true,
      description: true,
      category: true,
      price: true,
      currency: true,
      turnaroundHours: true,
      availability: true,
      preparationInstructions: true,
      referralRequired: true,
      homeCollectionAvailable: true,
      urgentAvailable: true,
      branch: { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/**
 * JSON-LD structured data for a facility portfolio (MedicalClinic). Only
 * fields safe for the public web are included — never patient data or
 * unverified claims.
 */
export function facilityJsonLd(facility: {
  laboratoryName: string | null;
  tagline: string | null;
  addressLine: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  operatingHours: string | null;
  logoUrl: string | null;
}): Record<string, unknown> {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    name: facility.laboratoryName ?? undefined,
    description: facility.tagline ?? undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: facility.addressLine ?? undefined,
      addressLocality: facility.city ?? undefined,
      addressRegion: facility.state ?? undefined,
    },
    ...(facility.phone ? { telephone: facility.phone } : {}),
    ...(facility.email ? { email: facility.email } : {}),
    ...(facility.logoUrl ? { logo: absoluteUrl(facility.logoUrl) } : {}),
    ...(facility.operatingHours
      ? { openingHours: facility.operatingHours }
      : {}),
  };
  return data;
}

/** Structured data wants absolute URLs; app-relative paths get the public site origin prefixed. */
function absoluteUrl(url: string): string {
  if (!url.startsWith("/")) return url;
  const base = process.env.NEXT_PUBLIC_APP_URL;
  return base ? `${base.replace(/\/$/, "")}${url}` : url;
}
