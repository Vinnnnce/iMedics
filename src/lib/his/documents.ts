import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notFound } from "@/lib/errors";
import { FACILITY_ROLE_LABEL } from "@/lib/facility-staff";
import { groupTitle } from "./catalogue";
import { parseDefinition, sectionVisible, type DocumentContent, type TemplateDefinition } from "./template-schema";
import { contentHash, missingSignatures, watermarkFor, STATUS_LABEL } from "./workflow";

export const documentInclude = {
  templateVersion: { select: { version: true, definition: true, template: { select: { id: true, name: true, code: true } } } },
  patient: { select: { id: true, userId: true, caseNumber: true, firstName: true, lastName: true, middleName: true, gender: true, dateOfBirth: true } },
  encounter: { select: { id: true, encounterNumber: true, type: true } },
  author: { select: { id: true, name: true } },
  signatures: { orderBy: { signedAt: "asc" as const } },
  events: { orderBy: { createdAt: "asc" as const }, take: 200 },
  supersedes: { select: { id: true, documentNumber: true } },
  supersededBy: { select: { id: true, documentNumber: true, status: true, releasedToPatientAt: true } },
  facility: { select: { id: true, laboratoryName: true, addressLine: true, city: true, state: true, phone: true, email: true, hospitalSettings: true } },
} satisfies Prisma.ClinicalDocumentInclude;

export type DocumentRow = Prisma.ClinicalDocumentGetPayload<{ include: typeof documentInclude }>;

/** Load a document only when it belongs to the facility (cross-tenant ids are 404). */
export async function loadFacilityDocument(facilityId: string, id: string): Promise<DocumentRow> {
  const doc = await prisma.clinicalDocument.findFirst({ where: { id, facilityId }, include: documentInclude });
  if (!doc) throw notFound("Document not found");
  return doc;
}

export interface DocumentView {
  id: string;
  documentNumber: string;
  title: string;
  groupCode: string;
  groupTitle: string;
  status: DocumentRow["status"];
  statusLabel: string;
  watermark: string | null;
  sensitivity: DocumentRow["sensitivity"];
  revision: number;
  templateName: string;
  templateVersion: number;
  department: string | null;
  createdAt: string;
  finalizedAt: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  releasedToPatientAt: string | null;
  contentHash: string | null;
  amendmentReason: string | null;
  supersedes: { id: string; documentNumber: string } | null;
  supersededBy: { id: string; documentNumber: string; status: string } | null;
  author: { id: string; name: string };
  facility: { name: string; letterhead: string[]; address: string | null; contact: string | null; footer: string | null; pageSize: string; logoUrl: string | null; prefix: string };
  patient: { id: string; name: string; caseNumber: string; dateOfBirth: string; gender: string };
  encounterNumber: string | null;
  definition: TemplateDefinition;
  content: DocumentContent;
  sections: { id: string; title: string; fields: { id: string; label: string; type: string; value: DocumentContent[string] | undefined; columns?: string[]; unit?: string }[] }[];
  signatures: { id: string; role: string; method: string; signerName: string; signerTitle: string | null; registrationId: string | null; relationship: string | null; signedAt: string; valid: boolean; revokedAt: string | null }[];
  missingSignatureLabels: string[];
  events: { action: string; note: string | null; createdAt: string; actorId: string | null }[];
}

export async function buildDocumentView(doc: DocumentRow): Promise<DocumentView> {
  const definition = parseDefinition(doc.templateVersion.definition);
  const content = (doc.content ?? {}) as DocumentContent;
  const hash = doc.contentHash ?? contentHash(content);
  const reviewer = doc.reviewedById ? await prisma.user.findUnique({ where: { id: doc.reviewedById }, select: { name: true } }) : null;
  const s = doc.facility.hospitalSettings;
  const fallbackAddress = [doc.facility.addressLine, doc.facility.city, doc.facility.state].filter(Boolean).join(", ") || null;
  return {
    id: doc.id,
    documentNumber: doc.documentNumber,
    title: doc.title,
    groupCode: doc.groupCode,
    groupTitle: groupTitle(doc.groupCode),
    status: doc.status,
    statusLabel: STATUS_LABEL[doc.status],
    watermark: watermarkFor(doc.status),
    sensitivity: doc.sensitivity,
    revision: doc.revision,
    templateName: doc.templateVersion.template.name,
    templateVersion: doc.templateVersion.version,
    department: doc.department,
    createdAt: doc.createdAt.toISOString(),
    finalizedAt: doc.finalizedAt?.toISOString() ?? null,
    reviewedAt: doc.reviewedAt?.toISOString() ?? null,
    reviewedByName: reviewer?.name ?? null,
    releasedToPatientAt: doc.releasedToPatientAt?.toISOString() ?? null,
    contentHash: doc.contentHash,
    amendmentReason: doc.amendmentReason,
    supersedes: doc.supersedes,
    supersededBy: doc.supersededBy ? { id: doc.supersededBy.id, documentNumber: doc.supersededBy.documentNumber, status: doc.supersededBy.status } : null,
    author: doc.author,
    facility: {
      name: s?.displayName || doc.facility.laboratoryName || "Medic1905 facility",
      letterhead: s?.letterheadLines ?? [],
      address: s?.addressLine || fallbackAddress,
      contact: [s?.contactPhone || doc.facility.phone, s?.contactEmail || doc.facility.email].filter(Boolean).join(" · ") || null,
      footer: s?.footerText ?? null,
      pageSize: definition.output.pageSize || s?.pageSize || "A4",
      logoUrl: s?.logoUrl ?? null,
      prefix: s?.documentNumberPrefix ?? "DOC",
    },
    patient: {
      id: doc.patient.id,
      name: [doc.patient.firstName, doc.patient.middleName, doc.patient.lastName].filter(Boolean).join(" "),
      caseNumber: doc.patient.caseNumber,
      dateOfBirth: doc.patient.dateOfBirth.toISOString().slice(0, 10),
      gender: doc.patient.gender,
    },
    encounterNumber: doc.encounter?.encounterNumber ?? null,
    definition,
    content,
    sections: definition.sections
      .filter((sec) => sectionVisible(sec, content))
      .map((sec) => ({
        id: sec.id,
        title: sec.title,
        fields: sec.fields.filter((f) => f.type !== "signature").map((f) => ({ id: f.id, label: f.label, type: f.type, value: content[f.id], columns: f.columns, unit: f.unit })),
      })),
    signatures: doc.signatures.map((sig) => ({
      id: sig.id,
      role: sig.role,
      method: sig.method,
      signerName: sig.signerName,
      signerTitle: sig.signerTitle,
      registrationId: sig.registrationId,
      relationship: sig.relationship,
      signedAt: sig.signedAt.toISOString(),
      valid: !sig.revokedAt && sig.contentHash === hash,
      revokedAt: sig.revokedAt?.toISOString() ?? null,
    })),
    missingSignatureLabels: doc.status === "PENDING_SIGNATURE" ? missingSignatures(definition, doc.signatures, hash).map((r) => r.label) : [],
    events: doc.events.map((e) => ({ action: e.action, note: e.note, createdAt: e.createdAt.toISOString(), actorId: e.actorId })),
  };
}

/** Signer identity captured at signing time: professional title and registration number. */
export async function signerProfile(userId: string, facilityId: string): Promise<{ title: string | null; registrationId: string | null }> {
  const staff = await prisma.facilityStaff.findFirst({
    where: { userId, facilityId },
    select: { professionalTitle: true, specialty: true, facilityRole: true, credentials: { where: { verificationStatus: "VERIFIED" }, orderBy: { createdAt: "desc" }, take: 1, select: { number: true } } },
  });
  if (!staff) return { title: null, registrationId: null };
  const title = [staff.professionalTitle || FACILITY_ROLE_LABEL[staff.facilityRole], staff.specialty].filter(Boolean).join(", ");
  return { title, registrationId: staff.credentials[0]?.number ?? null };
}

export function displayValue(value: DocumentContent[string] | undefined, unit?: string): string {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.every((v) => typeof v === "string") ? (value as string[]).join(", ") : "";
  return unit ? `${value} ${unit}` : String(value);
}
