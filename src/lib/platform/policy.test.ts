import { describe, expect, it } from "vitest";
import { policyAllows, policyRulesSchema, moduleForPath } from "./policy";
const context = { accountType: "HOSPITAL", role: "PATIENT", facilityRole: "NURSE", country: "NG", facilityType: "HOSPITAL", facilityId: "10000000-0000-4000-8000-000000000001" };
const rules = (over = {}) => policyRulesSchema.parse(over);
describe("central policy evaluator", () => {
  it("fails closed for malformed policies", () => expect(policyAllows({ mode: "RESTRICTED", rules: { countries: [7] } }, context, "VIEW")).toBe(false));
  it("denies a disabled feature including platform admins", () => {
    expect(policyAllows({ mode: "DISABLED", rules: rules() }, context, "VIEW")).toBe(false);
    expect(policyAllows({ mode: "DISABLED", rules: rules() }, { ...context, role: "ADMIN" }, "VIEW")).toBe(false);
  });
  it("scopes a restriction to the chosen tenant without affecting other facilities", () => {
    const policy = { mode: "DISABLED", rules: rules({ facilityIds: [context.facilityId] }) };
    expect(policyAllows(policy, context, "VIEW")).toBe(false);
    expect(policyAllows(policy, { ...context, facilityId: "20000000-0000-4000-8000-000000000002" }, "VIEW")).toBe(true);
  });
  it("targets account and facility types", () => {
    expect(policyAllows({ mode: "DISABLED", rules: rules({ accountTypes: ["PATIENT"] }) }, context, "VIEW")).toBe(true);
    expect(policyAllows({ mode: "DISABLED", rules: rules({ facilityTypes: ["HOSPITAL"] }) }, context, "VIEW")).toBe(false);
  });
  it.each(["CREATE", "EDIT", "SIGN", "APPROVE"])("read only blocks %s", (action) => expect(policyAllows({ mode: "READ_ONLY", rules: rules() }, context, action)).toBe(false));
  it.each(["VIEW", "DOWNLOAD", "PRINT"])("read only permits %s", (action) => expect(policyAllows({ mode: "READ_ONLY", rules: rules() }, context, action)).toBe(true));
  it("keeps clinical signing and document download restrictions independent", () => {
    const p = { mode: "RESTRICTED", rules: rules({ deniedActions: ["SIGN", "DOWNLOAD", "PRINT"] }) };
    expect(policyAllows(p, context, "VIEW")).toBe(true);
    for (const action of ["SIGN", "DOWNLOAD", "PRINT"]) expect(policyAllows(p, context, action)).toBe(false);
  });
  it("uses effective and expiry dates with an exclusive end", () => {
    const p = { mode: "RESTRICTED", rules: rules({ startsAt: "2026-01-01T00:00:00Z", endsAt: "2026-02-01T00:00:00Z" }) };
    expect(policyAllows(p, context, "VIEW", new Date("2025-12-31"))).toBe(false);
    expect(policyAllows(p, context, "VIEW", new Date("2026-01-01"))).toBe(true);
    expect(policyAllows(p, context, "VIEW", new Date("2026-02-01"))).toBe(false);
  });
  it("does not manufacture a subscription entitlement", () => expect(policyAllows({ mode: "RESTRICTED", rules: rules({ subscriptionPlans: [context.facilityId] }) }, context, "VIEW")).toBe(false));
  it("allows specifically authorized facility roles but denies other roles", () => {
    const p = { mode: "RESTRICTED", rules: rules({ roles: ["NURSE"] }) };
    expect(policyAllows(p, context, "VIEW")).toBe(true);
    expect(policyAllows(p, { ...context, facilityRole: "ACCOUNTANT" }, "VIEW")).toBe(false);
  });
  it("restricts by jurisdiction", () => expect(policyAllows({ mode: "RESTRICTED", rules: rules({ countries: ["DE"] }) }, context, "VIEW")).toBe(false));
  it.each([
    ["/api/facility/his/medication-orders", "PRESCRIPTIONS"],
    ["/api/facility/diagnostic-reports/123/action", "DIAGNOSTICS"],
    ["/api/patient/clinical-documents/123/pdf", "CLINICAL_DOCUMENTS"],
    ["/api/patient/documents/123", "CLINICAL_DOCUMENTS"],
    ["/api/workspace/documents?id=123", "CLINICAL_DOCUMENTS"],
    ["/api/files/123", "LABORATORY"],
    ["/lab/clinical-documents/templates", "DOCUMENT_TEMPLATES"],
    ["/lab/organization?facilityId=x", "DEPARTMENTS"],
    ["/api/admin/control", null],
  ])("maps %s to its centrally controlled module", (path, module) => expect(moduleForPath(path)).toBe(module));
});
