import type { InvestigationDomain, InvestigationItemStatus, InvestigationPriority, InvestigationReportFormat } from "@prisma/client";

/** Domains shown on the doctor's initial selection screen. */
export const DOMAIN_META: Record<InvestigationDomain, { title: string; subtitle: string; description: string; bullets: string[] }> = {
  DIAGNOSTIC: {
    title: "Diagnostics",
    subtitle: "Instrumental and imaging investigations",
    description: "Imaging, functional tests, endoscopy and specialist diagnostic procedures.",
    bullets: ["Imaging investigations", "Instrumental examinations", "Functional diagnostic tests", "Specialist diagnostic procedures"],
  },
  LABORATORY: {
    title: "Laboratory Analysis",
    subtitle: "Laboratory tests and specimen investigations",
    description: "Blood, urine, stool, microbiology, biochemistry, pathology and more.",
    bullets: ["Blood and haematological", "Urine and stool", "Microbiology and clinical biochemistry", "Histopathology and cytology"],
  },
};

export const PRIORITY_LABEL: Record<InvestigationPriority, string> = { ROUTINE: "Routine", URGENT: "Urgent", EMERGENCY: "Emergency" };

/** Priority drives the target turnaround multiplier and worklist ordering. */
export const PRIORITY_RANK: Record<InvestigationPriority, number> = { ROUTINE: 0, URGENT: 1, EMERGENCY: 2 };

export const STATUS_LABEL: Record<InvestigationItemStatus, string> = {
  NEW_REQUEST: "New request received",
  AWAITING_SAMPLE: "Awaiting sample collection",
  SAMPLE_COLLECTED: "Sample collected",
  SAMPLE_RECEIVED: "Sample received",
  SAMPLE_REJECTED: "Sample rejected",
  ASSIGNED_TO_SECTION: "Assigned to laboratory section",
  PROCESSING: "Processing",
  ANALYSIS_COMPLETED: "Analysis completed",
  RESULT_ENTERED: "Result entered",
  AWAITING_APPOINTMENT: "Awaiting appointment",
  APPOINTMENT_SCHEDULED: "Appointment scheduled",
  PATIENT_PREPARATION: "Patient preparation",
  CHECKED_IN: "Patient checked in",
  EXAM_IN_PROGRESS: "Examination in progress",
  EXAM_COMPLETED: "Examination completed",
  MEDIA_UPLOADED: "Images / recordings uploaded",
  AWAITING_INTERPRETATION: "Awaiting specialist interpretation",
  PRELIMINARY_REPORT: "Preliminary report",
  AWAITING_VERIFICATION: "Awaiting verification",
  VERIFIED: "Verified",
  SIGNED: "Signed / approved",
  RELEASED: "Released",
  DELIVERED: "Delivered to doctor and patient record",
  CANCELLED: "Cancelled",
  REFERRAL_PENDING: "Referral pending",
};

/** Coarse bucket used by the doctor's tabs (Pending / In progress / Completed). */
export type StatusBucket = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

const PENDING: InvestigationItemStatus[] = ["NEW_REQUEST", "AWAITING_SAMPLE", "AWAITING_APPOINTMENT", "REFERRAL_PENDING"];
const DONE: InvestigationItemStatus[] = ["RELEASED", "DELIVERED"];

export function statusBucket(status: InvestigationItemStatus): StatusBucket {
  if (status === "CANCELLED") return "CANCELLED";
  if (DONE.includes(status)) return "COMPLETED";
  if (PENDING.includes(status)) return "PENDING";
  return "IN_PROGRESS";
}

export const PENDING_STATUSES = PENDING;
export const COMPLETED_STATUSES = DONE;
/** Statuses where no result may be shown to a doctor or patient as a final report. */
export const RELEASED_STATUSES: InvestigationItemStatus[] = ["RELEASED", "DELIVERED"];

/** Default target turnaround (minutes) when neither the facility nor the catalogue configures one. */
export const DEFAULT_TURNAROUND_MINUTES: Record<InvestigationDomain, number> = { LABORATORY: 24 * 60, DIAGNOSTIC: 72 * 60 };

/** Emergency and urgent orders are due sooner than the configured routine turnaround. */
export const PRIORITY_TURNAROUND_FACTOR: Record<InvestigationPriority, number> = { ROUTINE: 1, URGENT: 0.5, EMERGENCY: 0.25 };

export const REPORT_FORMAT_LABEL: Record<InvestigationReportFormat, string> = {
  LAB_PANEL: "Laboratory results",
  NARRATIVE: "Narrative report",
  ULTRASOUND: "Ultrasound report",
  MRI: "MRI report",
  CT: "CT report",
  XRAY: "X-ray report",
  MAMMOGRAPHY: "Mammography report",
  ECHOCARDIOGRAPHY: "Echocardiography report",
  ECG: "ECG report",
  EEG: "EEG report",
  ENDOSCOPY: "Endoscopy report",
  GENERIC: "Specialist report",
};

export const ELECTRONIC_AUTHORISATION_STATEMENT =
  "I confirm that I am the requesting clinician, that this investigation is clinically indicated, and that I authorise this request.";
