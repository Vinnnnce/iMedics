import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("@/lib/prisma", () => ({ prisma: { medicalMedia: { findMany: vi.fn() } } }));
vi.mock("@/lib/storage", () => ({
  copyObject: vi.fn(), deleteObject: vi.fn(), getObjectStream: vi.fn(), inspectObject: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { copyObject, deleteObject, getObjectStream, inspectObject } from "@/lib/storage";
import { validateAttachments } from "./attachments";
import { assertDocumentReadable, documentVisibility, mediaVisibility } from "./visibility";
import { scanObject, finalizeMedia } from "./media-storage";
import { formatByKey } from "./media-formats";
import { lockedViolations, parseDefinition, validateContent } from "./template-schema";

const FILE = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const definition = parseDefinition({ sections: [{ id: "files", title: "Files", fields: [
  { id: "report", label: "Report", type: "attachment", required: true },
] }] });
const context = { facilityId: "facility", patientId: "patient", sensitivity: "STANDARD", canReview: false };

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("protected metadata and records", () => {
  it("filters protected records before pagination and preserves author access", () => {
    expect(documentVisibility("author", false)).toEqual({ OR: [{ sensitivity: { not: "SPECIALLY_PROTECTED" } }, { authorId: "author" }] });
    expect(documentVisibility("reviewer", true)).toEqual({});
    expect(mediaVisibility(false)).toEqual({ sensitivity: { not: "SPECIALLY_PROTECTED" } });
    expect(mediaVisibility(true)).toEqual({});
  });
  it("requires author or reviewer access for actions and package export", () => {
    const doc = { sensitivity: "SPECIALLY_PROTECTED", authorId: "author" };
    expect(() => assertDocumentReadable(doc, "records-officer", false)).toThrow(/specially protected/);
    expect(() => assertDocumentReadable(doc, "author", false)).not.toThrow();
    expect(() => assertDocumentReadable(doc, "reviewer", true)).not.toThrow();
  });
});

describe("patient-linked attachment fields", () => {
  it("requires a UUID and a nonempty required attachment", () => {
    expect(validateContent(definition, { report: "https://public.example/report.pdf" }, { complete: true }).errors.length).toBeGreaterThan(0);
    expect(validateContent(definition, {}, { complete: true }).errors).toContain('"Report" is required');
    expect(validateContent(definition, { report: FILE }, { complete: true }).errors).toEqual([]);
  });
  it("accepts a compatible file scoped to this hospital and patient", async () => {
    vi.mocked(prisma.medicalMedia.findMany).mockResolvedValue([{ id: FILE, mimeType: "application/pdf", sensitivity: "STANDARD" }] as never);
    await expect(validateAttachments(definition, { report: FILE }, context)).resolves.toBeUndefined();
    expect(prisma.medicalMedia.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: { in: [FILE] }, facilityId: "facility", patientId: "patient", deletedAt: null, scanStatus: { not: "INFECTED" } }),
    }));
  });
  it("rejects missing, cross-patient, deleted and unauthorized media uniformly", async () => {
    vi.mocked(prisma.medicalMedia.findMany).mockResolvedValue([]);
    await expect(validateAttachments(definition, { report: FILE }, context)).rejects.toThrow(/available file of this patient/);
  });
  it("does not downgrade sensitivity or accept a PDF as an image", async () => {
    vi.mocked(prisma.medicalMedia.findMany).mockResolvedValue([{ id: FILE, mimeType: "application/pdf", sensitivity: "RESTRICTED" }] as never);
    await expect(validateAttachments(definition, { report: FILE }, context)).rejects.toThrow(/compatible type and sensitivity/);
    const image = parseDefinition({ sections: [{ id: "s", title: "S", fields: [{ id: "report", label: "Image", type: "image" }] }] });
    await expect(validateAttachments(image, { report: FILE }, { ...context, sensitivity: "RESTRICTED" })).rejects.toThrow(/compatible type and sensitivity/);
  });
});

describe("locked templates and content validation", () => {
  const source = parseDefinition({
    sections: [{ id: "s", title: "S", fields: [
      { id: "flag", label: "Flag", type: "checkbox" },
      { id: "required", label: "Required", type: "number", required: true, locked: true, min: 1, max: 10 },
    ] }],
    signatures: [{ role: "PATIENT", label: "Patient", required: true, locked: true }],
    workflow: { requiresReview: true, independentReview: true },
  });
  it("rejects hiding a locked field or broadening a mandatory signature", () => {
    const next = parseDefinition({ ...source, sections: source.sections.map((s) => ({ ...s, condition: { fieldId: "flag", equals: true } })),
      signatures: [{ ...source.signatures[0], anyOf: ["PATIENT", "AUTHOR"] }] });
    expect(lockedViolations(source, next).join(" ")).toMatch(/visibility cannot be changed/);
    expect(lockedViolations(source, next).join(" ")).toMatch(/weaker alternatives/);
  });
  it("rejects weakening numeric constraints and independent review", () => {
    const next = parseDefinition({ ...source, sections: source.sections.map((s) => ({ ...s, fields: s.fields.map((f) => ({ ...f, min: undefined, max: undefined })) })),
      workflow: { requiresReview: true, independentReview: false } });
    expect(lockedViolations(source, next).join(" ")).toMatch(/validation cannot be weakened/);
    expect(lockedViolations(source, next).join(" ")).toMatch(/independent review/);
  });
  it("rejects duplicate sections and inverted ranges", () => {
    expect(() => parseDefinition({ sections: [...source.sections, ...source.sections] })).toThrow();
    expect(() => parseDefinition({ sections: [{ id: "s", title: "S", fields: [{ id: "n", label: "N", type: "number", min: 10, max: 1 }] }] })).toThrow();
  });
  it("rejects whitespace, boolean numeric coercion, invalid dates and malformed table rows", () => {
    const def = parseDefinition({ sections: [{ id: "s", title: "S", fields: [
      { id: "text", label: "Text", type: "text", required: true },
      { id: "number", label: "Number", type: "number" },
      { id: "date", label: "Date", type: "date" },
      { id: "table", label: "Table", type: "table", columns: ["A", "B"], required: true },
    ] }] });
    const invalid = validateContent(def, { text: "  ", number: false, date: "2026-02-30", table: [["", " "]] }, { complete: true });
    expect(invalid.errors).toHaveLength(4);
    expect(validateContent(def, { table: [["too", "many", "columns"]] }, { complete: false }).errors).toHaveLength(1);
    expect(validateContent(def, { text: "Valid", number: "2.5", date: "2024-02-29", table: [["Result", "Normal"]] }, { complete: true }).errors).toEqual([]);
  });
});

describe("malware scanner fails closed", () => {
  const respond = (data: unknown, status = 200) => vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(data), { status })));
  it("never calls an unconfigured scanner or describes unchecked files as clean", async () => {
    vi.stubEnv("MALWARE_SCAN_URL", "");
    vi.stubGlobal("fetch", vi.fn());
    expect(await scanObject("private-key")).toBe("NOT_SCANNED");
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each(["CLEAN", "INFECTED"] as const)("accepts only explicit %s", async (result) => {
    vi.stubEnv("MALWARE_SCAN_URL", "https://scanner.example/scan");
    respond({ result });
    expect(await scanObject("private-key")).toBe(result);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });
  it.each([{}, { result: "PENDING" }, null, { result: "clean" }])("rejects ambiguous responses: %j", async (data) => {
    vi.stubEnv("MALWARE_SCAN_URL", "https://scanner.example/scan");
    respond(data);
    await expect(scanObject("private-key")).rejects.toThrow(/definitive result/);
  });
  it("rejects scanner outages", async () => {
    vi.stubEnv("MALWARE_SCAN_URL", "https://scanner.example/scan");
    respond({}, 503);
    await expect(scanObject("private-key")).rejects.toThrow(/unavailable/);
  });
  it("removes the final object when scanning fails after copy", async () => {
    vi.stubEnv("MALWARE_SCAN_URL", "https://scanner.example/scan");
    respond({ result: "PENDING" });
    const bytes = new TextEncoder().encode("%PDF-1.7\nsynthetic");
    vi.mocked(inspectObject).mockResolvedValue({ sizeBytes: bytes.length, head: bytes, etag: "etag" } as never);
    vi.mocked(getObjectStream).mockResolvedValue({ stream: new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } }) } as never);
    await expect(finalizeMedia("medical-media/staging/facility/patient/file", "facility", "patient", formatByKey("pdf")!, createHash("sha256").update(bytes).digest("hex"))).rejects.toThrow(/definitive result/);
    expect(copyObject).toHaveBeenCalled();
    expect(deleteObject).toHaveBeenCalledWith(expect.stringMatching(/^medical-media\/final\/facility\/patient\//));
  });
  it("rejects another tenant's staging key before storage access", async () => {
    await expect(finalizeMedia("medical-media/staging/other/patient/file", "facility", "patient", formatByKey("pdf")!, "a".repeat(64))).rejects.toThrow(/not uploaded for this patient/);
    expect(inspectObject).not.toHaveBeenCalled();
  });
});
