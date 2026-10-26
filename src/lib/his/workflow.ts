import { createHash } from "node:crypto";
import type { ClinicalDocumentStatus, SignatureMethod, SignatureRole } from "@prisma/client";
import { ATTESTED_ROLES, canonicalJson, type SignatureRule, type TemplateDefinition } from "./template-schema";
import type { FacilityPermission } from "@/lib/facility-staff";

/**
 * Clinical document workflow (pure rules; routes apply them inside
 * transactions). Finalized documents are never edited: corrections create an
 * amendment linked to the original.
 */

export type DocumentAction = "save" | "submit" | "review" | "return" | "sign" | "finalize" | "amend" | "release" | "void";

export const STATUS_LABEL: Record<ClinicalDocumentStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  PENDING_SIGNATURE: "Awaiting signature",
  FINAL: "Final",
  AMENDED: "Amended (superseded)",
  ENTERED_IN_ERROR: "Entered in error",
};

const ALLOWED: Record<DocumentAction, readonly ClinicalDocumentStatus[]> = {
  save: ["DRAFT"],
  submit: ["DRAFT"],
  review: ["PENDING_REVIEW"],
  return: ["PENDING_REVIEW", "PENDING_SIGNATURE"],
  sign: ["PENDING_SIGNATURE"],
  finalize: ["PENDING_SIGNATURE"],
  amend: ["FINAL"],
  release: ["FINAL"],
  void: ["DRAFT", "PENDING_REVIEW", "PENDING_SIGNATURE", "FINAL"],
};

export function canPerform(action: DocumentAction, status: ClinicalDocumentStatus): boolean {
  return ALLOWED[action].includes(status);
}

export function statusAfterSubmit(def: TemplateDefinition): ClinicalDocumentStatus {
  return def.workflow.requiresReview ? "PENDING_REVIEW" : "PENDING_SIGNATURE";
}

export function contentHash(content: unknown): string {
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export interface SignatureLike {
  role: SignatureRole;
  contentHash: string;
  revokedAt: Date | null;
}

/** Which required signature rules are still unmet for the current content. */
export function missingSignatures(def: TemplateDefinition, signatures: SignatureLike[], hash: string): SignatureRule[] {
  const valid = signatures.filter((s) => !s.revokedAt && s.contentHash === hash);
  return def.signatures.filter((rule) => {
    if (!rule.required) return false;
    const roles = rule.anyOf?.length ? rule.anyOf : [rule.role];
    return !valid.some((s) => roles.includes(s.role));
  });
}

/** Permission a staff member needs to sign in a given role, and how. */
export function signingRequirement(role: SignatureRole): { method: SignatureMethod; permission: FacilityPermission } {
  if ((ATTESTED_ROLES as readonly string[]).includes(role)) return { method: "HANDWRITTEN_ATTESTED", permission: "SIGN_DOCUMENTS" };
  if (role === "DEPARTMENT_HEAD") return { method: "AUTHENTICATED_ELECTRONIC", permission: "APPROVE_DOCUMENTS" };
  if (role === "VERIFIER" || role === "REVIEWER") return { method: "AUTHENTICATED_ELECTRONIC", permission: "REVIEW_DOCUMENTS" };
  return { method: "AUTHENTICATED_ELECTRONIC", permission: "SIGN_DOCUMENTS" };
}

/** Roles the template actually asks for (including anyOf alternatives). */
export function templateSignatureRoles(def: TemplateDefinition): SignatureRole[] {
  const roles = new Set<SignatureRole>();
  for (const r of def.signatures) {
    roles.add(r.role);
    for (const alt of r.anyOf ?? []) roles.add(alt);
  }
  return [...roles];
}

/** Patients see only finalized documents that were explicitly released. */
export function visibleToPatient(doc: { status: ClinicalDocumentStatus; releasedToPatientAt: Date | null }): boolean {
  return Boolean(doc.releasedToPatientAt) && (doc.status === "FINAL" || doc.status === "AMENDED");
}

/** Watermark text for anything that is not a completed record. */
export function watermarkFor(status: ClinicalDocumentStatus): string | null {
  switch (status) {
    case "DRAFT": return "DRAFT — NOT A VALID CLINICAL RECORD";
    case "PENDING_REVIEW": return "PRELIMINARY — AWAITING REVIEW";
    case "PENDING_SIGNATURE": return "PRELIMINARY — NOT YET SIGNED";
    case "AMENDED": return "SUPERSEDED BY AMENDMENT";
    case "ENTERED_IN_ERROR": return "ENTERED IN ERROR — DO NOT USE";
    default: return null;
  }
}
