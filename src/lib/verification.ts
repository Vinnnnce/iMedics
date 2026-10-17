import { prisma } from "./prisma";

/** Document types an applicant can attach, and which kind of applicant each belongs to. */
export const DOCUMENT_KINDS = {
  MDCN_CERTIFICATE: { label: "MDCN registration certificate", appliesTo: "DOCTOR" },
  PRACTISING_LICENSE: { label: "Practising licence", appliesTo: "DOCTOR" },
  CAC_CERTIFICATE: { label: "CAC certificate", appliesTo: "FACILITY" },
  FACILITY_LICENSE: { label: "Facility licence", appliesTo: "FACILITY" },
  OTHER: { label: "Other supporting document", appliesTo: "ANY" },
} as const;
export type DocumentKind = keyof typeof DOCUMENT_KINDS;
export const DOCUMENT_KIND_KEYS = Object.keys(DOCUMENT_KINDS) as [DocumentKind, ...DocumentKind[]];

export type ApplicantType = "DOCTOR" | "FACILITY";

/** Documents a reviewer expects to see before approving. */
export const REQUIRED_KINDS: Record<ApplicantType, DocumentKind[]> = {
  DOCTOR: ["MDCN_CERTIFICATE", "PRACTISING_LICENSE"],
  FACILITY: ["CAC_CERTIFICATE", "FACILITY_LICENSE"],
};

/** Verification documents are identity and licence scans: PDF or common image formats only. */
export const VERIFICATION_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

export const kindLabel = (kind: string) => (kind in DOCUMENT_KINDS ? DOCUMENT_KINDS[kind as DocumentKind].label : kind);

/** The caller's professional application (doctor or facility), if they have one. */
export async function findApplication(userId: string) {
  const [doctor, facility] = await Promise.all([
    prisma.doctorProfile.findUnique({ where: { userId }, select: { id: true, verificationStatus: true } }),
    prisma.labStaffProfile.findUnique({ where: { userId }, select: { id: true, verificationStatus: true } }),
  ]);
  if (doctor) return { type: "DOCTOR" as const, ...doctor };
  if (facility) return { type: "FACILITY" as const, ...facility };
  return null;
}
