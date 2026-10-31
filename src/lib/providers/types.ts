import type { AccountType, ProviderType } from "@prisma/client";

/**
 * The kinds of provider that can sell services on Medic1905, mapped from the account type
 * chosen at registration. Doctors are individual practitioners; the other three are
 * facilities that publish a priced service catalogue.
 */
export const PROVIDER_TYPES: Record<ProviderType, { label: string; accountTypes: AccountType[] }> = {
  DOCTOR: { label: "Doctor", accountTypes: ["DOCTOR"] },
  HOSPITAL: { label: "Hospital", accountTypes: ["HOSPITAL"] },
  LABORATORY: { label: "Laboratory", accountTypes: ["LABORATORY"] },
  DIAGNOSTIC_CENTRE: { label: "Diagnostic centre", accountTypes: ["DIAGNOSTIC_CENTRE"] },
  PHARMACY: { label: "Pharmacy", accountTypes: ["PHARMACY"] },
};

export function providerTypeForAccountType(accountType: AccountType | null): ProviderType | null {
  if (!accountType) return null;
  for (const [type, config] of Object.entries(PROVIDER_TYPES) as [ProviderType, (typeof PROVIDER_TYPES)[ProviderType]][]) {
    if (config.accountTypes.includes(accountType)) return type;
  }
  return null;
}

/** Documents and details an admin checks before a provider of each type is verified. */
export interface OnboardingRequirement {
  key: string;
  label: string;
  /** Where the requirement is collected: "signup" (registration form) or "documents" (uploaded files). */
  source: "signup" | "documents";
}

export const ONBOARDING_REQUIREMENTS: Record<ProviderType, OnboardingRequirement[]> = {
  DOCTOR: [
    { key: "fullName", label: "Full name", source: "signup" },
    { key: "email", label: "Email address", source: "signup" },
    { key: "phone", label: "Phone number", source: "signup" },
    { key: "mdcnRegistrationNumber", label: "MDCN registration number", source: "signup" },
    { key: "licenseDocument", label: "Medical licence (upload)", source: "documents" },
    { key: "specialty", label: "Specialty", source: "signup" },
    { key: "consultationFee", label: "Published consultation fee", source: "signup" },
    { key: "settlementDetails", label: "Settlement bank details (for earnings)", source: "documents" },
  ],
  HOSPITAL: [
    { key: "facilityName", label: "Hospital name", source: "signup" },
    { key: "cacRegistrationNumber", label: "CAC registration number", source: "signup" },
    { key: "facilityLicenseNumber", label: "Facility licence number", source: "signup" },
    { key: "operatingHours", label: "Operating hours", source: "signup" },
    { key: "address", label: "Address", source: "signup" },
    { key: "licenseDocument", label: "Facility licence (upload)", source: "documents" },
    { key: "serviceCatalogue", label: "Priced service catalogue", source: "signup" },
    { key: "settlementDetails", label: "Settlement bank details (for earnings)", source: "documents" },
  ],
  LABORATORY: [
    { key: "facilityName", label: "Laboratory name", source: "signup" },
    { key: "cacRegistrationNumber", label: "CAC registration number", source: "signup" },
    { key: "facilityLicenseNumber", label: "Laboratory licence number", source: "signup" },
    { key: "operatingHours", label: "Operating hours", source: "signup" },
    { key: "address", label: "Address", source: "signup" },
    { key: "licenseDocument", label: "Laboratory licence (upload)", source: "documents" },
    { key: "serviceCatalogue", label: "Priced test catalogue", source: "signup" },
    { key: "settlementDetails", label: "Settlement bank details (for earnings)", source: "documents" },
  ],
  DIAGNOSTIC_CENTRE: [
    { key: "facilityName", label: "Diagnostic centre name", source: "signup" },
    { key: "cacRegistrationNumber", label: "CAC registration number", source: "signup" },
    { key: "facilityLicenseNumber", label: "Centre licence number", source: "signup" },
    { key: "operatingHours", label: "Operating hours", source: "signup" },
    { key: "address", label: "Address", source: "signup" },
    { key: "licenseDocument", label: "Centre licence (upload)", source: "documents" },
    { key: "serviceCatalogue", label: "Priced imaging/procedure catalogue", source: "signup" },
    { key: "settlementDetails", label: "Settlement bank details (for earnings)", source: "documents" },
  ],
  PHARMACY: [
    { key: "facilityName", label: "Pharmacy name", source: "signup" },
    { key: "cacRegistrationNumber", label: "CAC registration number", source: "signup" },
    { key: "facilityLicenseNumber", label: "Pharmacy licence number", source: "signup" },
    { key: "operatingHours", label: "Operating hours", source: "signup" },
    { key: "address", label: "Address", source: "signup" },
    { key: "licenseDocument", label: "Pharmacy licence (upload)", source: "documents" },
    { key: "serviceCatalogue", label: "Priced service catalogue", source: "signup" },
    { key: "settlementDetails", label: "Settlement bank details (for earnings)", source: "documents" },
  ],
};

/** A checklist entry an admin sees for a pending provider: the requirement and whether it is met. */
export interface OnboardingChecklistItem extends OnboardingRequirement {
  met: boolean;
}

/** Computed for admin screens: which onboarding requirements a provider has already satisfied. */
export function onboardingChecklist(
  providerType: ProviderType,
  provider: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    mdcnRegistrationNumber?: string | null;
    specialty?: string | null;
    consultationFee?: unknown;
    laboratoryName?: string | null;
    cacRegistrationNumber?: string | null;
    facilityLicenseNumber?: string | null;
    operatingHours?: string | null;
    addressLine?: string | null;
    city?: string | null;
    documentKeys?: string[];
    serviceCount?: number;
  },
): OnboardingChecklistItem[] {
  const met: Record<string, boolean> = {
    fullName: Boolean(provider.name),
    email: Boolean(provider.email),
    phone: Boolean(provider.phone),
    mdcnRegistrationNumber: Boolean(provider.mdcnRegistrationNumber),
    specialty: Boolean(provider.specialty),
    consultationFee: provider.consultationFee !== null && provider.consultationFee !== undefined,
    facilityName: Boolean(provider.laboratoryName || provider.name),
    cacRegistrationNumber: Boolean(provider.cacRegistrationNumber),
    facilityLicenseNumber: Boolean(provider.facilityLicenseNumber),
    operatingHours: Boolean(provider.operatingHours),
    address: Boolean(provider.addressLine || provider.city),
    licenseDocument: (provider.documentKeys?.length ?? 0) > 0,
    serviceCatalogue: (provider.serviceCount ?? 0) > 0,
    settlementDetails: (provider.documentKeys?.length ?? 0) > 0,
  };
  return ONBOARDING_REQUIREMENTS[providerType].map((requirement) => ({ ...requirement, met: met[requirement.key] ?? false }));
}
