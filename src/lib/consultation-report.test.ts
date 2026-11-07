import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { renderConsultationPdf, snapshotConsultation } from "@/lib/consultation-report";
import type { ConsultationWithRelations } from "@/lib/consultation";

function consultation(overrides: Partial<Record<string, unknown>> = {}): ConsultationWithRelations {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    status: "FINALIZED",
    revision: 2,
    amendedAt: new Date("2026-10-20T10:00:00Z"),
    finalizedAt: new Date("2026-10-19T10:00:00Z"),
    createdAt: new Date("2026-10-19T09:00:00Z"),
    chiefComplaint: "Headache",
    historyPresentIllness: "Three days of throbbing pain",
    pastMedicalHistory: null,
    symptoms: [{ name: "Nausea", duration: "2 days", severity: "mild" }],
    vitals: { bloodPressure: "120/80", pulse: "" },
    examination: null,
    diagnosis: "Migraine",
    icd: { code: "G43.9", description: "Migraine, unspecified" },
    differentialDiagnosis: null,
    labFindings: null,
    imagingFindings: null,
    treatmentPlan: "Rest and fluids",
    recommendations: null,
    followUpDate: new Date("2026-11-01T00:00:00Z"),
    notes: null,
    patient: { firstName: "Ada", lastName: "Obi", caseNumber: "CN-0001", dateOfBirth: new Date("1990-05-05T00:00:00Z"), gender: "FEMALE" },
    doctor: { user: { name: "Dr. Eze" } },
    prescriptions: [{ items: [{ drugName: "Ibuprofen", dose: "400 mg", frequency: "twice daily", duration: "3 days", instructions: null }] }],
    ...overrides,
  } as unknown as ConsultationWithRelations;
}

describe("snapshotConsultation", () => {
  it("captures the clinical content and the revision it belongs to", () => {
    const snap = snapshotConsultation(consultation());
    expect(snap.revision).toBe(2);
    expect(snap.icd).toEqual({ code: "G43.9", description: "Migraine, unspecified" });
    expect(snap.followUpDate).toBe("2026-11-01T00:00:00.000Z");
    expect(snap.amendedAt).toBe("2026-10-20T10:00:00.000Z");
  });
  it("handles a report without a coded diagnosis", () => {
    expect(snapshotConsultation(consultation({ icd: null })).icd).toBeNull();
  });
});

describe("renderConsultationPdf", () => {
  it("produces a PDF for a finalized report", async () => {
    const bytes = await renderConsultationPdf(consultation());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(1000);
  });
  it("produces a PDF for a draft (watermarked)", async () => {
    const bytes = await renderConsultationPdf(consultation({ status: "DRAFT", finalizedAt: null, revision: 1, amendedAt: null }));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });
});
