import { describe, expect, it } from "vitest";
import { APPOINTMENT_TRANSITIONS, addMinutes, overlaps } from "./appointments";

const t = (iso: string) => new Date(iso);

describe("appointment overlap", () => {
  it("detects overlapping slots", () => {
    expect(overlaps(t("2026-10-12T08:00:00Z"), 30, t("2026-10-12T08:15:00Z"), 30)).toBe(true);
  });
  it("treats back-to-back slots as free", () => {
    expect(overlaps(t("2026-10-12T08:00:00Z"), 30, t("2026-10-12T08:30:00Z"), 30)).toBe(false);
  });
  it("detects a slot fully inside a longer one", () => {
    expect(overlaps(t("2026-10-12T08:00:00Z"), 60, t("2026-10-12T08:20:00Z"), 15)).toBe(true);
  });
  it("adds minutes", () => {
    expect(addMinutes(t("2026-10-12T08:00:00Z"), 45).toISOString()).toBe("2026-10-12T08:45:00.000Z");
  });
});

describe("appointment status transitions", () => {
  it("allows the normal flow", () => {
    expect(APPOINTMENT_TRANSITIONS.BOOKED).toContain("CONFIRMED");
    expect(APPOINTMENT_TRANSITIONS.CONFIRMED).toContain("COMPLETED");
  });
  it("makes finished states final", () => {
    for (const s of ["COMPLETED", "CANCELLED", "NO_SHOW"] as const) expect(APPOINTMENT_TRANSITIONS[s]).toEqual([]);
  });
  it("does not let a booking skip confirmation", () => {
    expect(APPOINTMENT_TRANSITIONS.BOOKED).not.toContain("COMPLETED");
  });
});
