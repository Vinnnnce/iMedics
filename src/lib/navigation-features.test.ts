import { describe, expect, it } from "vitest";
import { navigationFeatureEnabled } from "./navigation-features";
describe("configured facility navigation", () => {
  it("keeps compatibility for unconfigured facilities", () => {
    expect(navigationFeatureEnabled("/lab/emergency", "HOSPITAL", null)).toBe(true);
  });
  it("removes unavailable hospital modules without removing administration", () => {
    expect(navigationFeatureEnabled("/lab/emergency", "HOSPITAL", ["LABORATORY"])).toBe(false);
    expect(navigationFeatureEnabled("/lab/orders", "HOSPITAL", ["LABORATORY"])).toBe(true);
    expect(navigationFeatureEnabled("/lab/hospital-settings", "HOSPITAL", [])).toBe(true);
    expect(navigationFeatureEnabled("/lab/staff", "HOSPITAL", [])).toBe(true);
  });
  it("does not impose hospital settings on standalone facilities", () => {
    expect(navigationFeatureEnabled("/lab/orders", "LABORATORY", [])).toBe(true);
  });
});
