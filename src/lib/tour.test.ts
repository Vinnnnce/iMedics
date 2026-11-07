import { describe, expect, it } from "vitest";
import { buildTourSteps, PUBLIC_TOUR } from "./tour";
describe("tour steps use existing accessible navigation", () => {
  it("never adds modules not present in permission-filtered input", () => {
    const steps = buildTourSteps([{ href: "/patient/appointments", label: "Appointments" }, { href: "/patient/records", label: "Records" }]);
    expect(steps.map(step => step.href)).toEqual(["/patient/records", "/patient/appointments"]);
    expect(steps.some(step => step.href.startsWith("/lab/") || step.href.startsWith("/doctor/"))).toBe(false);
  });
  it("explains doctor prescriptions and authorised facility administration", () => {
    expect(buildTourSteps([{ href: "/doctor/prescriptions", label: "Prescriptions" }])[0].description).toContain("professional authorisation");
    expect(buildTourSteps([{ href: "/lab/staff", label: "Staff" }])[0].description).toContain("permissions");
    expect(buildTourSteps([{ href: "/lab/hospital-settings", label: "Departments" }])[0].description).toContain("departments");
  });
  it("has a public introduction and registration conclusion without private AI access", () => {
    expect(PUBLIC_TOUR).toHaveLength(10);
    expect(PUBLIC_TOUR.at(-1)?.href).toBe("/auth/signup");
    expect(PUBLIC_TOUR.some(step => step.href === "/ai-assistant")).toBe(false);
  });
});
