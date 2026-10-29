import { z } from "zod";

/**
 * Client-safe document constants and pure helpers. Kept separate from
 * `src/lib/documents.ts` so browser components can use the validation schemas
 * and labels without pulling in Prisma.
 */

export const DOCUMENT_CATEGORIES = [
  "LAB_REPORT",
  "DIAGNOSTIC_REPORT",
  "IMAGING_REPORT",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "REFERRAL_LETTER",
  "VACCINATION_RECORD",
  "OTHER",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  LAB_REPORT: "Laboratory report",
  DIAGNOSTIC_REPORT: "Diagnostic report",
  IMAGING_REPORT: "Imaging report",
  PRESCRIPTION: "Prescription",
  DISCHARGE_SUMMARY: "Discharge summary",
  REFERRAL_LETTER: "Referral letter",
  VACCINATION_RECORD: "Vaccination record",
  OTHER: "Other",
};

/** Common medical document formats: PDF and standard images. */
export const ALLOWED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024; // 20 MB

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(DOCUMENT_CATEGORIES),
  fileName: z.string().trim().min(1).max(200),
  mimeType: z.enum(ALLOWED_DOCUMENT_MIME_TYPES),
  sizeBytes: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
  patientId: z.string().uuid().optional(),
  issuedOn: z.coerce.date().optional(),
  issuingFacility: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const updateDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.enum(DOCUMENT_CATEGORIES).optional(),
  notes: z.string().trim().max(1000).optional(),
  issuedOn: z.coerce.date().optional(),
});

export interface AccessibleDocument {
  document: {
    id: string;
    patientId: string;
    category: string;
    title: string;
    fileName: string;
    storageKey: string;
    mimeType: string;
    sizeBytes: number;
    issuingFacility: string | null;
    issuingFacilityId: string | null;
    issuedOn: Date | null;
    notes: string | null;
    uploadedById: string;
    createdAt: Date;
    deletedAt: Date | null;
  };
  canManage: boolean;
}

/** Whether a sniffed file head looks like the declared type (basic magic bytes). */
export function looksLikeDeclaredType(head: Uint8Array, mimeType: string): boolean {
  const starts = (bytes: number[]) => bytes.length <= head.length && bytes.every((b, i) => head[i] === b);
  switch (mimeType) {
    case "application/pdf":
      return starts([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "image/jpeg":
      return starts([0xff, 0xd8, 0xff]);
    case "image/png":
      return starts([0x89, 0x50, 0x4e, 0x47]);
    case "image/webp":
      return head.length >= 12 && head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50; // WEBP
    default:
      return false;
  }
}
