import { describe, expect, it } from "vitest";
import { clinicInstant, clinicParts, hhmmToMinutes } from "./clinic-time";

describe("clinic time (WAT, UTC+1)", () => {
  it("converts clinic-local time to the right UTC instant", () => {
    expect(clinicInstant("2026-10-12", 9 * 60).toISOString()).toBe("2026-10-12T08:00:00.000Z");
  });

  it("round-trips through clinicParts", () => {
    const parts = clinicParts(clinicInstant("2026-10-12", 14 * 60 + 30));
    expect(parts.minutes).toBe(14 * 60 + 30);
    expect(parts.dayOfWeek).toBe(1); // Monday
  });

  it("rolls the day over for late-evening UTC", () => {
    // 23:30 UTC on Sunday is 00:30 Monday in Nigeria
    const parts = clinicParts(new Date("2026-10-11T23:30:00Z"));
    expect(parts.dayOfWeek).toBe(1);
    expect(parts.minutes).toBe(30);
  });

  it("parses HH:MM", () => {
    expect(hhmmToMinutes("09:30")).toBe(570);
  });
});
