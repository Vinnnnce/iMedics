import { describe, expect, it } from "vitest";
import { doctorCompleteness, facilityCompleteness } from "@/lib/profile-completeness";

const emptyDoctor = {
  avatarUrl: null, specialty: null, biography: null, education: null, languages: [],
  location: null, consultationFee: null, scheduleCount: 0, portfolioCount: 0,
};

describe("doctorCompleteness", () => {
  it("is 0% for an empty profile and lists every step", () => {
    const result = doctorCompleteness(emptyDoctor);
    expect(result.percent).toBe(0);
    expect(result.missing).toHaveLength(result.items.length);
  });
  it("counts a zero fee as set, but a short biography as missing", () => {
    const result = doctorCompleteness({ ...emptyDoctor, consultationFee: 0, biography: "Too short" });
    expect(result.items.find((i) => i.key === "fee")?.done).toBe(true);
    expect(result.items.find((i) => i.key === "bio")?.done).toBe(false);
  });
  it("is 100% when everything is filled in", () => {
    const result = doctorCompleteness({
      avatarUrl: "/api/profile-images/a/b", specialty: "Cardiology",
      biography: "Consultant cardiologist with twelve years of clinical experience.",
      education: "MBBS", languages: ["English"], location: "Lagos", consultationFee: 5000,
      scheduleCount: 3, portfolioCount: 1,
    });
    expect(result.percent).toBe(100);
    expect(result.missing).toEqual([]);
  });
});

describe("facilityCompleteness", () => {
  it("needs both address and city, and a published page", () => {
    const base = { logoUrl: "x", about: "A".repeat(50), operatingHours: "24/7", addressLine: "1 Main St", city: null, serviceCount: 2, isPublished: false };
    const result = facilityCompleteness(base);
    expect(result.missing.map((i) => i.key)).toEqual(["address", "published"]);
    expect(result.percent).toBe(67);
  });
});
