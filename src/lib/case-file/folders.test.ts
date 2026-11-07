import { describe, expect, it } from "vitest";
import {
  CASE_FILE_FOLDERS,
  classifyCaseFileDocument,
  folderTitle,
} from "./folders";

describe("case-file folders", () => {
  it("defines the twelve folders from the case-file reference in order", () => {
    expect(CASE_FILE_FOLDERS).toHaveLength(12);
    expect(CASE_FILE_FOLDERS.map((f) => f.key)).toEqual([
      "assessments", "summaries", "oncology", "surgical", "consent",
      "laboratory", "radiology", "transfusion", "admissions", "safety",
      "mortality", "other",
    ]);
  });

  it("classifies documents by pattern before catalogue group", () => {
    // A blood-transfusion consent is a transfusion record, not a consent record.
    expect(classifyCaseFileDocument("F", "Blood and blood product transfusion consent")).toBe("transfusion");
    expect(classifyCaseFileDocument("C", "Death notification and associated records")).toBe("mortality");
    expect(classifyCaseFileDocument("P", "Death certificate workflow")).toBe("mortality");
    expect(classifyCaseFileDocument("N", "Oncology and hematology pack")).toBe("oncology");
  });

  it("classifies documents by catalogue group", () => {
    expect(classifyCaseFileDocument("B", "Initial physician consultation")).toBe("assessments");
    expect(classifyCaseFileDocument("O", "Final discharge summary")).toBe("summaries");
    expect(classifyCaseFileDocument("E", "Operative report")).toBe("surgical");
    expect(classifyCaseFileDocument("F", "General consent to examination and treatment")).toBe("consent");
    expect(classifyCaseFileDocument("G", "Hematology report")).toBe("laboratory");
    expect(classifyCaseFileDocument("H", "MRI report")).toBe("radiology");
    expect(classifyCaseFileDocument("I", "Resting ECG report")).toBe("radiology");
    expect(classifyCaseFileDocument("J", "Gastroscopy report")).toBe("radiology");
    expect(classifyCaseFileDocument("L", "Incident and adverse event report")).toBe("safety");
    expect(classifyCaseFileDocument("D", "Inpatient admission record")).toBe("admissions");
    expect(classifyCaseFileDocument("A", "Referral and transfer documentation")).toBe("admissions");
    expect(classifyCaseFileDocument("K", "Medication prescription")).toBe("other");
    expect(classifyCaseFileDocument("M", "Physiotherapy assessment")).toBe("other");
    expect(classifyCaseFileDocument("A", "Patient complaints and feedback record")).toBe("other");
  });

  it("falls back safely for unknown or missing groups", () => {
    expect(classifyCaseFileDocument("Z", "Anything else")).toBe("other");
    expect(classifyCaseFileDocument(null, "Custom hospital document")).toBe("other");
    expect(classifyCaseFileDocument("", "")).toBe("other");
  });

  it("resolves a display title for every key", () => {
    expect(folderTitle("laboratory")).toBe("Laboratory requests");
    expect(folderTitle("mortality")).toBe("Mortality records");
  });
});
