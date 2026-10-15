import { describe, expect, it } from "vitest";
import { formatMoney, priceSchema, toMinorUnits } from "./money";

describe("priceSchema", () => {
  it("accepts zero and two-decimal prices", () => {
    expect(priceSchema.safeParse(0).success).toBe(true);
    expect(priceSchema.safeParse(5000.5).success).toBe(true);
    expect(priceSchema.safeParse(19.99).success).toBe(true);
  });
  it("rejects negative, over-precise and absurd prices", () => {
    expect(priceSchema.safeParse(-1).success).toBe(false);
    expect(priceSchema.safeParse(10.001).success).toBe(false);
    expect(priceSchema.safeParse(1e12).success).toBe(false);
  });
});

describe("money formatting", () => {
  it("shows the currency symbol and two decimals", () => {
    expect(formatMoney(5000, "NGN")).toContain("5,000.00");
    expect(formatMoney("120", "USD")).toBe("$120.00");
  });
  it("converts to minor units without floating point drift", () => {
    expect(toMinorUnits(19.99)).toBe(1999);
    expect(toMinorUnits("0.29")).toBe(29);
    expect(toMinorUnits(5000)).toBe(500000);
  });
});
