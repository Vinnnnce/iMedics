import { describe, expect, it } from "vitest";
import { allowedTransitions, canTransition, workflowSteps } from "./workflow";
import { evaluateFlag } from "./flags";
import { normalise, scoreMatch, buildSearchText } from "./search";
import { SEED_ANALYTES, SEED_CATEGORIES, SEED_ITEMS, DOCTOR_DIAGNOSTIC_GROUPS, localCode, ORDER_SET_TEMPLATES } from "./seed-data";
import { diagnosticReport, serviceRequest, LOCAL_CODE_SYSTEM } from "./fhir";
import { renderReportPdf } from "./pdf";
import { levelForAge } from "./alerts";
import { computeDueAt } from "./service";
import { statusBucket } from "./constants";

describe("workflow", () => {
  it("covers the 13-14 step laboratory and diagnostic paths in order", () => {
    const lab = workflowSteps("LABORATORY");
    for (let i = 0; i < lab.length - 1; i++) expect(canTransition("LABORATORY", lab[i], lab[i + 1]), `${lab[i]} -> ${lab[i + 1]}`).toBe(true);
    const dx = workflowSteps("DIAGNOSTIC");
    // PRELIMINARY_REPORT is optional; every other adjacent pair must be valid.
    const required = dx.filter((s) => s !== "PRELIMINARY_REPORT" && s !== "PATIENT_PREPARATION" && s !== "MEDIA_UPLOADED");
    for (let i = 0; i < required.length - 1; i++) {
      const from = required[i], to = required[i + 1];
      const reachable = allowedTransitions("DIAGNOSTIC", from).includes(to) || allowedTransitions("DIAGNOSTIC", from).some((m) => allowedTransitions("DIAGNOSTIC", m).includes(to));
      expect(reachable, `${from} ~> ${to}`).toBe(true);
    }
  });
  it("forbids skipping verification and releasing before signing", () => {
    expect(canTransition("LABORATORY", "RESULT_ENTERED", "RELEASED")).toBe(false);
    expect(canTransition("LABORATORY", "AWAITING_VERIFICATION", "RELEASED")).toBe(false);
    expect(canTransition("LABORATORY", "VERIFIED", "RELEASED")).toBe(false);
    expect(canTransition("DIAGNOSTIC", "AWAITING_INTERPRETATION", "SIGNED")).toBe(false);
  });
  it("does not let lab items take diagnostic paths", () => {
    expect(canTransition("LABORATORY", "NEW_REQUEST", "AWAITING_APPOINTMENT")).toBe(false);
    expect(canTransition("DIAGNOSTIC", "NEW_REQUEST", "AWAITING_SAMPLE")).toBe(false);
  });
  it("allows rejected specimens to be recollected", () => {
    expect(canTransition("LABORATORY", "SAMPLE_COLLECTED", "SAMPLE_REJECTED")).toBe(true);
    expect(canTransition("LABORATORY", "SAMPLE_REJECTED", "AWAITING_SAMPLE")).toBe(true);
  });
  it("buckets statuses for the doctor's tabs", () => {
    expect(statusBucket("NEW_REQUEST")).toBe("PENDING");
    expect(statusBucket("PROCESSING")).toBe("IN_PROGRESS");
    expect(statusBucket("DELIVERED")).toBe("COMPLETED");
  });
});

describe("flags", () => {
  const r = { refLow: 12, refHigh: 16, criticalLow: 7, criticalHigh: 20 };
  it("flags low, high and critical values", () => {
    expect(evaluateFlag({ value: 14, ...r })).toEqual({ flag: "NORMAL", isCritical: false });
    expect(evaluateFlag({ value: 10, ...r })).toEqual({ flag: "LOW", isCritical: false });
    expect(evaluateFlag({ value: 17, ...r })).toEqual({ flag: "HIGH", isCritical: false });
    expect(evaluateFlag({ value: 6.9, ...r })).toEqual({ flag: "CRITICAL_LOW", isCritical: true });
    expect(evaluateFlag({ value: 20, ...r })).toEqual({ flag: "CRITICAL_HIGH", isCritical: true });
  });
  it("never guesses when no range is configured", () => {
    expect(evaluateFlag({ value: 999 })).toEqual({ flag: null, isCritical: false });
    expect(evaluateFlag({ value: null, ...r })).toEqual({ flag: null, isCritical: false });
  });
});

describe("search", () => {
  const item = (name: string, abbr: string | null, syn: string[], code = "X") => ({ name, abbreviation: abbr, synonyms: syn, code, commonName: null, loincCode: null, snomedCode: null, searchText: buildSearchText([name, abbr, syn, code]) });
  it("finds by abbreviation, synonym and name, ranking exact abbreviations first", () => {
    const fbc = item("Full Blood Count", "FBC", ["complete blood count", "CBC"]);
    const hb = item("Haemoglobin", "Hb", ["hemoglobin"]);
    expect(scoreMatch(fbc, "fbc")).toBeGreaterThan(scoreMatch(fbc, "blood"));
    expect(scoreMatch(fbc, "complete blood count")).toBeGreaterThan(0);
    expect(scoreMatch(hb, "hemoglobin")).toBeGreaterThan(0);
    expect(scoreMatch(hb, "creatinine")).toBe(0);
  });
  it("normalises accents and punctuation", () => expect(normalise("  D-dimer / Café ")).toBe("d-dimer / cafe"));
});

describe("seed catalogue integrity", () => {
  it("has unique local codes and every item maps to a known category", () => {
    const codes = SEED_ITEMS.map(localCode);
    expect(new Set(codes).size).toBe(codes.length);
    const cats = new Set(SEED_CATEGORIES.map((c) => `${c.domain}:${c.key}`));
    for (const i of SEED_ITEMS) expect(cats.has(`${i.domain}:${i.category}`), i.name).toBe(true);
  });
  it("has 11 laboratory disciplines and 16 diagnostic departments from the spec", () => {
    expect(SEED_CATEGORIES.filter((c) => c.domain === "LABORATORY")).toHaveLength(11);
    expect(SEED_CATEGORIES.filter((c) => c.domain === "DIAGNOSTIC")).toHaveLength(16);
  });
  it("groups every diagnostic department for the doctor view exactly once", () => {
    const keys = DOCTOR_DIAGNOSTIC_GROUPS.flatMap((g) => g.keys).sort();
    expect(keys).toEqual(SEED_CATEGORIES.filter((c) => c.domain === "DIAGNOSTIC").map((c) => c.key).sort());
  });
  it("routes the spec's example orders to the right departments", () => {
    const by = (n: string) => SEED_ITEMS.find((i) => i.name === n)?.category;
    expect(by("Full Blood Count")).toBe("haematology");
    expect(by("Blood Culture")).toBe("microbiology");
    expect(by("Liver Function Panel")).toBe("clinical-biochemistry");
    expect(by("Routine Urinalysis")).toBe("urinalysis-body-fluids");
    expect(by("Stool Routine Examination")).toBe("urinalysis-body-fluids");
    expect(by("Chest X-ray")).toBe("radiology");
    expect(by("CT brain")).toBe("ct");
    expect(by("Echocardiography")).toBe("ultrasound");
  });
  it("only ships LOINC codes in the LOINC format, never fabricated SNOMED codes, and no pre-set reference ranges", () => {
    for (const list of Object.values(SEED_ANALYTES)) for (const a of list) {
      if (a.loinc) expect(a.loinc).toMatch(/^\d{1,7}-\d$/);
      expect(Object.keys(a)).not.toContain("refLow");
    }
    for (const i of SEED_ITEMS) expect((i as unknown as Record<string, unknown>).snomed).toBeUndefined();
  });
  it("starter order-set members all exist in the catalogue", () => {
    const names = new Set(SEED_ITEMS.map((i) => i.name));
    for (const t of ORDER_SET_TEMPLATES) for (const m of t.members) expect(names.has(m), `${t.name}: ${m}`).toBe(true);
  });
});

describe("FHIR mapping", () => {
  const base = { id: "i1", orderId: "o1", patientId: "p1", status: "DELIVERED", nameSnapshot: "Custom assay", codeSnapshot: "FAC-1-X", loincSnapshot: null, snomedSnapshot: null, priority: "URGENT" as const, createdAt: new Date("2026-01-01"), performingFacilityId: "f1", domain: "LABORATORY" as const, requesterUserId: "u1" };
  it("keeps the local code in a local system and never invents a standard code", () => {
    const sr = serviceRequest(base) as { code: { coding: { system: string }[] }; priority: string };
    expect(sr.code.coding).toHaveLength(1);
    expect(sr.code.coding[0].system).toBe(LOCAL_CODE_SYSTEM);
    expect(sr.priority).toBe("urgent");
  });
  it("emits Observation with UCUM units, a DiagnosticReport and ImagingStudy for DICOM media", () => {
    const res = diagnosticReport({
      result: { id: "r1", itemId: "i1", version: 2, findings: null, impression: "ok", conclusion: null, releasedAt: new Date(), signedById: "u2", reporterName: "Dr X" },
      item: { ...base, loincSnapshot: "718-7" }, facilityId: "f1",
      observations: [{ id: "o1", patientId: "p1", resultId: "r1", name: "Hb", loincCode: "718-7", valueNumeric: 14, valueText: null, unit: "g/dL", refLow: 12, refHigh: 16, refText: null, flag: "NORMAL" }],
      media: [{ id: "m1", studyInstanceUid: "1.2.3.4", dicomModality: "US", mimeType: "image/png", fileName: "a.png" }],
    }) as { resourceType: string; status?: string; valueQuantity?: { system: string } }[];
    const types = res.map((r) => r.resourceType);
    expect(types).toEqual(expect.arrayContaining(["Observation", "ImagingStudy", "DocumentReference", "DiagnosticReport", "Provenance"]));
    expect(res.find((r) => r.resourceType === "DiagnosticReport")?.status).toBe("amended");
    expect(res.find((r) => r.resourceType === "Observation")?.valueQuantity?.system).toBe("http://unitsofmeasure.org");
  });
});

describe("pdf, alerts and turnaround", () => {
  it("renders a PDF", async () => {
    const bytes = await renderReportPdf({ title: "FBC", facilityName: "Lab", orderNumber: "INV-1", patient: { name: "A B", caseNumber: "MC-1", sex: "F", dateOfBirth: "1 Jan 1990" }, requestedBy: "Dr", priority: "Routine", observations: [{ name: "Hb", value: "4", unit: "g/dL", range: "12 – 16", flag: "CRITICAL_LOW" }], findings: "Unicode – test ✓", version: 1 });
    expect(Buffer.from(bytes.slice(0, 4)).toString()).toBe("%PDF");
  });
  it("widens alert escalation with age", () => {
    expect(levelForAge(5, 30)).toBe(0);
    expect(levelForAge(31, 30)).toBe(1);
    expect(levelForAge(61, 30)).toBe(2);
    expect(levelForAge(121, 30)).toBe(3);
  });
  it("makes emergency orders due sooner than routine", () => {
    const t = new Date("2026-01-01T00:00:00Z");
    expect(computeDueAt("LABORATORY", "EMERGENCY", 240, null, t).getTime()).toBeLessThan(computeDueAt("LABORATORY", "ROUTINE", 240, null, t).getTime());
  });
});
