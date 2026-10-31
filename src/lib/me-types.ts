/**
 * The signed-in user's identity as the UI needs it (navigation, labels).
 * Shared by the server loader (lib/me.ts) and the client provider
 * (lib/use-me.tsx). Never a security boundary: every route enforces access.
 */
export interface MeFacility {
  id: string;
  name: string | null;
  kind: "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE" | "PHARMACY";
  facilityRole: string;
  permissions: readonly string[];
}

export interface Me {
  id: string;
  name: string;
  email: string;
  role: "PATIENT" | "DOCTOR" | "LAB_SCIENTIST" | "ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "BANNED";
  accountType: string | null;
  avatarUrl: string | null;
  facility: MeFacility | null;
  onboardingComplete: boolean;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | null;
}

/** The full /api/me payload: the navigation identity plus profile fields. */
export interface MeResponse extends Me {
  patientId: string | null;
  phone: string | null;
  language: string;
}
