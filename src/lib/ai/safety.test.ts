import { describe, expect, it } from "vitest";
import { checkDoctorView, checkPatientView, preLlmCheck, safePatientView } from "./safety";

describe("patient-facing safety filter", () => {
  it.each([
    ["a diagnosis", "You have diabetes."],
    ["a dosage", "Take 500 mg of metformin."],
    ["emergency advice", "Go to the hospital immediately."],
    ["dismissing care", "There is no need to visit the hospital."],
  ])("blocks %s", (_label, text) => {
    expect(checkPatientView({ body: [text] }).length).toBeGreaterThan(0);
  });

  it("lets neutral wording through", () => {
    expect(checkPatientView({ body: ["Some values are slightly outside the usual range. Please talk to your doctor."] })).toHaveLength(0);
  });

  it("checks every string in a nested view", () => {
    expect(checkPatientView({ a: { b: ["fine", { c: "You are suffering from malaria" }] } }).length).toBeGreaterThan(0);
  });

  it("falls back to English for unsupported languages", () => {
    expect(safePatientView("zz").body[0]).toMatch(/qualified clinician/);
    expect(safePatientView("fr").body[0]).toMatch(/^Seul/);
  });
});

describe("doctor-facing safety filter", () => {
  it("allows clinical suggestions", () => {
    expect(checkDoctorView({ summary: ["Consider iron studies."] })).toHaveLength(0);
  });
  it("flags dosage wording", () => {
    expect(checkDoctorView({ summary: ["Prescribe amoxicillin: 500 mg"] }).length).toBeGreaterThan(0);
  });
});

describe("pre-model input check", () => {
  it("blocks negative and implausible values", () => {
    expect(preLlmCheck([{ code: "GLU", name: "Glucose", value: -1 }]).blocked).toBe(true);
    expect(preLlmCheck([{ code: "WBC", name: "WBC", value: 20000 }]).blocked).toBe(true);
    expect(preLlmCheck([{ code: "WBC", name: "WBC", value: 7 }]).blocked).toBe(false);
  });
});
