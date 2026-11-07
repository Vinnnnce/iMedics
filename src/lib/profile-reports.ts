import { z } from "zod";

export const REPORT_REASONS = {
  INACCURATE: "Inaccurate or misleading information",
  IMPERSONATION: "Impersonation or fake credentials",
  INAPPROPRIATE: "Inappropriate content",
  UNPROFESSIONAL: "Unprofessional conduct",
  OTHER: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const MAX_REPORTS_PER_DAY = 10;

export const createReportSchema = z.object({
  targetType: z.enum(["DOCTOR", "FACILITY"]),
  targetId: z.string().uuid(),
  reason: z.enum(Object.keys(REPORT_REASONS) as [ReportReason, ...ReportReason[]]),
  details: z.string().trim().max(1000).optional(),
});
