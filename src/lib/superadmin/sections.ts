import type { AdminSection } from "./permissions";

/** Console navigation: the recommended sidebar (spec §23) grouped into the
 * five control layers. `section` maps to the permission catalog; the layout
 * filters entries by the caller's VIEW permission server-side. */
export interface ConsoleLink {
  section: AdminSection;
  href: string;
  label: string;
  icon: string;
  exact?: boolean;
  group: "Governance" | "Team & Workforce" | "Healthcare Network" | "Clinical & Content" | "Security & Operations";
}

export const CONSOLE_LINKS: ConsoleLink[] = [
  { section: "OVERVIEW", href: "/super-admin", label: "Overview Dashboard", icon: "LayoutDashboard", exact: true, group: "Governance" },
  { section: "USERS", href: "/super-admin/users", label: "Global User Management", icon: "Users", group: "Governance" },
  { section: "SETTINGS", href: "/super-admin/settings", label: "Platform Settings", icon: "Settings", group: "Governance" },
  { section: "MODULES", href: "/super-admin/modules", label: "Module & Feature Control", icon: "Blocks", group: "Governance" },
  { section: "NOTIFICATIONS", href: "/super-admin/notifications", label: "Notifications", icon: "Bell", group: "Governance" },

  { section: "TEAM", href: "/super-admin/team", label: "Admin Team Management", icon: "UsersRound", group: "Team & Workforce" },
  { section: "ROLES", href: "/super-admin/roles", label: "Roles & Permissions", icon: "KeyRound", group: "Team & Workforce" },
  { section: "APPROVALS", href: "/super-admin/approvals", label: "Approval Workflows", icon: "ClipboardCheck", group: "Team & Workforce" },

  { section: "FACILITIES", href: "/super-admin/facilities", label: "Facility Management", icon: "Building2", group: "Healthcare Network" },
  { section: "DEPARTMENTS", href: "/super-admin/departments", label: "Departments & Specialties", icon: "Stethoscope", group: "Healthcare Network" },
  { section: "DOCTORS", href: "/super-admin/doctors", label: "Doctor Management", icon: "HeartPulse", group: "Healthcare Network" },
  { section: "PATIENT_ACCOUNTS", href: "/super-admin/patients", label: "Patient Account Management", icon: "UserRound", group: "Healthcare Network" },
  { section: "NURSING", href: "/super-admin/nursing", label: "Nursing Management", icon: "BriefcaseMedical", group: "Healthcare Network" },
  { section: "LABORATORY", href: "/super-admin/laboratory", label: "Laboratory Management", icon: "Microscope", group: "Healthcare Network" },
  { section: "RADIOLOGY", href: "/super-admin/radiology", label: "Radiology & Diagnostics", icon: "Scan", group: "Healthcare Network" },
  { section: "PHARMACY", href: "/super-admin/pharmacy", label: "Pharmacy Management", icon: "Pill", group: "Healthcare Network" },

  { section: "GOVERNANCE", href: "/super-admin/governance", label: "Clinical Governance", icon: "ShieldCheck", group: "Clinical & Content" },
  { section: "DOCUMENTS", href: "/super-admin/documents", label: "Medical Documents & Templates", icon: "FileText", group: "Clinical & Content" },
  { section: "AI", href: "/super-admin/ai", label: "AI Management", icon: "Bot", group: "Clinical & Content" },

  { section: "SECURITY", href: "/super-admin/security", label: "Security Centre", icon: "Siren", group: "Security & Operations" },
  { section: "AUDIT", href: "/super-admin/audit", label: "Audit Logs", icon: "ScrollText", group: "Security & Operations" },
  { section: "DATA_GOVERNANCE", href: "/super-admin/data-governance", label: "Data Governance", icon: "Database", group: "Security & Operations" },
  { section: "ANALYTICS", href: "/super-admin/analytics", label: "Analytics & Reports", icon: "BarChart3", group: "Security & Operations" },
  { section: "INTEGRATIONS", href: "/super-admin/integrations", label: "Integrations & API Management", icon: "Plug", group: "Security & Operations" },
  { section: "SUBSCRIPTIONS", href: "/super-admin/subscriptions", label: "Subscription & Billing", icon: "CreditCard", group: "Security & Operations" },
  { section: "SYSTEM_HEALTH", href: "/super-admin/system-health", label: "System Health", icon: "Server", group: "Security & Operations" },
];

export const CONSOLE_GROUPS = ["Governance", "Team & Workforce", "Healthcare Network", "Clinical & Content", "Security & Operations"] as const;
