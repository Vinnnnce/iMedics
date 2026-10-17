import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EMERGENCY_NUMBERS, HERO_TRUST_BADGES, HOW_IT_WORKS_STEPS, PROVIDER_BENEFITS, SERVICE_CARDS,
  SPECIALTIES, TRUST_ITEMS, filterSpecialties,
} from "./content";
import { greetingFor } from "@/lib/dashboard/greeting";

describe("homepage content", () => {
  it("shows the six-step how-it-works flow", () => {
    expect(HOW_IT_WORKS_STEPS).toHaveLength(6);
  });

  it("lists the four quick-access service cards with CTAs", () => {
    expect(SERVICE_CARDS).toHaveLength(4);
    for (const card of SERVICE_CARDS) {
      expect(card.cta).toBeTruthy();
      expect(card.href).toMatch(/^\//);
    }
  });

  it("lists the twelve featured specialties", () => {
    expect(SPECIALTIES).toHaveLength(12);
  });

  it("filters specialties case-insensitively and returns all when the term is empty", () => {
    expect(filterSpecialties(SPECIALTIES, "")).toHaveLength(12);
    expect(filterSpecialties(SPECIALTIES, "cardio")).toEqual([{ name: "Cardiology", query: "Cardiology" }]);
    expect(filterSpecialties(SPECIALTIES, "  PAED  ").map(s => s.name)).toEqual(["Paediatrics", "Orthopaedics"]);
    expect(filterSpecialties(SPECIALTIES, "zzz")).toEqual([]);
  });

  it("targets real routes for every service card and specialty", () => {
    for (const card of SERVICE_CARDS) {
      expect(existsSync(path.join(process.cwd(), "src/app", card.href, "page.tsx")), card.href).toBe(true);
    }
    for (const specialty of SPECIALTIES) {
      expect(specialty.query).toBeTruthy();
    }
    expect(existsSync(path.join(process.cwd(), "src/app", "/doctors", "page.tsx"))).toBe(true);
  });

  it("never exposes clinical data in trust or provider copy", () => {
    const copy = [...HERO_TRUST_BADGES, ...TRUST_ITEMS, ...PROVIDER_BENEFITS].join(" ").toLowerCase();
    expect(copy).not.toMatch(/diagnos[ie]|prescription detail|result value/);
  });

  it("uses the Nigerian emergency numbers", () => {
    expect(EMERGENCY_NUMBERS.national).toBe("112");
    expect(EMERGENCY_NUMBERS.lagos).toBe("767");
  });
});

describe("time-of-day greeting", () => {
  it("greets according to the clinic timezone hour", () => {
    // 08:00 in Lagos on a fixed instant.
    expect(greetingFor(new Date("2026-10-16T08:00:00+01:00"))).toBe("Good morning");
    expect(greetingFor(new Date("2026-10-16T14:30:00+01:00"))).toBe("Good afternoon");
    expect(greetingFor(new Date("2026-10-16T20:00:00+01:00"))).toBe("Good evening");
  });

  it("falls back to a valid greeting for any instant", () => {
    const greeting = greetingFor(new Date(0));
    expect(["Good morning", "Good afternoon", "Good evening"]).toContain(greeting);
  });
});