import type {
  FacilityStaffRole,
  StaffCredential,
} from "@prisma/client";

export type { FacilityStaffRole };

/**
 * Facility-level permissions.
 *
 * A staff member's effective permissions come from their facility role and any
 * explicitly granted permission overrides. Global platform roles never grant
 * facility permissions.
 */
export const FACILITY_PERMISSIONS = [
  // Facility administration
  "MANAGE_PROFILE",
  "MANAGE_STAFF",
  "MANAGE_SERVICES",
  "MANAGE_BOOKINGS",
  "MANAGE_CREDENTIALS",
  "MANAGE_HOSPITAL_SETTINGS",
  "VIEW_AUDIT",
  "VIEW_ANALYTICS",

  // Front office and revenue
  "REGISTER_PATIENTS",
  "TAKE_PAYMENTS",
  "VIEW_REVENUE",
  "MANAGE_PAYOUTS",
  "MANAGE_INSURANCE",
  "MANAGE_REFERRALS",

  // Laboratory and diagnostics
  "PROCESS_ORDERS",
  "ENTER_RESULTS",
  "VERIFY_RESULTS",
  "RELEASE_RESULTS",
  "UPLOAD_MEDIA",

  // Clinical records
  "VIEW_PATIENT_DOCUMENTS",
  "MANAGE_DOCUMENT_TEMPLATES",
  "AUTHOR_DOCUMENTS",
  "REVIEW_DOCUMENTS",
  "SIGN_DOCUMENTS",
  "APPROVE_DOCUMENTS",
  "RELEASE_DOCUMENTS",
  "MANAGE_ENCOUNTERS",
  "RECORD_NURSING",

  // Medications
  "ORDER_MEDICATIONS",
  "REVIEW_MEDICATIONS",
  "ADMINISTER_MEDICATIONS",
  "MANAGE_FORMULARY",
] as const;

export type FacilityPermission = (typeof FACILITY_PERMISSIONS)[number];

export const FACILITY_PERMISSION_LABEL: Record<FacilityPermission, string> = {
  MANAGE_PROFILE: "Manage facility profile",
  MANAGE_STAFF: "Manage staff",
  MANAGE_SERVICES: "Manage services and prices",
  MANAGE_BOOKINGS: "Manage bookings",
  MANAGE_CREDENTIALS: "Manage staff credentials",
  MANAGE_HOSPITAL_SETTINGS: "Manage hospital settings",
  VIEW_AUDIT: "View audit logs",
  VIEW_ANALYTICS: "View operational analytics",
  REGISTER_PATIENTS: "Register and look up patients",
  TAKE_PAYMENTS: "Take and record payments",
  VIEW_REVENUE: "View revenue and earnings reports",
  MANAGE_PAYOUTS: "Manage settlement configuration",
  MANAGE_INSURANCE: "Manage insurance and claims",
  MANAGE_REFERRALS: "Manage referrals",
  PROCESS_ORDERS: "Process diagnostic orders",
  ENTER_RESULTS: "Enter diagnostic results",
  VERIFY_RESULTS: "Verify and approve results",
  RELEASE_RESULTS: "Release results to patients",
  UPLOAD_MEDIA: "Upload patient media",
  VIEW_PATIENT_DOCUMENTS: "View patient documents",
  MANAGE_DOCUMENT_TEMPLATES: "Manage document templates",
  AUTHOR_DOCUMENTS: "Author clinical documents",
  REVIEW_DOCUMENTS: "Review clinical documents",
  SIGN_DOCUMENTS: "Sign clinical documents",
  APPROVE_DOCUMENTS: "Approve clinical documents",
  RELEASE_DOCUMENTS: "Release documents to patients",
  MANAGE_ENCOUNTERS: "Manage encounters and workflow",
  RECORD_NURSING: "Record nursing care",
  ORDER_MEDICATIONS: "Order medications",
  REVIEW_MEDICATIONS: "Review and dispense medications",
  ADMINISTER_MEDICATIONS: "Administer medications",
  MANAGE_FORMULARY: "Manage formulary",
};

/** Coarse permission groups for UI navigation and bulk grants. */
export const FACILITY_PERMISSION_GROUPS = {
  ADMINISTRATION: [
    "MANAGE_PROFILE",
    "MANAGE_STAFF",
    "MANAGE_SERVICES",
    "MANAGE_CREDENTIALS",
    "MANAGE_HOSPITAL_SETTINGS",
    "VIEW_AUDIT",
    "VIEW_ANALYTICS",
  ],
  PATIENT_ACCESS: [
    "REGISTER_PATIENTS",
    "VIEW_PATIENT_DOCUMENTS",
    "MANAGE_ENCOUNTERS",
    "MANAGE_REFERRALS",
  ],
  CLINICAL_DOCUMENTS: [
    "MANAGE_DOCUMENT_TEMPLATES",
    "AUTHOR_DOCUMENTS",
    "REVIEW_DOCUMENTS",
    "SIGN_DOCUMENTS",
    "APPROVE_DOCUMENTS",
    "RELEASE_DOCUMENTS",
  ],
  DIAGNOSTICS: [
    "PROCESS_ORDERS",
    "ENTER_RESULTS",
    "VERIFY_RESULTS",
    "RELEASE_RESULTS",
    "UPLOAD_MEDIA",
  ],
  MEDICATIONS: [
    "ORDER_MEDICATIONS",
    "REVIEW_MEDICATIONS",
    "ADMINISTER_MEDICATIONS",
    "MANAGE_FORMULARY",
  ],
  FINANCE: [
    "TAKE_PAYMENTS",
    "VIEW_REVENUE",
    "MANAGE_PAYOUTS",
    "MANAGE_INSURANCE",
  ],
} as const satisfies Record<string, readonly FacilityPermission[]>;

export type FacilityPermissionGroup = keyof typeof FACILITY_PERMISSION_GROUPS;

/**
 * Roles can inherit permissions from a base role. This keeps clinical roles
 * consistent while allowing a role to add narrowly scoped extras.
 */
const ROLE_INHERITANCE: Partial<
  Record<FacilityStaffRole, FacilityStaffRole>
> = {
  RADIOLOGIST: "LAB_SCIENTIST",
  DIAGNOSTIC_SPECIALIST: "LAB_SCIENTIST",
  SURGEON: "DOCTOR",
};

const ROLE_PERMISSIONS: Record<
  FacilityStaffRole,
  readonly FacilityPermission[]
> = {
  OWNER: FACILITY_PERMISSIONS,

  FACILITY_MANAGER: [
    "MANAGE_PROFILE",
    "MANAGE_STAFF",
    "MANAGE_SERVICES",
    "MANAGE_BOOKINGS",
    "PROCESS_ORDERS",
    "REGISTER_PATIENTS",
    "VIEW_REVENUE",
    "MANAGE_CREDENTIALS",
    "MANAGE_REFERRALS",
    "VIEW_PATIENT_DOCUMENTS",
    "MANAGE_DOCUMENT_TEMPLATES",
    "MANAGE_HOSPITAL_SETTINGS",
    "MANAGE_ENCOUNTERS",
    "MANAGE_INSURANCE",
    "VIEW_ANALYTICS",
  ],

  DOCTOR: [
    "MANAGE_BOOKINGS",
    "REGISTER_PATIENTS",
    "MANAGE_REFERRALS",
    "VIEW_PATIENT_DOCUMENTS",
    "AUTHOR_DOCUMENTS",
    "REVIEW_DOCUMENTS",
    "SIGN_DOCUMENTS",
    "RELEASE_DOCUMENTS",
    "MANAGE_ENCOUNTERS",
    "UPLOAD_MEDIA",
    "ORDER_MEDICATIONS",
  ],

  LAB_SCIENTIST: [
    "PROCESS_ORDERS",
    "ENTER_RESULTS",
    "VERIFY_RESULTS",
    "RELEASE_RESULTS",
    "VIEW_PATIENT_DOCUMENTS",
    "AUTHOR_DOCUMENTS",
    "REVIEW_DOCUMENTS",
    "SIGN_DOCUMENTS",
    "RELEASE_DOCUMENTS",
    "UPLOAD_MEDIA",
  ],

  LAB_TECHNICIAN: [
    "PROCESS_ORDERS",
    "ENTER_RESULTS",
    "AUTHOR_DOCUMENTS",
    "UPLOAD_MEDIA",
  ],

  LAB_ASSISTANT: ["PROCESS_ORDERS"],
  PHLEBOTOMIST: ["PROCESS_ORDERS"],

  NURSE: [
    "PROCESS_ORDERS",
    "REGISTER_PATIENTS",
    "VIEW_PATIENT_DOCUMENTS",
    "AUTHOR_DOCUMENTS",
    "SIGN_DOCUMENTS",
    "MANAGE_ENCOUNTERS",
    "RECORD_NURSING",
    "ADMINISTER_MEDICATIONS",
  ],

  RADIOGRAPHER: [
    "PROCESS_ORDERS",
    "ENTER_RESULTS",
    "AUTHOR_DOCUMENTS",
    "UPLOAD_MEDIA",
  ],

  RECEPTIONIST: [
    "MANAGE_BOOKINGS",
    "REGISTER_PATIENTS",
    "TAKE_PAYMENTS",
    "MANAGE_ENCOUNTERS",
  ],

  ACCOUNTANT: [
    "TAKE_PAYMENTS",
    "VIEW_REVENUE",
    "MANAGE_INSURANCE",
    "VIEW_ANALYTICS",
  ],

  COMPLIANCE_OFFICER: [
    "VIEW_AUDIT",
    "MANAGE_CREDENTIALS",
    "VIEW_PATIENT_DOCUMENTS",
    "VIEW_ANALYTICS",
  ],

  RADIOLOGIST: [],
  DIAGNOSTIC_SPECIALIST: [],
  PHARMACIST: [
    "VIEW_PATIENT_DOCUMENTS",
    "AUTHOR_DOCUMENTS",
    "SIGN_DOCUMENTS",
    "REVIEW_MEDICATIONS",
    "MANAGE_FORMULARY",
  ],

  SURGEON: [],
  DEPARTMENT_HEAD: [
    "MANAGE_BOOKINGS",
    "VIEW_ANALYTICS",
    "APPROVE_DOCUMENTS",
  ],

  MEDICAL_RECORDS_OFFICER: [
    "REGISTER_PATIENTS",
    "VIEW_PATIENT_DOCUMENTS",
    "RELEASE_DOCUMENTS",
    "UPLOAD_MEDIA",
    "MANAGE_ENCOUNTERS",
  ],

  BILLING_OFFICER: [
    "TAKE_PAYMENTS",
    "VIEW_REVENUE",
    "MANAGE_INSURANCE",
  ],

  INSURANCE_OFFICER: [
    "REGISTER_PATIENTS",
    "MANAGE_INSURANCE",
  ],
};

export interface FacilityRoleContext {
  role: FacilityStaffRole;
  /** Explicit additions granted to this staff member. */
  grantedPermissions?: readonly FacilityPermission[] | null;
  /** Explicit removals applied after role permissions. */
  revokedPermissions?: readonly FacilityPermission[] | null;
  /** Optional department scope; use for department-specific access rules. */
  departmentId?: string | null;
}

export interface PermissionDecision {
  allowed: boolean;
  reason:
    | "ALLOWED"
    | "NO_PERMISSION"
    | "ROLE_NOT_RECOGNISED"
    | "DEPARTMENT_REQUIRED";
}

/** Resolve inherited role permissions, then apply explicit overrides. */
export function effectivePermissions(
  context: FacilityRoleContext,
): ReadonlySet<FacilityPermission> {
  const permissions = new Set<FacilityPermission>();

  let currentRole: FacilityStaffRole | undefined = context.role;
  const visited = new Set<FacilityStaffRole>();

  while (currentRole && !visited.has(currentRole)) {
    visited.add(currentRole);

    for (const permission of ROLE_PERMISSIONS[currentRole] ?? []) {
      permissions.add(permission);
    }

    currentRole = ROLE_INHERITANCE[currentRole];
  }

  for (const permission of context.grantedPermissions ?? []) {
    permissions.add(permission);
  }

  for (const permission of context.revokedPermissions ?? []) {
    permissions.delete(permission);
  }

  return permissions;
}

export function permissionsForRole(
  role: FacilityStaffRole,
): readonly FacilityPermission[] {
  const permissions = effectivePermissions({ role });
  return [...permissions];
}

export function roleHasPermission(
  role: FacilityStaffRole,
  permission: FacilityPermission,
): boolean {
  return effectivePermissions({ role }).has(permission);
}

/**
 * Central permission check for dashboard and API actions.
 *
 * Department-scoped permissions can require a department context. Add
 * permissions to `DEPARTMENT_SCOPED_PERMISSIONS` as your product introduces
 * department-level controls.
 */
const DEPARTMENT_SCOPED_PERMISSIONS = new Set<FacilityPermission>([
  "APPROVE_DOCUMENTS",
  "MANAGE_ENCOUNTERS",
]);

export function hasFacilityPermission(
  context: FacilityRoleContext,
  permission: FacilityPermission,
): PermissionDecision {
  if (!ROLE_PERMISSIONS[context.role]) {
    return { allowed: false, reason: "ROLE_NOT_RECOGNISED" };
  }

  if (
    DEPARTMENT_SCOPED_PERMISSIONS.has(permission) &&
    !context.departmentId
  ) {
    return { allowed: false, reason: "DEPARTMENT_REQUIRED" };
  }

  const allowed = effectivePermissions(context).has(permission);

  return {
    allowed,
    reason: allowed ? "ALLOWED" : "NO_PERMISSION",
  };
}

export function hasAnyFacilityPermission(
  context: FacilityRoleContext,
  permissions: readonly FacilityPermission[],
): boolean {
  return permissions.some((permission) =>
    hasFacilityPermission(context, permission).allowed,
  );
}

export function hasAllFacilityPermissions(
  context: FacilityRoleContext,
  permissions: readonly FacilityPermission[],
): boolean {
  return permissions.every((permission) =>
    hasFacilityPermission(context, permission).allowed,
  );
}

export const FACILITY_ROLE_LABEL: Record<FacilityStaffRole, string> = {
  OWNER: "Owner / Administrator",
  FACILITY_MANAGER: "Facility manager",
  DOCTOR: "Doctor",
  LAB_SCIENTIST: "Laboratory scientist",
  LAB_TECHNICIAN: "Laboratory technician",
  LAB_ASSISTANT: "Laboratory assistant",
  PHLEBOTOMIST: "Phlebotomist",
  NURSE: "Nurse",
  RADIOGRAPHER: "Radiographer / Sonographer",
  RECEPTIONIST: "Receptionist",
  ACCOUNTANT: "Accountant",
  COMPLIANCE_OFFICER: "Auditor / Compliance officer",
  RADIOLOGIST: "Radiologist",
  DIAGNOSTIC_SPECIALIST: "Diagnostic specialist",
  PHARMACIST: "Pharmacist",
  SURGEON: "Surgeon",
  DEPARTMENT_HEAD: "Head of department",
  MEDICAL_RECORDS_OFFICER: "Medical records officer",
  BILLING_OFFICER: "Billing officer",
  INSURANCE_OFFICER: "Insurance officer",
};

export const FACILITY_STAFF_STATUS_LABEL: Record<string, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
};

/** Roles a facility manager may assign. OWNER is platform-managed only. */
export const ASSIGNABLE_ROLES: readonly FacilityStaffRole[] = Object.keys(
  FACILITY_ROLE_LABEL,
).filter(
  (role) => role !== "OWNER",
) as FacilityStaffRole[];

/** Roles that may grant or revoke staff permissions. */
export const PERMISSION_ADMIN_ROLES: readonly FacilityStaffRole[] = [
  "OWNER",
  "FACILITY_MANAGER",
];

/** Single-use, URL-safe invite token. */
export function generateInviteToken(bytes = 32): string {
  const randomBytes = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export const INVITE_EXPIRY_DAYS = 7;

export const CREDENTIAL_REMINDER_STAGES = [90, 60, 30, 7] as const;

export type CredentialExpiryState =
  | "VALID"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "UNKNOWN";

export interface CredentialLike {
  expiryDate: Date | string | null;
}

const MS_PER_DAY = 86_400_000;

/** Whole days until the date; negative if the date is in the past. */
export function daysUntil(date: Date | string, now = new Date()): number {
  const target = typeof date === "string" ? new Date(date) : date;

  if (Number.isNaN(target.getTime())) return 0;

  return Math.floor(
    (target.getTime() - now.getTime()) / MS_PER_DAY,
  );
}

/**
 * Expiry state for a credential.
 *
 * `UNKNOWN` means no expiry date is recorded; some certifications do not
 * expire. It must never be rendered as "valid".
 */
export function credentialExpiryState(
  credential: CredentialLike,
  now = new Date(),
): CredentialExpiryState {
  if (!credential.expiryDate) return "UNKNOWN";

  const expiry =
    typeof credential.expiryDate === "string"
      ? new Date(credential.expiryDate)
      : credential.expiryDate;

  if (Number.isNaN(expiry.getTime())) return "UNKNOWN";

  const remainingDays = daysUntil(expiry, now);

  if (remainingDays < 0) return "EXPIRED";
  if (remainingDays <= 30) return "EXPIRING_SOON";

  return "VALID";
}

/**
 * The highest reminder stage that should have been sent for a credential.
 *
 * Returns `null` when no reminder is due: the credential has no expiry date,
 * is still far from expiry, or has already expired and is handled by the
 * expired-credential dispatcher.
 */
export function dueReminderStage(
  credential: Pick<
    StaffCredential,
    "expiryDate" | "lastReminderStage"
  >,
  now = new Date(),
): number | null {
  if (!credential.expiryDate) return null;

  const remainingDays = daysUntil(credential.expiryDate, now);
  if (remainingDays < 0) return null;

  let dueStage: number | null = null;

  for (const stage of CREDENTIAL_REMINDER_STAGES) {
    if (remainingDays <= stage) {
      dueStage = stage;
    }
  }

  if (
    dueStage !== null &&
    credential.lastReminderStage !== null &&
    credential.lastReminderStage >= dueStage
  ) {
    return null;
  }

  return dueStage;
}

/** Validate a permission override before persisting it. */
export function validatePermissionOverrides(
  grantedPermissions: unknown,
  revokedPermissions: unknown,
): {
  ok: boolean;
  granted: FacilityPermission[];
  revoked: FacilityPermission[];
  error?: string;
} {
  const isValidList = (value: unknown): value is readonly unknown[] =>
    Array.isArray(value) &&
    value.every(
      (permission) =>
        typeof permission === "string" &&
        (FACILITY_PERMISSIONS as readonly string[]).includes(permission),
    );

  if (grantedPermissions !== undefined && !isValidList(grantedPermissions)) {
    return {
      ok: false,
      granted: [],
      revoked: [],
      error: "Granted permissions contain an unknown permission",
    };
  }

  if (revokedPermissions !== undefined && !isValidList(revokedPermissions)) {
    return {
      ok: false,
      granted: [],
      revoked: [],
      error: "Revoked permissions contain an unknown permission",
    };
  }

  const granted = [...new Set(grantedPermissions ?? [])] as FacilityPermission[];
  const revoked = [...new Set(revokedPermissions ?? [])] as FacilityPermission[];

  const conflicts = granted.filter((permission) =>
    revoked.includes(permission),
  );

  if (conflicts.length > 0) {
    return {
      ok: false,
      granted: [],
      revoked: [],
      error: `Permission cannot be both granted and revoked: ${conflicts.join(", ")}`,
    };
  }

  return { ok: true, granted, revoked };
}
