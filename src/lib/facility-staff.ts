import { randomBytes } from "node:crypto";
import type { FacilityStaffRole, StaffCredential } from "@prisma/client";

export type { FacilityStaffRole };

/**
 * Facility-level permissions. A staff member's permissions come from their
 * facility role only — never from their global platform role. Every dashboard
 * action checks one of these; the sets below follow least-privilege.
 */
export const FACILITY_PERMISSIONS = [
  "MANAGE_PROFILE", // Edit facility portfolio fields and publication
  "MANAGE_STAFF", // Invite, assign roles, suspend or terminate staff
  "MANAGE_SERVICES", // Create and edit services and prices
  "MANAGE_BOOKINGS", // Confirm, cancel, assign bookings
  "PROCESS_ORDERS", // Check-in, sample collection/receipt
  "ENTER_RESULTS", // Enter results, upload images, draft reports
  "VERIFY_RESULTS", // Verify, approve or amend results
  "RELEASE_RESULTS", // Release results to patients
  "REGISTER_PATIENTS", // Register and look up patients
  "TAKE_PAYMENTS", // Take and record payments
  "VIEW_REVENUE", // View revenue and earnings reports
  "MANAGE_PAYOUTS", // Manage settlement configuration
  "MANAGE_CREDENTIALS", // Record and verify staff credentials
  "MANAGE_REFERRALS", // Accept, decline or fulfil referrals
  "VIEW_AUDIT", // Read-only access to audit logs
] as const;

export type FacilityPermission = (typeof FACILITY_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<FacilityStaffRole, readonly FacilityPermission[]> = {
  OWNER: FACILITY_PERMISSIONS,
  // Staff, schedules, services, reports and operational dashboards — not payouts.
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
  ],
  // Consultations, referrals, clinical records.
  DOCTOR: ["MANAGE_BOOKINGS", "REGISTER_PATIENTS", "MANAGE_REFERRALS"],
  // Sample tracking, test entry, result entry, report preparation.
  LAB_SCIENTIST: ["PROCESS_ORDERS", "ENTER_RESULTS", "VERIFY_RESULTS", "RELEASE_RESULTS"],
  // Sample processing, equipment logs, result entry.
  LAB_TECHNICIAN: ["PROCESS_ORDERS", "ENTER_RESULTS"],
  // Sample receipt, labelling, preparation.
  LAB_ASSISTANT: ["PROCESS_ORDERS"],
  // Patient identification, sample collection, labelling.
  PHLEBOTOMIST: ["PROCESS_ORDERS"],
  // Patient care tasks, appointment support.
  NURSE: ["PROCESS_ORDERS", "REGISTER_PATIENTS"],
  // Imaging procedures, image upload, technical reports.
  RADIOGRAPHER: ["PROCESS_ORDERS", "ENTER_RESULTS"],
  // Booking, patient registration, payments.
  RECEPTIONIST: ["MANAGE_BOOKINGS", "REGISTER_PATIENTS", "TAKE_PAYMENTS"],
  // Invoices, payments, refunds, revenue reports.
  ACCOUNTANT: ["TAKE_PAYMENTS", "VIEW_REVENUE"],
  // Read-only audit logs, credential reports, compliance records.
  COMPLIANCE_OFFICER: ["VIEW_AUDIT", "MANAGE_CREDENTIALS"],
};

export function permissionsForRole(role: FacilityStaffRole): readonly FacilityPermission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermission(role: FacilityStaffRole, permission: FacilityPermission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
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
};

export const FACILITY_STAFF_STATUS_LABEL: Record<string, string> = {
  INVITED: "Invited",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  ON_LEAVE: "On leave",
  TERMINATED: "Terminated",
};

/** Roles a manager may assign. OWNER can only be set by the platform. */
export const ASSIGNABLE_ROLES: readonly FacilityStaffRole[] = [
  "FACILITY_MANAGER",
  "DOCTOR",
  "LAB_SCIENTIST",
  "LAB_TECHNICIAN",
  "LAB_ASSISTANT",
  "PHLEBOTOMIST",
  "NURSE",
  "RADIOGRAPHER",
  "RECEPTIONIST",
  "ACCOUNTANT",
  "COMPLIANCE_OFFICER",
];

/** Single-use invite token (URL-safe). */
export function generateInviteToken(): string {
  return randomBytes(24).toString("hex");
}

export const INVITE_EXPIRY_DAYS = 7;

/** Reminder thresholds, in days, in the order reminders are sent. */
export const CREDENTIAL_REMINDER_STAGES = [90, 60, 30, 7] as const;

export type CredentialExpiryState = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "UNKNOWN";

export interface CredentialLike {
  expiryDate: Date | string | null;
}

/**
 * Expiry state for a credential. `UNKNOWN` means no expiry date is recorded
 * (some certifications do not expire) — never rendered as "valid".
 */
export function credentialExpiryState(credential: CredentialLike, now = new Date()): CredentialExpiryState {
  if (!credential.expiryDate) return "UNKNOWN";
  const expiry = typeof credential.expiryDate === "string" ? new Date(credential.expiryDate) : credential.expiryDate;
  if (expiry.getTime() < now.getTime()) return "EXPIRED";
  const days = daysUntil(expiry, now);
  return days <= 30 ? "EXPIRING_SOON" : "VALID";
}

/** Whole days until the date (negative if past). */
export function daysUntil(date: Date, now = new Date()): number {
  return Math.floor((date.getTime() - now.getTime()) / 86_400_000);
}

/**
 * The highest reminder stage that should have been sent for a credential,
 * or null when no reminder is due (far from expiry, already expired with a
 * reminder sent, or no expiry date).
 */
export function dueReminderStage(
  credential: Pick<StaffCredential, "expiryDate" | "lastReminderStage">,
  now = new Date(),
): number | null {
  if (!credential.expiryDate) return null;
  const days = daysUntil(new Date(credential.expiryDate), now);
  if (days < 0) return null; // expiry handled separately by the expired dispatcher
  let due: number | null = null;
  for (const stage of CREDENTIAL_REMINDER_STAGES) {
    if (days <= stage) due = stage;
  }
  return due;
}
