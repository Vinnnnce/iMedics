import { describe, expect, it } from "vitest";
import {
  adminTicketUpdateSchema, defaultPriority, generateTicketReference, isOverdue, memberTicketSchema,
  publicContactSchema, renderAcknowledgement, sanitizePagePath, slaDueAt,
} from "./support";

describe("ticket priority and SLA", () => {
  it("treats security and patient-safety reports as urgent", () => {
    expect(defaultPriority("SECURITY")).toBe("URGENT");
    expect(defaultPriority("CLINICAL_SAFETY")).toBe("URGENT");
    expect(defaultPriority("DATA_CORRECTION")).toBe("HIGH");
    expect(defaultPriority("FEEDBACK")).toBe("LOW");
    expect(defaultPriority("CONTACT")).toBe("NORMAL");
  });
  it("sets shorter deadlines for higher priority", () => {
    const from = new Date("2026-11-08T08:00:00Z");
    expect(slaDueAt("URGENT", from).toISOString()).toBe("2026-11-08T10:00:00.000Z");
    expect(slaDueAt("NORMAL", from).toISOString()).toBe("2026-11-09T08:00:00.000Z");
  });
  it("is overdue only while unanswered and open", () => {
    const due = new Date("2026-11-08T10:00:00Z");
    const now = new Date("2026-11-08T11:00:00Z");
    expect(isOverdue({ status: "OPEN", slaDueAt: due, firstResponseAt: null }, now)).toBe(true);
    expect(isOverdue({ status: "OPEN", slaDueAt: due, firstResponseAt: new Date() }, now)).toBe(false);
    expect(isOverdue({ status: "RESOLVED", slaDueAt: due, firstResponseAt: null }, now)).toBe(false);
  });
});

describe("references and paths", () => {
  it("generates readable, unambiguous references", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const ref = generateTicketReference();
      expect(ref).toMatch(/^SUP-[A-HJKMNP-Z2-9]{8}$/);
      seen.add(ref);
    }
    expect(seen.size).toBeGreaterThan(190);
  });
  it("keeps only same-site paths and drops queries", () => {
    expect(sanitizePagePath("/patient/results?id=abc#x")).toBe("/patient/results");
    expect(sanitizePagePath("//evil.test/x")).toBeNull();
    expect(sanitizePagePath("https://evil.test/x")).toBeNull();
    expect(sanitizePagePath(undefined)).toBeNull();
  });
});

describe("validation", () => {
  const valid = { name: "Ada Obi", email: "ADA@Example.com", subject: "Login problem", message: "I cannot sign in on my phone." };
  it("normalises the public form and rejects bad input", () => {
    expect(publicContactSchema.parse(valid).email).toBe("ada@example.com");
    expect(publicContactSchema.parse(valid).type).toBe("CONTACT");
    expect(publicContactSchema.safeParse({ ...valid, email: "nope" }).success).toBe(false);
    expect(publicContactSchema.safeParse({ ...valid, message: "short" }).success).toBe(false);
    expect(publicContactSchema.safeParse({ ...valid, message: "x".repeat(5001) }).success).toBe(false);
  });
  it("keeps record-related report types off the anonymous form", () => {
    expect(publicContactSchema.safeParse({ ...valid, type: "DATA_CORRECTION" }).success).toBe(false);
    expect(publicContactSchema.safeParse({ ...valid, type: "CLINICAL_SAFETY" }).success).toBe(false);
    expect(publicContactSchema.safeParse({ ...valid, type: "SECURITY" }).success).toBe(true);
  });
  it("takes identity from the session for signed-in reports", () => {
    const parsed = memberTicketSchema.parse({ type: "DATA_CORRECTION", subject: "Wrong allergy", message: "My allergy list is wrong.", email: "x@y.z" });
    expect(parsed).not.toHaveProperty("email");
  });
  it("requires something to change in an admin update", () => {
    expect(adminTicketUpdateSchema.safeParse({ id: "3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10" }).success).toBe(false);
    expect(adminTicketUpdateSchema.safeParse({ id: "3f1c7b52-3c1b-4a43-9b1e-6c5d3d9f2a10", status: "RESOLVED" }).success).toBe(true);
  });
});

describe("acknowledgement email", () => {
  it("quotes the reference and never echoes the message", () => {
    const mail = renderAcknowledgement("SUP-ABCD2345", "https://app.example");
    expect(mail.subject).toContain("SUP-ABCD2345");
    expect(mail.text).toContain("never send health details");
  });
});
