/**
 * Super Admin Control Centre — permission catalog and pure resolution logic.
 *
 * Permissions are "SECTION:VERB" keys. The catalog is the single source of
 * truth shared by the API enforcement (lib/superadmin/access.ts), the
 * navigation filter and the Role Builder UI. Nothing here grants clinical
 * privileges: patient records, prescriptions, results and clinical documents
 * remain governed by the facility staff / StaffPatientAccess /
 * ClinicalPrivilege models and platform policies.
 */

export const ADMIN_SECTIONS = [
  "OVERVIEW", "USERS", "TEAM", "ROLES", "APPROVALS", "FACILITIES", "DEPARTMENTS",
  "GOVERNANCE", "DOCUMENTS", "PATIENT_ACCOUNTS", "DOCTORS", "NURSING", "LABORATORY",
  "RADIOLOGY", "PHARMACY", "MODULES", "SUBSCRIPTIONS", "AI", "INTEGRATIONS",
  "ANALYTICS", "SECURITY", "AUDIT", "DATA_GOVERNANCE", "NOTIFICATIONS", "SYSTEM_HEALTH", "SETTINGS",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Independently configurable operations per module (spec §4.1). */
export const ADMIN_VERBS = [
  "VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "REJECT", "SIGN", "RELEASE",
  "DOWNLOAD", "PRINT", "EXPORT", "ASSIGN", "CONFIGURE", "MANAGE", "AUDIT",
] as const;
export type AdminVerb = (typeof ADMIN_VERBS)[number];

/** Which verbs are meaningful for each section (VIEW is always required). */
export const SECTION_VERBS: Record<AdminSection, readonly AdminVerb[]> = {
  OVERVIEW: ["VIEW", "EXPORT"],
  USERS: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "AUDIT"],
  TEAM: ["VIEW", "CREATE", "EDIT", "DELETE", "ASSIGN", "MANAGE", "AUDIT"],
  ROLES: ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE", "MANAGE", "AUDIT"],
  APPROVALS: ["VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "MANAGE"],
  FACILITIES: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "REJECT", "EXPORT", "AUDIT"],
  DEPARTMENTS: ["VIEW", "CREATE", "EDIT", "DELETE", "CONFIGURE", "MANAGE"],
  GOVERNANCE: ["VIEW", "CONFIGURE", "APPROVE", "AUDIT"],
  DOCUMENTS: ["VIEW", "CREATE", "EDIT", "DELETE", "APPROVE", "SIGN", "RELEASE", "DOWNLOAD", "PRINT", "EXPORT", "CONFIGURE"],
  PATIENT_ACCOUNTS: ["VIEW", "EDIT", "EXPORT", "AUDIT"],
  DOCTORS: ["VIEW", "EDIT", "APPROVE", "REJECT", "EXPORT", "AUDIT"],
  NURSING: ["VIEW", "EXPORT"],
  LABORATORY: ["VIEW", "EXPORT"],
  RADIOLOGY: ["VIEW", "EXPORT"],
  PHARMACY: ["VIEW", "EXPORT"],
  MODULES: ["VIEW", "CONFIGURE", "MANAGE"],
  SUBSCRIPTIONS: ["VIEW", "CREATE", "EDIT", "DELETE", "EXPORT", "MANAGE"],
  AI: ["VIEW", "CONFIGURE", "MANAGE"],
  INTEGRATIONS: ["VIEW", "CONFIGURE", "MANAGE"],
  ANALYTICS: ["VIEW", "EXPORT"],
  SECURITY: ["VIEW", "CREATE", "EDIT", "MANAGE", "AUDIT"],
  AUDIT: ["VIEW", "EXPORT"],
  DATA_GOVERNANCE: ["VIEW", "CONFIGURE", "EXPORT", "MANAGE"],
  NOTIFICATIONS: ["VIEW", "CREATE", "EDIT", "MANAGE"],
  SYSTEM_HEALTH: ["VIEW", "MANAGE"],
  SETTINGS: ["VIEW", "CONFIGURE"],
};

export function permissionKey(section: AdminSection, verb: AdminVerb) {
  return `${section}:${verb}` as const;
}
export function isValidPermissionKey(key: string): key is `${AdminSection}:${AdminVerb}` {
  const [s, v] = key.split(":");
  return (ADMIN_SECTIONS as readonly string[]).includes(s) && (ADMIN_VERBS as readonly string[]).includes(v);
}
export function allPermissionKeys(): string[] {
  return ADMIN_SECTIONS.flatMap((s) => SECTION_VERBS[s].map((v) => permissionKey(s, v)));
}

export interface ResolvedRoleGrant {
  roleKeys: string[];
  permissionKeys: string[];
}
export interface ResolvedOverride {
  permissionKey: string;
  effect: "GRANT" | "DENY";
  expiresAt: Date | null;
}

/**
 * Pure permission resolver used by the API enforcement and by the tests.
 * DENY overrides always win over GRANT overrides and role permissions.
 * An unexpired membership/assignment contributes; expired or revoked ones do not.
 */
export function resolvePermissions(input: {
  superAdmin: boolean;
  grants: ResolvedRoleGrant[];
  overrides: ResolvedOverride[];
  now?: Date;
}): Set<string> {
  if (input.superAdmin) return new Set(allPermissionKeys());
  const now = input.now ?? new Date();
  const allowed = new Set<string>();
  for (const grant of input.grants) {
    for (const key of grant.permissionKeys) {
      if (isValidPermissionKey(key)) allowed.add(key);
    }
  }
  for (const o of input.overrides) {
    if (!isValidPermissionKey(o.permissionKey)) continue;
    if (o.expiresAt && o.expiresAt <= now) continue;
    if (o.effect === "DENY") allowed.delete(o.permissionKey);
    else allowed.add(o.permissionKey);
  }
  return allowed;
}

export function can(permissions: ReadonlySet<string>, section: AdminSection, verb: AdminVerb) {
  return permissions.has(permissionKey(section, verb));
}
export function visibleSections(permissions: ReadonlySet<string>): AdminSection[] {
  return ADMIN_SECTIONS.filter((s) => can(permissions, s, "VIEW"));
}

// ---------------------------------------------------------------------------
// Recommended default organisation (spec §2.1, §3, §18). The Super Admin can
// rename, combine or remove all of these — they are seed data, not code.
// ---------------------------------------------------------------------------

export const DEFAULT_DEPARTMENTS: { key: string; name: string; description: string; rank: number }[] = [
  { key: "EXECUTIVE", name: "Executive Leadership", description: "Platform owner, deputy, chief officers and master governance.", rank: 0 },
  { key: "PLATFORM_ADMIN", name: "Platform Administration", description: "Platform configuration and operations.", rank: 10 },
  { key: "TECH_SUPPORT", name: "Technical Support", description: "Technical support and troubleshooting.", rank: 20 },
  { key: "USER_FACILITY", name: "User & Facility Management", description: "Accounts, verification and facility registration.", rank: 30 },
  { key: "CLINICAL_GOVERNANCE", name: "Clinical Governance", description: "Clinical standards, informatics and governance.", rank: 40 },
  { key: "FINANCE", name: "Finance & Subscriptions", description: "Billing, subscriptions and payments.", rank: 50 },
  { key: "SECURITY_COMPLIANCE", name: "Security & Compliance", description: "Security policies, privacy and compliance reviews.", rank: 60 },
  { key: "DATA_ANALYTICS", name: "Data & Analytics", description: "Reports, usage statistics and analytics.", rank: 70 },
  { key: "TRAINING", name: "Training & Onboarding", description: "User onboarding and training.", rank: 80 },
  { key: "QA", name: "Quality Assurance", description: "Testing, quality and issue tracking.", rank: 90 },
  { key: "INTEGRATIONS", name: "Integrations & API Management", description: "API and external system integrations.", rank: 100 },
];

const p = (s: AdminSection, ...verbs: AdminVerb[]) => verbs.map((v) => permissionKey(s, v));

export interface RoleSeed {
  key: string;
  name: string;
  description: string;
  departmentKey: string;
  permissions: string[];
}

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    key: "SUPER_ADMIN", name: "Super Admin", departmentKey: "EXECUTIVE",
    description: "Global platform governance and master settings. Requires an explicit Super Administrator grant; the role alone is directory metadata.",
    permissions: allPermissionKeys(),
  },
  {
    key: "DEPUTY_SUPER_ADMIN", name: "Deputy Super Admin", departmentKey: "EXECUTIVE",
    description: "Delegated platform administration across teams, facilities and operations.",
    permissions: [
      ...p("OVERVIEW", "VIEW", "EXPORT"), ...p("USERS", "VIEW", "CREATE", "EDIT", "EXPORT", "AUDIT"),
      ...p("TEAM", "VIEW", "CREATE", "EDIT", "ASSIGN", "MANAGE", "AUDIT"), ...p("ROLES", "VIEW", "CREATE", "EDIT", "CONFIGURE", "MANAGE", "AUDIT"),
      ...p("APPROVALS", "VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "MANAGE"), ...p("FACILITIES", "VIEW", "CREATE", "EDIT", "APPROVE", "REJECT", "EXPORT", "AUDIT"),
      ...p("DEPARTMENTS", "VIEW", "CREATE", "EDIT", "CONFIGURE", "MANAGE"), ...p("GOVERNANCE", "VIEW", "CONFIGURE", "APPROVE", "AUDIT"),
      ...p("DOCUMENTS", "VIEW", "CREATE", "EDIT", "APPROVE", "CONFIGURE", "EXPORT"), ...p("PATIENT_ACCOUNTS", "VIEW", "EDIT", "AUDIT"),
      ...p("DOCTORS", "VIEW", "EDIT", "APPROVE", "REJECT", "EXPORT", "AUDIT"), ...p("NURSING", "VIEW"), ...p("LABORATORY", "VIEW"),
      ...p("RADIOLOGY", "VIEW"), ...p("PHARMACY", "VIEW"), ...p("MODULES", "VIEW", "CONFIGURE"), ...p("SUBSCRIPTIONS", "VIEW", "CREATE", "EDIT", "EXPORT", "MANAGE"),
      ...p("AI", "VIEW", "CONFIGURE"), ...p("INTEGRATIONS", "VIEW"), ...p("ANALYTICS", "VIEW", "EXPORT"), ...p("SECURITY", "VIEW", "MANAGE", "AUDIT"),
      ...p("AUDIT", "VIEW", "EXPORT"), ...p("DATA_GOVERNANCE", "VIEW"), ...p("NOTIFICATIONS", "VIEW", "CREATE", "EDIT", "MANAGE"),
      ...p("SYSTEM_HEALTH", "VIEW"), ...p("SETTINGS", "VIEW"),
    ],
  },
  {
    key: "CTO", name: "Chief Technology Officer", departmentKey: "EXECUTIVE",
    description: "Technical architecture and infrastructure. No default clinical-record access.",
    permissions: [
      ...p("OVERVIEW", "VIEW"), ...p("USERS", "VIEW"), ...p("SYSTEM_HEALTH", "VIEW", "MANAGE"), ...p("INTEGRATIONS", "VIEW", "CONFIGURE", "MANAGE"),
      ...p("MODULES", "VIEW", "CONFIGURE", "MANAGE"), ...p("ANALYTICS", "VIEW"), ...p("SECURITY", "VIEW", "AUDIT"), ...p("AUDIT", "VIEW"), ...p("AI", "VIEW", "CONFIGURE", "MANAGE"),
    ],
  },
  {
    key: "PLATFORM_ADMIN", name: "Platform Administrator", departmentKey: "PLATFORM_ADMIN",
    description: "Platform configuration and operations within an assigned scope.",
    permissions: [
      ...p("OVERVIEW", "VIEW"), ...p("USERS", "VIEW", "EDIT", "EXPORT"), ...p("FACILITIES", "VIEW", "EDIT", "EXPORT"), ...p("MODULES", "VIEW", "CONFIGURE"),
      ...p("NOTIFICATIONS", "VIEW", "CREATE", "EDIT"), ...p("ANALYTICS", "VIEW"), ...p("SYSTEM_HEALTH", "VIEW"), ...p("SETTINGS", "VIEW"),
    ],
  },
  {
    key: "FACILITY_ADMIN", name: "Facility Administrator", departmentKey: "USER_FACILITY",
    description: "Facility registration and account administration.",
    permissions: [...p("FACILITIES", "VIEW", "CREATE", "EDIT", "APPROVE", "EXPORT", "AUDIT"), ...p("USERS", "VIEW"), ...p("OVERVIEW", "VIEW")],
  },
  {
    key: "USER_MGMT_OFFICER", name: "User Management Officer", departmentKey: "USER_FACILITY",
    description: "User accounts and verification. Cannot view patient medical records.",
    permissions: [
      ...p("OVERVIEW", "VIEW"), ...p("USERS", "VIEW", "CREATE", "EDIT", "EXPORT", "AUDIT"), ...p("PATIENT_ACCOUNTS", "VIEW", "EDIT", "AUDIT"),
      ...p("DOCTORS", "VIEW", "APPROVE", "REJECT", "AUDIT"),
    ],
  },
  {
    key: "CLINICAL_GOVERNANCE", name: "Clinical Governance Officer", departmentKey: "CLINICAL_GOVERNANCE",
    description: "Clinical standards and governance. Clinical-record access only within an approved, audited scope.",
    permissions: [
      ...p("OVERVIEW", "VIEW"), ...p("GOVERNANCE", "VIEW", "CONFIGURE", "APPROVE", "AUDIT"), ...p("DOCUMENTS", "VIEW", "CONFIGURE", "APPROVE", "AUDIT"),
      ...p("DOCTORS", "VIEW", "AUDIT"), ...p("DEPARTMENTS", "VIEW", "CONFIGURE"),
    ],
  },
  {
    key: "MEDICAL_INFORMATICS", name: "Medical Informatics Officer", departmentKey: "CLINICAL_GOVERNANCE",
    description: "Clinical workflows and medical terminology.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("GOVERNANCE", "VIEW", "CONFIGURE"), ...p("DOCUMENTS", "VIEW", "CONFIGURE"), ...p("DEPARTMENTS", "VIEW", "CREATE", "EDIT", "CONFIGURE")],
  },
  {
    key: "DATA_PROTECTION_OFFICER", name: "Data Protection Officer", departmentKey: "SECURITY_COMPLIANCE",
    description: "Privacy, data protection and access reviews.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("DATA_GOVERNANCE", "VIEW", "CONFIGURE", "MANAGE"), ...p("SECURITY", "VIEW", "AUDIT"), ...p("AUDIT", "VIEW", "EXPORT"), ...p("USERS", "VIEW")],
  },
  {
    key: "SECURITY_ADMIN", name: "Security Administrator", departmentKey: "SECURITY_COMPLIANCE",
    description: "Security policies and incident management.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("SECURITY", "VIEW", "CREATE", "EDIT", "MANAGE", "AUDIT"), ...p("AUDIT", "VIEW"), ...p("SYSTEM_HEALTH", "VIEW"), ...p("USERS", "VIEW")],
  },
  {
    key: "TECH_SUPPORT_OFFICER", name: "Technical Support Officer", departmentKey: "TECH_SUPPORT",
    description: "Technical support and troubleshooting. Account status only — no patient records.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("SYSTEM_HEALTH", "VIEW"), ...p("USERS", "VIEW"), ...p("FACILITIES", "VIEW")],
  },
  {
    key: "FINANCE_ADMIN", name: "Finance Administrator", departmentKey: "FINANCE",
    description: "Billing, subscriptions and payments. Cannot edit clinical reports.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("SUBSCRIPTIONS", "VIEW", "CREATE", "EDIT", "EXPORT", "MANAGE"), ...p("ANALYTICS", "VIEW", "EXPORT")],
  },
  {
    key: "COMPLIANCE_OFFICER", name: "Compliance Officer", departmentKey: "SECURITY_COMPLIANCE",
    description: "Compliance documentation and reviews.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("GOVERNANCE", "VIEW"), ...p("AUDIT", "VIEW", "EXPORT"), ...p("DATA_GOVERNANCE", "VIEW"), ...p("SECURITY", "VIEW"), ...p("USERS", "VIEW")],
  },
  {
    key: "QA_OFFICER", name: "Quality Assurance Officer", departmentKey: "QA",
    description: "Testing, quality and issue tracking.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("ANALYTICS", "VIEW"), ...p("SYSTEM_HEALTH", "VIEW"), ...p("MODULES", "VIEW")],
  },
  {
    key: "INTEGRATION_ADMIN", name: "Integration Administrator", departmentKey: "INTEGRATIONS",
    description: "API and external system integrations.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("INTEGRATIONS", "VIEW", "CONFIGURE", "MANAGE"), ...p("SYSTEM_HEALTH", "VIEW")],
  },
  {
    key: "TRAINING_ADMIN", name: "Training Administrator", departmentKey: "TRAINING",
    description: "User onboarding and training.",
    permissions: [...p("OVERVIEW", "VIEW"), ...p("USERS", "VIEW"), ...p("NOTIFICATIONS", "VIEW", "CREATE")],
  },
  {
    key: "ANALYTICS_ADMIN", name: "Analytics Administrator", departmentKey: "DATA_ANALYTICS",
    description: "Reports, usage statistics and analytics. De-identified data by default.",
    permissions: [...p("OVERVIEW", "VIEW", "EXPORT"), ...p("ANALYTICS", "VIEW", "EXPORT")],
  },
];

/** Default approval gates (spec §18). Sensible defaults; fully configurable. */
export const DEFAULT_APPROVAL_WORKFLOWS: {
  actionKey: string; name: string; description: string;
  approverRoleKey: string; secondApproverRoleKey: string | null; requiresReauth: boolean;
}[] = [
  { actionKey: "CREATE_ADMIN_ACCOUNT", name: "Create ordinary admin account", description: "A team manager must approve new internal administrator accounts before activation.", approverRoleKey: "DEPUTY_SUPER_ADMIN", secondApproverRoleKey: null, requiresReauth: true },
  { actionKey: "ASSIGN_PRIVILEGED_ROLE", name: "Assign privileged admin role", description: "Only the Super Admin may approve assignment of privileged administrative roles.", approverRoleKey: "SUPER_ADMIN", secondApproverRoleKey: null, requiresReauth: true },
  { actionKey: "CHANGE_GLOBAL_PERMISSIONS", name: "Change global permissions", description: "Dual approval: Super Admin plus a second approver.", approverRoleKey: "SUPER_ADMIN", secondApproverRoleKey: "DEPUTY_SUPER_ADMIN", requiresReauth: true },
  { actionKey: "SUSPEND_FACILITY", name: "Suspend a healthcare facility", description: "An authorised administrator approves; the suspension is reviewed afterwards.", approverRoleKey: "DEPUTY_SUPER_ADMIN", secondApproverRoleKey: null, requiresReauth: true },
  { actionKey: "CHANGE_SECURITY_POLICY", name: "Change security policy", description: "Dual approval: Security Administrator plus Super Admin.", approverRoleKey: "SECURITY_ADMIN", secondApproverRoleKey: "SUPER_ADMIN", requiresReauth: true },
  { actionKey: "EXPORT_SENSITIVE_DATA", name: "Export sensitive data", description: "An authorised data officer approves any sensitive export.", approverRoleKey: "DATA_PROTECTION_OFFICER", secondApproverRoleKey: null, requiresReauth: true },
  { actionKey: "CHANGE_CLINICAL_TEMPLATES", name: "Change global clinical templates", description: "Clinical governance approval is required for global template changes.", approverRoleKey: "CLINICAL_GOVERNANCE", secondApproverRoleKey: null, requiresReauth: true },
  { actionKey: "DELETE_ADMIN_RECORDS", name: "Delete administrative records", description: "An authorised approver decides; the deletion is audited.", approverRoleKey: "DEPUTY_SUPER_ADMIN", secondApproverRoleKey: null, requiresReauth: true },
];
