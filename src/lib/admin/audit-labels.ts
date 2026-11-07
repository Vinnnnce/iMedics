/** Human-readable names for audit actions, grouped for filtering. Unknown actions fall back to a tidy version of the code. */
const LABELS: Record<string, string> = {
  REGISTRATION_SUBMITTED: "Registration submitted",
  VERIFICATION_DOCUMENT_ADDED: "Verification document added",
  VERIFICATION_DOCUMENT_REMOVED: "Verification document removed",
  VERIFICATION_RESUBMITTED: "Application resubmitted",
  ADMIN_VERIFICATION_APPROVED: "Application approved",
  ADMIN_VERIFICATION_REJECTED: "Application rejected",
  ADMIN_VIEWED_VERIFICATION_DOCUMENTS: "Viewed verification documents",
  ADMIN_VIEWED_USER: "Viewed account details",
  ADMIN_UPDATE_USER: "Updated account",
  ADMIN_CHANGED_STATUS: "Changed account status",
  ADMIN_CHANGED_ROLE: "Changed administrator access",
  ADMIN_REFUND: "Refunded payment",
  ADMIN_EXPORT: "Exported data",
  ADMIN_CONTENT_CHANGED: "Changed notice or advertisement",
  APPOINTMENT_BOOKED: "Appointment booked",
  APPOINTMENT_RESCHEDULED: "Appointment rescheduled",
  APPOINTMENT_CONFIRMED: "Appointment confirmed",
  APPOINTMENT_CANCELLED: "Appointment cancelled",
  APPOINTMENT_COMPLETED: "Appointment completed",
  PAYMENT_CHECKOUT_STARTED: "Payment started",
  DOCTOR_FEES_UPDATED: "Doctor fees updated",
  FACILITY_SERVICE_CREATED: "Service added",
  FACILITY_SERVICE_UPDATED: "Service updated",
  FACILITY_SERVICE_REMOVED: "Service removed",
  FACILITY_BOOKING_CREATED: "Service booked",
  PATIENT_VIEWED: "Patient record viewed",
  PATIENT_CREATED: "Patient record created",
  PATIENT_UPDATED: "Patient record updated",
  CONSULTATION_CREATED: "Consultation written",
  CONSULTATION_VIEWED: "Consultation viewed",
  PROFILE_REPORTED: "Profile reported",
  PROFILE_REPORT_REVIEWED: "Profile report reviewed",
  CONSULTATION_UPDATED: "Consultation draft updated",
  CONSULTATION_AMENDED: "Consultation report amended",
  CONSULTATION_PDF_DOWNLOADED: "Consultation PDF downloaded",
  LAB_RESULTS_VIEWED: "Lab results viewed",
  LAB_RESULT_SUBMITTED: "Lab result submitted",
  LAB_FILE_DOWNLOADED: "Lab file downloaded",
  AI_ANALYSIS_REQUESTED: "AI analysis requested",
};

export function describeAction(action: string): string {
  if (LABELS[action]) return LABELS[action];
  const text = action.replace(/_/g, " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const ACTION_GROUPS = {
  admin: { label: "Administrator actions", prefixes: ["ADMIN_"] },
  verification: { label: "Registration and verification", prefixes: ["REGISTRATION_", "VERIFICATION_", "ADMIN_VERIFICATION_", "ADMIN_VIEWED_VERIFICATION"] },
  clinical: { label: "Clinical record access", prefixes: ["PATIENT_", "CONSULTATION_", "HISTORY_", "LAB_", "CLINICAL_", "AI_", "PRESCRIPTION_"] },
  appointments: { label: "Appointments", prefixes: ["APPOINTMENT_", "SCHEDULE_"] },
  payments: { label: "Payments and fees", prefixes: ["PAYMENT_", "ADMIN_REFUND", "DOCTOR_FEES_", "FACILITY_"] },
} as const;
export type ActionGroup = keyof typeof ACTION_GROUPS;
export const ACTION_GROUP_KEYS = Object.keys(ACTION_GROUPS) as [ActionGroup, ...ActionGroup[]];
