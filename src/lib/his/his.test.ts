import { describe, expect, it } from "vitest";
import { catalogue, catalogueEntry, groupAllowedForKind } from "./catalogue";
import { canonicalJson, lockedViolations, parseDefinition, validateContent, carryLocks } from "./template-schema";
import { canPerform, contentHash, missingSignatures, statusAfterSubmit, visibleToPatient, watermarkFor, signingRequirement } from "./workflow";
import { resolveFormat, formatByKey, looksLikeText } from "./media-formats";
import { canTransition, initialStatus, isOverdue, sortQueue } from "./encounters";
import { maskIdentifier } from "./access";
import { formatNumber } from "./numbering";

const consent = catalogueEntry(catalogue().find((e) => e.groupCode === "F")!.code)!;

describe("system catalogue", () => {
  it("covers groups A–P with valid definitions and unique codes", () => {
    const all = catalogue();
    expect(new Set(all.map((e) => e.groupCode))).toEqual(new Set("ABCDEFGHIJKLMNOP".split("")));
    expect(new Set(all.map((e) => e.code)).size).toBe(all.length);
    for (const e of all) expect(() => parseDefinition(e.definition)).not.toThrow();
  });
  it("restricts groups by organization type", () => {
    expect(groupAllowedForKind("G", "LABORATORY")).toBe(true);
    expect(groupAllowedForKind("D", "LABORATORY")).toBe(false);
    expect(groupAllowedForKind("H", "DIAGNOSTIC_CENTRE")).toBe(true);
    expect(groupAllowedForKind("CUSTOM", "LABORATORY")).toBe(true);
  });
  it("consent templates require the actual signatories and disclosure fields", () => {
    expect(consent.definition.signatures.filter((s) => s.required).map((s) => s.role)).toEqual(["PATIENT", "CLINICIAN_OBTAINING_CONSENT"]);
    const ids = consent.definition.sections.flatMap((s) => s.fields.map((f) => f.id));
    expect(ids).toEqual(expect.arrayContaining(["benefits", "risks", "alternatives", "formVersionNote"]));
  });
});

describe("template customization", () => {
  it("refuses removing locked fields or mandatory signatures", () => {
    const src = consent.definition;
    const removed = { ...src, sections: src.sections.map((s) => ({ ...s, fields: s.fields.filter((f) => f.id !== "risks") })), signatures: src.signatures.filter((r) => r.role !== "PATIENT") };
    const problems = lockedViolations(src, parseDefinition(removed));
    expect(problems.join(" ")).toMatch(/Material risks/);
    expect(problems.join(" ")).toMatch(/Patient or authorized representative/);
  });
  it("allows renaming and adding optional fields, and re-applies locks", () => {
    const src = consent.definition;
    const edited = parseDefinition({ ...src, sections: [...src.sections.map((s) => ({ ...s, title: `${s.title}!`, fields: s.fields.map((f) => ({ ...f, locked: undefined })) })), { id: "extra", title: "Extra", fields: [{ id: "note", label: "Note", type: "text", required: false }] }] });
    const withLocks = carryLocks(src, edited);
    expect(lockedViolations(src, withLocks)).toEqual([]);
    expect(withLocks.sections[1].fields.find((f) => f.id === "risks")?.locked).toBe(true);
  });
  it("rejects duplicate ids and selects without options", () => {
    expect(() => parseDefinition({ sections: [{ id: "a", title: "A", fields: [{ id: "x", label: "X", type: "text" }, { id: "x", label: "Y", type: "text" }] }] })).toThrow();
    expect(() => parseDefinition({ sections: [{ id: "a", title: "A", fields: [{ id: "x", label: "X", type: "select" }] }] })).toThrow();
  });
});

describe("document content and workflow", () => {
  const def = parseDefinition({
    sections: [
      { id: "a", title: "A", fields: [{ id: "flag", label: "Flag", type: "checkbox" }, { id: "n", label: "N", type: "number", min: 0, max: 10, required: true }] },
      { id: "b", title: "B", condition: { fieldId: "flag", equals: true }, fields: [{ id: "detail", label: "Detail", type: "text", required: true }] },
    ],
    signatures: [{ role: "AUTHOR", label: "Author", required: true }, { role: "PATIENT", anyOf: ["PATIENT", "AUTHORIZED_REPRESENTATIVE"], label: "Patient/rep", required: true }],
    workflow: { requiresReview: true, independentReview: true },
  });
  it("enforces required fields only for visible sections and validates ranges", () => {
    expect(validateContent(def, { n: 5 }, { complete: true }).errors).toEqual([]);
    expect(validateContent(def, { n: 5, flag: true }, { complete: true }).errors).toEqual(['"Detail" is required']);
    expect(validateContent(def, { n: 50 }, { complete: false }).errors[0]).toMatch(/at most 10/);
    expect(validateContent(def, { unknown: "x", n: 1 }, { complete: false }).content).toEqual({ n: 1 });
  });
  it("hashes content deterministically and binds signatures to it", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
    const h = contentHash({ n: 1 });
    const sigs = [{ role: "AUTHOR" as const, contentHash: h, revokedAt: null }, { role: "AUTHORIZED_REPRESENTATIVE" as const, contentHash: h, revokedAt: null }];
    expect(missingSignatures(def, sigs, h)).toEqual([]);
    expect(missingSignatures(def, sigs, contentHash({ n: 2 })).length).toBe(2);
    expect(missingSignatures(def, [{ ...sigs[0], revokedAt: new Date() }, sigs[1]], h).map((r) => r.role)).toEqual(["AUTHOR"]);
  });
  it("never edits finalized documents and only shows released final ones to patients", () => {
    expect(canPerform("save", "FINAL")).toBe(false);
    expect(canPerform("amend", "FINAL")).toBe(true);
    expect(canPerform("amend", "DRAFT")).toBe(false);
    expect(statusAfterSubmit(def)).toBe("PENDING_REVIEW");
    expect(visibleToPatient({ status: "PENDING_SIGNATURE", releasedToPatientAt: new Date() })).toBe(false);
    expect(visibleToPatient({ status: "FINAL", releasedToPatientAt: null })).toBe(false);
    expect(visibleToPatient({ status: "FINAL", releasedToPatientAt: new Date() })).toBe(true);
    expect(watermarkFor("DRAFT")).toMatch(/DRAFT/);
    expect(watermarkFor("FINAL")).toBeNull();
  });
  it("patient signatures are attested handwritten; department head needs approval permission", () => {
    expect(signingRequirement("PATIENT").method).toBe("HANDWRITTEN_ATTESTED");
    expect(signingRequirement("DEPARTMENT_HEAD").permission).toBe("APPROVE_DOCUMENTS");
    expect(signingRequirement("AUTHOR").method).toBe("AUTHENTICATED_ELECTRONIC");
  });
});

describe("media format registry", () => {
  it("requires extension, MIME type and signature to agree", () => {
    expect("format" in resolveFormat("scan.dcm", "application/dicom")).toBe(true);
    expect(resolveFormat("scan.zip", "application/zip")).toEqual({ error: ".zip files are not permitted" });
    expect("error" in resolveFormat("photo.png", "application/pdf")).toBe(true);
    expect("error" in resolveFormat("noext", "image/png")).toBe(true);
    const dicom = new Uint8Array(132); dicom.set([0x44, 0x49, 0x43, 0x4d], 128);
    expect(formatByKey("dicom")!.check(dicom)).toBe(true);
    expect(formatByKey("png")!.check(new TextEncoder().encode("%PDF-1.7"))).toBe(false);
    expect(formatByKey("hl7v2")!.check(new TextEncoder().encode("MSH|^~\\&|LAB"))).toBe(true);
    expect(formatByKey("fhir-json")!.check(new TextEncoder().encode('{"resourceType":"Observation"}'))).toBe(true);
    expect(looksLikeText(new Uint8Array([0x41, 0x00, 0x42]))).toBe(false);
  });
});

describe("encounters", () => {
  it("separates priority from type and guards transitions", () => {
    expect(initialStatus("EMERGENCY_DEPARTMENT")).toBe("AWAITING_TRIAGE");
    expect(initialStatus("SCHEDULED_OUTPATIENT")).toBe("REGISTERED");
    expect(canTransition("DISCHARGED", "ADMITTED")).toBe(false);
    expect(canTransition("UNDER_ASSESSMENT", "TRIAGED")).toBe(false);
    expect(canTransition("AWAITING_TRIAGE", "TRIAGED")).toBe(true);
  });
  it("sorts queues by priority then arrival and flags overdue", () => {
    const t = (m: number) => new Date(Date.UTC(2026, 0, 1, 0, m));
    const sorted = sortQueue([{ priority: "ROUTINE" as const, registeredAt: t(0) }, { priority: "EMERGENCY" as const, registeredAt: t(5) }, { priority: "ROUTINE" as const, registeredAt: t(1) }]);
    expect(sorted.map((r) => r.priority)).toEqual(["EMERGENCY", "ROUTINE", "ROUTINE"]);
    expect(isOverdue(t(0), "AWAITING_CLINICIAN", 30, t(31))).toBe(true);
    expect(isOverdue(t(0), "DISCHARGED", 30, t(300))).toBe(false);
  });
});

describe("helpers", () => {
  it("masks member numbers and formats document numbers", () => {
    expect(maskIdentifier("ABC123456")).toBe("•••••3456");
    expect(formatNumber("hosp-1", 2026, 42)).toBe("HOSP1-2026-000042");
  });
});
