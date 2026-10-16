import type { Role, UserStatus } from "@prisma/client";

/** Facility remains LAB_SCIENTIST in persistence for backwards compatibility. */
export const ROLE_POLICY = {
  PATIENT: { label: "Patient", dashboard: "/dashboard" },
  DOCTOR: { label: "Doctor", dashboard: "/doctor/dashboard" },
  LAB_SCIENTIST: { label: "Facility", dashboard: "/lab/dashboard" },
  ADMIN: { label: "Admin", dashboard: "/admin/dashboard" },
} as const satisfies Record<Role, { label: string; dashboard: string }>;

export type AccountAccess = Pick<{
  role: Role;
  status: UserStatus;
  onboardingComplete: boolean;
  deletedAt: Date | null;
}, "role" | "status" | "onboardingComplete" | "deletedAt">;

export function isAccountBlocked(user: Pick<AccountAccess, "status" | "deletedAt">): boolean {
  return Boolean(user.deletedAt) || user.status === "SUSPENDED" || user.status === "BANNED";
}

export function isAccountReady(user: AccountAccess): boolean {
  return !isAccountBlocked(user) && user.status === "ACTIVE" && user.onboardingComplete;
}

/** Null means the page may proceed. Blocked accounts must never enter onboarding. */
export function pageAccessRedirect(user: AccountAccess | null, roles: readonly Role[]): string | null {
  if (!user) return "/auth/login";
  if (isAccountBlocked(user)) return "/";
  if (!isAccountReady(user)) return "/auth/callback";
  return roles.includes(user.role) ? null : ROLE_POLICY[user.role].dashboard;
}
