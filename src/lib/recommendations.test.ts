import { describe, expect, it } from "vitest";

import {
  RECOMMENDATION_CATEGORY_KEYS,
  capRecommendations,
  categoriesForViewer,
  toDoctorRecommendation,
  toFacilityPatientRecommendation,
  toFacilityRecommendation,
  toPatientRecommendation,
  viewerFromAccountType,
  viewerFromRole,
} from "./recommendations";

describe("categoriesForViewer", () => {
  it("suggests doctors and facilities to patients", () => {
    expect(categoriesForViewer("PATIENT")).toEqual(["doctors", "hospitals", "laboratories", "diagnosticCentres"]);
  });

  it("suggests patients and facilities to doctors", () => {
    expect(categoriesForViewer("DOCTOR")).toEqual(["patients", "hospitals", "laboratories", "diagnosticCentres"]);
  });

  it("suggests doctors, patients and other facilities to hospitals", () => {
    expect(categoriesForViewer("HOSPITAL")).toEqual(["doctors", "patients", "laboratories", "diagnosticCentres"]);
  });

  it("suggests doctors, patients and other facilities to laboratories", () => {
    expect(categoriesForViewer("LABORATORY")).toEqual(["doctors", "patients", "hospitals", "diagnosticCentres"]);
  });

  it("suggests doctors, patients and other facilities to diagnostic centres", () => {
    expect(categoriesForViewer("DIAGNOSTIC_CENTRE")).toEqual(["doctors", "patients", "hospitals", "laboratories"]);
  });

  it("never includes the viewer's own category", () => {
    for (const viewer of ["PATIENT", "DOCTOR", "HOSPITAL", "LABORATORY", "DIAGNOSTIC_CENTRE"] as const) {
      const ownKey = { PATIENT: "patients", DOCTOR: "doctors", HOSPITAL: "hospitals", LABORATORY: "laboratories", DIAGNOSTIC_CENTRE: "diagnosticCentres" }[viewer];
      expect(categoriesForViewer(viewer)).not.toContain(ownKey);
      expect(categoriesForViewer(viewer)).toHaveLength(RECOMMENDATION_CATEGORY_KEYS.length - 1);
    }
  });
});

describe("viewerFromAccountType", () => {
  it("maps every account type to its perspective", () => {
    expect(viewerFromAccountType("PATIENT")).toBe("PATIENT");
    expect(viewerFromAccountType("DOCTOR")).toBe("DOCTOR");
    expect(viewerFromAccountType("HOSPITAL")).toBe("HOSPITAL");
    expect(viewerFromAccountType("LABORATORY")).toBe("LABORATORY");
    expect(viewerFromAccountType("DIAGNOSTIC_CENTRE")).toBe("DIAGNOSTIC_CENTRE");
    expect(viewerFromAccountType(null)).toBeNull();
  });
});

describe("viewerFromRole", () => {
  it("routes each role to its dashboard context", () => {
    expect(viewerFromRole("PATIENT")).toBe("patient");
    expect(viewerFromRole("DOCTOR")).toBe("doctor");
    expect(viewerFromRole("LAB_SCIENTIST")).toBe("facility");
    expect(viewerFromRole("ADMIN")).toBe("patient");
  });
});

describe("toDoctorRecommendation", () => {
  it("links to the public doctor profile", () => {
    expect(toDoctorRecommendation({ id: "doc-1", specialty: "Cardiology", name: "Dr. Ada" })).toEqual({
      id: "doc-1",
      name: "Dr. Ada",
      subtitle: "Cardiology",
      href: "/doctors/doc-1",
    });
  });

  it("handles doctors without a specialty", () => {
    expect(toDoctorRecommendation({ id: "doc-2", specialty: null, name: "Dr. Bello" }).subtitle).toBeNull();
  });
});

describe("toFacilityRecommendation", () => {
  const row = { id: "fac-1", slug: "acme-labs", laboratoryName: "Acme Labs", city: "Lagos", state: "LA" };

  it("links to the public facility page with a location subtitle", () => {
    expect(toFacilityRecommendation("laboratories", row)).toEqual({
      id: "fac-1",
      name: "Acme Labs",
      subtitle: "Lagos, LA",
      href: "/laboratories/acme-labs",
    });
  });

  it("skips facilities without a published slug", () => {
    expect(toFacilityRecommendation("hospitals", { ...row, slug: null })).toBeNull();
  });

  it("handles missing location parts", () => {
    expect(toFacilityRecommendation("hospitals", { ...row, city: null })?.subtitle).toBe("LA");
    expect(toFacilityRecommendation("diagnostic-centres", { ...row, city: null, state: null })?.subtitle).toBeNull();
  });
});

describe("toPatientRecommendation", () => {
  it("shows only the minimal identity a doctor already sees", () => {
    expect(
      toPatientRecommendation({ id: "p-1", firstName: "Jane", lastName: "Okafor", caseNumber: "MC-001" }),
    ).toEqual({ id: "p-1", name: "Jane Okafor", subtitle: "Case MC-001", href: "/patients/p-1" });
  });

  it("joins partial names safely", () => {
    expect(toPatientRecommendation({ id: "p-2", firstName: null, lastName: "Okafor", caseNumber: "MC-002" }).name).toBe("Okafor");
  });
});

describe("toFacilityPatientRecommendation", () => {
  const row = { patient: { id: "p-1", firstName: "Jane", lastName: "Okafor" } };

  it("links lab orders to the orders portal", () => {
    expect(toFacilityPatientRecommendation("orders", row, "Open lab order")).toEqual({
      id: "p-1",
      name: "Jane Okafor",
      subtitle: "Open lab order",
      href: "/lab/orders",
    });
  });

  it("links bookings to the bookings portal", () => {
    expect(toFacilityPatientRecommendation("bookings", row, "Upcoming booking").href).toBe("/lab/bookings");
  });
});

describe("capRecommendations", () => {
  it("keeps at most the requested number of items", () => {
    expect(capRecommendations([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 3, 4]);
    expect(capRecommendations([1, 2], 4)).toEqual([1, 2]);
  });
});
