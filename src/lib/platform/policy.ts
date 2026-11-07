import { z } from "zod";

export const MODULES = ["STAFF", "DEPARTMENTS", "PATIENTS", "CLINICAL_DOCUMENTS", "DOCUMENT_TEMPLATES", "APPOINTMENTS", "CONSULTATIONS", "PRESCRIPTIONS", "LABORATORY", "DIAGNOSTICS", "PHARMACY", "NURSING", "EMERGENCY", "ADMISSIONS", "BILLING", "ANALYTICS", "AI", "TELEMEDICINE", "NOTIFICATIONS"] as const;
export const policyRulesSchema = z.object({
  accountTypes: z.array(z.string().min(1).max(80)).max(30).default([]),
  facilityTypes: z.array(z.string().min(1).max(80)).max(30).default([]),
  facilityIds: z.array(z.string().uuid()).max(100).default([]),
  roles: z.array(z.string().min(1).max(80)).max(50).default([]),
  countries: z.array(z.string().length(2)).max(100).default([]),
  // The existing platform sells doctor subscriptions only. Never infer a facility entitlement.
  subscriptionPlans: z.array(z.string().uuid()).max(50).default([]),
  startsAt: z.iso.datetime().nullable().default(null),
  endsAt: z.iso.datetime().nullable().default(null),
  deniedActions: z.array(z.enum(["VIEW", "CREATE", "EDIT", "APPROVE", "SIGN", "DOWNLOAD", "PRINT"])).default([]),
}).refine((r) => !r.startsAt || !r.endsAt || r.startsAt < r.endsAt, "End date must follow start date");
export type PolicyRules = z.infer<typeof policyRulesSchema>;
export interface PolicyContext {
  accountType: string | null; role: string; facilityId?: string; facilityType?: string | null;
  country?: string | null; subscriptionPlanId?: string | null; facilityRole?: string | null;
}
export interface PolicyLike { mode: string; rules: unknown; }

/** Every applicable policy intersects. No role, facility or platform-admin bypass. */
export function policyAllows(policy: PolicyLike, context: PolicyContext, action: string, now = new Date()): boolean {
  const parsed = policyRulesSchema.safeParse(policy.rules);
  if (!parsed.success) return false;
  const r = parsed.data;
  // Account/facility selectors define the target population; empty means everyone.
  if (r.accountTypes.length && (!context.accountType || !r.accountTypes.includes(context.accountType))) return true;
  if (r.facilityTypes.length && (!context.facilityType || !r.facilityTypes.includes(context.facilityType))) return true;
  if (r.facilityIds.length && (!context.facilityId || !r.facilityIds.includes(context.facilityId))) return true;
  if (policy.mode === "ENABLED") return true;
  if (policy.mode === "DISABLED") return false;
  if (policy.mode === "READ_ONLY" && !["VIEW", "DOWNLOAD", "PRINT"].includes(action)) return false;
  if (r.startsAt && now < new Date(r.startsAt)) return false;
  if (r.endsAt && now >= new Date(r.endsAt)) return false;
  if (r.roles.length && !r.roles.includes(context.role) && (!context.facilityRole || !r.roles.includes(context.facilityRole))) return false;
  if (r.countries.length && (!context.country || !r.countries.includes(context.country.toUpperCase()))) return false;
  if (r.subscriptionPlans.length && (!context.subscriptionPlanId || !r.subscriptionPlans.includes(context.subscriptionPlanId))) return false;
  return !r.deniedActions.includes(action as PolicyRules["deniedActions"][number]);
}

/** Central registry shared by API enforcement and navigation. Longest prefix wins. */
const PATHS: [string, typeof MODULES[number]][] = [
  ["/facility/staff", "STAFF"], ["/facility/organization", "DEPARTMENTS"], ["/facility/departments", "DEPARTMENTS"],
  ["/facility/his/templates", "DOCUMENT_TEMPLATES"], ["/facility/document-templates", "DOCUMENT_TEMPLATES"],
  ["/facility/his/documents", "CLINICAL_DOCUMENTS"], ["/patient/hospital-documents", "CLINICAL_DOCUMENTS"],
  ["/patient/clinical-documents", "CLINICAL_DOCUMENTS"], ["/documents", "CLINICAL_DOCUMENTS"],
  ["/patient/medical-documents", "CLINICAL_DOCUMENTS"], ["/doctor/medical-documents", "CLINICAL_DOCUMENTS"],
  ["/patient/documents", "CLINICAL_DOCUMENTS"], ["/facility/documents", "CLINICAL_DOCUMENTS"], ["/workspace/documents", "CLINICAL_DOCUMENTS"],
  ["/files", "LABORATORY"], ["/patient/media", "DIAGNOSTICS"],
  ["/facility/documents", "CLINICAL_DOCUMENTS"], ["/patient/documents", "CLINICAL_DOCUMENTS"],
  ["/facility/his/nursing", "NURSING"], ["/facility/nursing", "NURSING"],
  ["/facility/his/medication-", "PRESCRIPTIONS"], ["/prescriptions", "PRESCRIPTIONS"],
  ["/facility/pharmacy", "PHARMACY"], ["/facility/his/formulary", "PHARMACY"],
  ["/facility/admissions", "ADMISSIONS"], ["/facility/his/beds", "ADMISSIONS"], ["/facility/his/wards", "ADMISSIONS"],
  ["/facility/his/emergency", "EMERGENCY"], ["/facility/his/encounters", "PATIENTS"], ["/facility/patients", "PATIENTS"],
  ["/facility/specimens", "LABORATORY"], ["/facility/lab-", "LABORATORY"], ["/lab-orders", "LABORATORY"], ["/lab-results", "LABORATORY"],
  ["/facility/diagnostic-", "DIAGNOSTICS"], ["/facility/his/media", "DIAGNOSTICS"],
  ["/facility/bookings", "APPOINTMENTS"], ["/facility-bookings", "APPOINTMENTS"], ["/appointments", "APPOINTMENTS"],
  ["/consultations", "CONSULTATIONS"], ["/ai", "AI"], ["/payments", "BILLING"],
  ["/notifications", "NOTIFICATIONS"], ["/facility/his/analytics", "ANALYTICS"],
  ["/lab/organization", "DEPARTMENTS"], ["/lab/staff", "STAFF"], ["/lab/clinical-documents/templates", "DOCUMENT_TEMPLATES"],
  ["/lab/document-templates", "DOCUMENT_TEMPLATES"], ["/lab/clinical-documents", "CLINICAL_DOCUMENTS"],
  ["/lab/documents", "CLINICAL_DOCUMENTS"], ["/lab/nursing", "NURSING"], ["/lab/pharmacy", "PHARMACY"],
  ["/lab/admissions", "ADMISSIONS"], ["/lab/wards", "ADMISSIONS"], ["/lab/emergency", "EMERGENCY"],
  ["/lab/orders", "LABORATORY"], ["/lab/specimens", "LABORATORY"], ["/lab/investigations", "DIAGNOSTICS"],
  ["/lab/examinations", "DIAGNOSTICS"], ["/lab/media", "DIAGNOSTICS"], ["/lab/bookings", "APPOINTMENTS"],
  ["/lab/his-analytics", "ANALYTICS"], ["/doctor/consultations", "CONSULTATIONS"], ["/doctor/ai-tools", "AI"],
  ["/patient/appointments", "APPOINTMENTS"], ["/patient/prescriptions", "PRESCRIPTIONS"],
];
export function moduleForPath(path: string) {
  const p = path.replace(/^\/api/, "").split("?")[0];
  return [...PATHS].sort((a, b) => b[0].length - a[0].length).find(([prefix]) => p === prefix || p.startsWith(`${prefix}/`) || (prefix.endsWith("-") && p.startsWith(prefix)))?.[1] ?? null;
}
