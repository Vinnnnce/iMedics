import { describe, expect, it } from "vitest";
import { slugifyFacility, validateFacilitySlug, publicStaffProfile } from "./public-facilities";

describe("facility slugs", () => {
  it("slugifies facility names", () => {
    expect(slugifyFacility("MedLab Diagnostics")).toBe("medlab-diagnostics");
    expect(slugifyFacility("  City Imaging Centre  ")).toBe("city-imaging-centre");
    expect(slugifyFacility("Lagos General Hospital!")).toBe("lagos-general-hospital");
    expect(slugifyFacility("Àçcènts & Symbols")).toBe("accents-symbols");
  });

  it("returns null for unusable names", () => {
    expect(slugifyFacility("")).toBeNull();
    expect(slugifyFacility("---")).toBeNull();
    expect(slugifyFacility("!!!")).toBeNull();
  });

  it("accepts valid slugs and rejects reserved or too-short ones", () => {
    expect(validateFacilitySlug("medlab-diagnostics")).toBe("medlab-diagnostics");
    expect(validateFacilitySlug("MedLab Diagnostics")).toBe("medlab-diagnostics");
    expect(validateFacilitySlug("new")).toBeNull();
    expect(validateFacilitySlug("ab")).toBeNull();
    expect(validateFacilitySlug("api")).toBeNull();
    expect(validateFacilitySlug("")).toBeNull();
  });
});

describe("public staff profiles", () => {
  const base = {
    id: "staff-1",
    fullName: "Ada Obi",
    professionalTitle: "Consultant Pathologist",
    linkedinUrl: "https://linkedin.com/in/ada",
    linkedinPublic: false,
  };

  it("hides LinkedIn unless the staff member opted in", () => {
    expect(publicStaffProfile(base).linkedinUrl).toBeNull();
    expect(publicStaffProfile({ ...base, linkedinPublic: true }).linkedinUrl).toBe("https://linkedin.com/in/ada");
  });

  it("keeps all public fields", () => {
    const profile = publicStaffProfile(base);
    expect(profile.fullName).toBe("Ada Obi");
    expect(profile.professionalTitle).toBe("Consultant Pathologist");
  });
});
