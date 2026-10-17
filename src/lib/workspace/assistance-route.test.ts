import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({
  user: { id: "11111111-1111-4111-8111-111111111111", role: "DOCTOR", status: "ACTIVE", onboardingComplete: true, deletedAt: null },
  auth: vi.fn(), accessible: vi.fn(), verified: vi.fn(), rate: vi.fn(), audit: vi.fn(), patient: vi.fn(),
  history: vi.fn(), consultations: vi.fn(), results: vi.fn(), provider: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mocks.auth, requireRole: mocks.auth }));
vi.mock("@/lib/access", () => ({ findAccessiblePatient: mocks.accessible, getVerifiedDoctorProfile: mocks.verified }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  auditLog: { create: mocks.audit }, patient: { findFirst: mocks.patient }, medicalHistory: { findFirst: mocks.history },
  consultation: { findMany: mocks.consultations }, labResult: { findMany: mocks.results },
} }));
vi.mock("@/lib/ai/rate-limit", () => ({ enforceAiRateLimit: mocks.rate, AI_REQUEST_ACTION: "AI_ASSIST_REQUEST" }));
vi.mock("@/lib/ai/llm", () => ({ completeJson: mocks.provider, AiUnavailableError: class extends Error {} }));
import { POST } from "@/app/api/workspace/assistance/route";
const patientId = "22222222-2222-4222-8222-222222222222";
const call = (body: object) => POST(new NextRequest("https://care.example/api/workspace/assistance", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
}), { params: Promise.resolve({}) });
afterEach(() => vi.unstubAllEnvs());
describe("assistance role/consent boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.user.role = "DOCTOR"; mocks.auth.mockResolvedValue(mocks.user);
    mocks.accessible.mockResolvedValue({ id: patientId, firstName: "Example", lastName: "Patient", caseNumber: "CASE-123" });
    mocks.patient.mockResolvedValue({ id: patientId });
    mocks.history.mockResolvedValue({ chiefComplaint: "Recorded concern", allergies: [], medications: [], pastHistory: null });
    mocks.consultations.mockResolvedValue([]); mocks.results.mockResolvedValue([]);
    vi.stubEnv("KIMI_API_KEY", "");
  });
  it("rejects missing consent before reading clinical records", async () => {
    expect((await call({ mode: "summary", patientId })).status).toBe(400);
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("prevents patient access to clinician summaries", async () => {
    mocks.user.role = "PATIENT";
    expect((await call({ mode: "summary", patientId, consent: true })).status).toBe(403);
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("prevents patients from submitting another patient's ID", async () => {
    mocks.user.role = "PATIENT";
    expect((await call({ mode: "intake", patientId: "33333333-3333-4333-8333-333333333333", consent: true })).status).toBe(404);
  });
  it("requires verified doctor and assigned-patient access before summary generation", async () => {
    const response = await call({ mode: "summary", patientId, consent: true });
    expect(response.status).toBe(200);
    expect(mocks.verified).toHaveBeenCalledWith(mocks.user);
    expect(mocks.accessible).toHaveBeenCalledWith(mocks.user, patientId);
    const body = await response.json();
    expect(body.method).toBe("local-extractive");
    expect(body.savedToRecord).toBe(false);
    expect(body.requiresHumanReview).toBe(true);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("fails closed rather than claiming AI ran without configuration", async () => {
    expect((await call({ mode: "documentation", patientId, consent: true, useProvider: true })).status).toBe(503);
    expect(mocks.provider).not.toHaveBeenCalled();
  });
  it("labels actual provider output and audits metadata but not prompts or output", async () => {
    vi.stubEnv("KIMI_API_KEY", "test-only-not-live");
    mocks.provider.mockResolvedValue({ text: "An unsaved provider draft", questions: [] });
    const response = await call({ mode: "documentation", patientId, consent: true, useProvider: true });
    expect((await response.json()).method).toBe("ai-assisted");
    expect(mocks.provider).toHaveBeenCalledOnce();
    const audit = mocks.audit.mock.calls[0][0].data;
    expect(audit.details.providerRequested).toBe(true);
    expect(JSON.stringify(audit)).not.toContain("Recorded concern");
    expect(JSON.stringify(audit)).not.toContain("An unsaved provider draft");
  });
  it("patient intake preparation does not fetch their clinical history", async () => {
    mocks.user.role = "PATIENT";
    const response = await call({ mode: "intake", consent: true });
    expect(response.status).toBe(200);
    expect(mocks.history).not.toHaveBeenCalled();
    expect(mocks.results).not.toHaveBeenCalled();
  });
});
