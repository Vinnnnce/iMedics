import { describe, expect, it, vi } from "vitest";

vi.mock("next/server", () => ({ after: (fn: () => unknown) => fn() }));
vi.mock("../prisma", () => ({ prisma: {} }));

import { isRefundEligible } from "./service";

const now = new Date("2026-10-15T10:00:00Z");
const inHours = (h: number) => new Date(now.getTime() + h * 3_600_000);

describe("isRefundEligible", () => {
  it("always refunds when the provider cancels", () => {
    expect(isRefundEligible({ cancelledBy: "DOCTOR", wasConfirmed: true, startsAt: inHours(1), now })).toBe(true);
    expect(isRefundEligible({ cancelledBy: "LAB_SCIENTIST", wasConfirmed: true, startsAt: inHours(1), now })).toBe(true);
  });
  it("refunds a patient who cancels before the provider confirmed", () => {
    expect(isRefundEligible({ cancelledBy: "PATIENT", wasConfirmed: false, startsAt: inHours(1), now })).toBe(true);
  });
  it("refunds a patient who cancels a confirmed booking early enough, not late", () => {
    expect(isRefundEligible({ cancelledBy: "PATIENT", wasConfirmed: true, startsAt: inHours(24), now })).toBe(true);
    expect(isRefundEligible({ cancelledBy: "PATIENT", wasConfirmed: true, startsAt: inHours(23), now })).toBe(false);
  });
});
