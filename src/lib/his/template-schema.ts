import { z } from "zod";

/**
 * Clinical document template definitions: sections, fields, signature rules,
 * workflow and output settings. Stored as JSON on each template version and
 * validated here on every write — the UI is never trusted.
 */

export const FIELD_TYPES = [
  "text", "textarea", "number", "date", "datetime", "select", "multiselect",
  "checkbox", "table", "signature", "image", "attachment",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const SIGNATURE_ROLES = [
  "AUTHOR", "CO_SIGNER", "REVIEWER", "VERIFIER", "DEPARTMENT_HEAD", "PATIENT",
  "AUTHORIZED_REPRESENTATIVE", "CLINICIAN_OBTAINING_CONSENT", "WITNESS", "INTERPRETER",
] as const;
export type SignatureRoleValue = (typeof SIGNATURE_ROLES)[number];

/** Roles whose signatures are wet-ink signatures attested by staff (they have no staff account). */
export const ATTESTED_ROLES: readonly SignatureRoleValue[] = ["PATIENT", "AUTHORIZED_REPRESENTATIVE", "WITNESS", "INTERPRETER"];

const id = z.string().trim().regex(/^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/, "Ids use letters, digits, - and _ (max 60)");
const label = z.string().trim().min(1).max(200);
const translations = z.record(z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/), z.string().max(200)).optional();

export const fieldSchema = z.object({
  id,
  label,
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  /** Legally/clinically required by the source template: cannot be removed or made optional. */
  locked: z.boolean().optional(),
  helpText: z.string().max(500).optional(),
  options: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
  columns: z.array(z.string().trim().min(1).max(60)).max(12).optional(),
  unit: z.string().max(30).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().min(1).max(20000).optional(),
  defaultValue: z.union([z.string().max(2000), z.number(), z.boolean()]).optional(),
  translations,
});
export type TemplateField = z.infer<typeof fieldSchema>;

export const sectionSchema = z.object({
  id,
  title: label,
  description: z.string().max(1000).optional(),
  /** Show the section only when another field has a given value (simple branching). */
  condition: z.object({ fieldId: id, equals: z.union([z.string(), z.boolean()]) }).optional(),
  fields: z.array(fieldSchema).max(80),
  translations,
});
export type TemplateSection = z.infer<typeof sectionSchema>;

export const signatureRuleSchema = z.object({
  role: z.enum(SIGNATURE_ROLES),
  /** Satisfied by a signature in any of these roles (e.g. patient OR authorized representative). */
  anyOf: z.array(z.enum(SIGNATURE_ROLES)).max(4).optional(),
  label: label,
  required: z.boolean().default(true),
  locked: z.boolean().optional(),
});
export type SignatureRule = z.infer<typeof signatureRuleSchema>;

export const templateDefinitionSchema = z
  .object({
    sections: z.array(sectionSchema).min(1).max(60),
    signatures: z.array(signatureRuleSchema).max(12).default([]),
    workflow: z
      .object({
        requiresReview: z.boolean().default(false),
        /** Reviewer must be someone other than the author. */
        independentReview: z.boolean().default(true),
      })
      .default({ requiresReview: false, independentReview: true }),
    sensitivity: z.enum(["STANDARD", "RESTRICTED", "SPECIALLY_PROTECTED"]).default("STANDARD"),
    /** Facility roles allowed to create documents of this type (empty = anyone with AUTHOR_DOCUMENTS). */
    authorRoles: z.array(z.string().max(40)).max(30).default([]),
    output: z
      .object({
        pageSize: z.enum(["A4", "LETTER", "A5"]).default("A4"),
        footerNote: z.string().max(300).optional(),
      })
      .default({ pageSize: "A4" }),
    /** Shown to editors and authors, e.g. "Specialty template — clinical review required". */
    notice: z.string().max(500).optional(),
  })
  .superRefine((def, ctx) => {
    const ids = new Set<string>();
    def.sections.forEach((section, si) => {
      section.fields.forEach((field, fi) => {
        if (ids.has(field.id)) {
          ctx.addIssue({ code: "custom", path: ["sections", si, "fields", fi, "id"], message: `Duplicate field id "${field.id}"` });
        }
        ids.add(field.id);
        if ((field.type === "select" || field.type === "multiselect") && !field.options?.length) {
          ctx.addIssue({ code: "custom", path: ["sections", si, "fields", fi, "options"], message: `"${field.label}" needs at least one option` });
        }
        if (field.type === "table" && !field.columns?.length) {
          ctx.addIssue({ code: "custom", path: ["sections", si, "fields", fi, "columns"], message: `"${field.label}" needs table columns` });
        }
      });
    });
    def.sections.forEach((section, si) => {
      if (section.condition && !ids.has(section.condition.fieldId)) {
        ctx.addIssue({ code: "custom", path: ["sections", si, "condition"], message: `Condition refers to unknown field "${section.condition.fieldId}"` });
      }
    });
  });
export type TemplateDefinition = z.infer<typeof templateDefinitionSchema>;

export function parseDefinition(value: unknown): TemplateDefinition {
  return templateDefinitionSchema.parse(value);
}

function allFields(def: TemplateDefinition): Map<string, TemplateField> {
  const map = new Map<string, TemplateField>();
  for (const s of def.sections) for (const f of s.fields) map.set(f.id, f);
  return map;
}

/**
 * Hospitals may customize workflow and presentation but must not silently
 * remove legally required content. Every locked field and signature rule in
 * the source definition must survive (same type, still required).
 */
export function lockedViolations(source: TemplateDefinition, next: TemplateDefinition): string[] {
  const problems: string[] = [];
  const nextFields = allFields(next);
  for (const [fid, field] of allFields(source)) {
    if (!field.locked) continue;
    const kept = nextFields.get(fid);
    if (!kept) problems.push(`Required field "${field.label}" cannot be removed`);
    else if (kept.type !== field.type) problems.push(`Required field "${field.label}" cannot change type`);
    else if (field.required && !kept.required) problems.push(`Required field "${field.label}" cannot be made optional`);
  }
  for (const rule of source.signatures) {
    if (!rule.locked) continue;
    const kept = next.signatures.find((r) => r.role === rule.role);
    if (!kept || (rule.required && !kept.required)) problems.push(`Signature "${rule.label}" is mandatory and cannot be removed`);
  }
  if (source.workflow.requiresReview && !next.workflow.requiresReview && source.signatures.some((r) => r.locked)) {
    problems.push("Mandatory review cannot be switched off for this document type");
  }
  return problems;
}

/** Ensure every field carries the locked flag from the source (clients cannot drop it). */
export function carryLocks(source: TemplateDefinition | null, next: TemplateDefinition): TemplateDefinition {
  if (!source) return next;
  const lockedIds = new Set<string>();
  for (const s of source.sections) for (const f of s.fields) if (f.locked) lockedIds.add(f.id);
  const lockedRoles = new Set(source.signatures.filter((r) => r.locked).map((r) => r.role));
  return {
    ...next,
    sections: next.sections.map((s) => ({ ...s, fields: s.fields.map((f) => (lockedIds.has(f.id) ? { ...f, locked: true } : f)) })),
    signatures: next.signatures.map((r) => (lockedRoles.has(r.role) ? { ...r, locked: true } : r)),
  };
}

export type ContentValue = string | number | boolean | string[] | string[][] | null;
export type DocumentContent = Record<string, ContentValue>;

export function sectionVisible(section: TemplateSection, content: DocumentContent): boolean {
  if (!section.condition) return true;
  return content[section.condition.fieldId] === section.condition.equals;
}

/**
 * Validate document content against the template. Draft saves only check
 * shapes; submission (`complete`) also enforces required fields of visible
 * sections. Unknown keys are dropped.
 */
export function validateContent(
  def: TemplateDefinition,
  raw: Record<string, unknown>,
  options: { complete: boolean },
): { content: DocumentContent; errors: string[] } {
  const content: DocumentContent = {};
  const errors: string[] = [];
  for (const section of def.sections) {
    for (const field of section.fields) {
      const value = raw[field.id];
      if (value === undefined || value === null || value === "") continue;
      const bad = () => errors.push(`"${field.label}" has an invalid value`);
      switch (field.type) {
        case "number": {
          const n = typeof value === "number" ? value : Number(value);
          if (!Number.isFinite(n)) { bad(); break; }
          if (field.min !== undefined && n < field.min) errors.push(`"${field.label}" must be at least ${field.min}`);
          if (field.max !== undefined && n > field.max) errors.push(`"${field.label}" must be at most ${field.max}`);
          content[field.id] = n;
          break;
        }
        case "checkbox":
          if (typeof value !== "boolean") bad(); else content[field.id] = value;
          break;
        case "multiselect":
          if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !field.options?.includes(v))) bad();
          else content[field.id] = value as string[];
          break;
        case "table":
          if (!Array.isArray(value) || value.length > 200 || value.some((row) => !Array.isArray(row) || row.some((c) => typeof c !== "string" || c.length > 2000))) bad();
          else content[field.id] = value as string[][];
          break;
        case "select":
          if (typeof value !== "string" || !field.options?.includes(value)) bad(); else content[field.id] = value;
          break;
        case "date":
        case "datetime":
          if (typeof value !== "string" || Number.isNaN(Date.parse(value))) bad(); else content[field.id] = value;
          break;
        default: {
          if (typeof value !== "string") { bad(); break; }
          const max = field.maxLength ?? (field.type === "textarea" ? 20000 : 2000);
          if (value.length > max) errors.push(`"${field.label}" is longer than ${max} characters`);
          else content[field.id] = value;
        }
      }
    }
  }
  if (options.complete) {
    for (const section of def.sections) {
      if (!sectionVisible(section, content)) continue;
      for (const field of section.fields) {
        if (!field.required || field.type === "signature") continue;
        const v = content[field.id];
        const empty = v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0) || (field.type === "checkbox" && v !== true);
        if (empty) errors.push(`"${field.label}" is required`);
      }
    }
  }
  return { content, errors };
}

/** Deterministic JSON (sorted keys) so content hashes are stable. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}
