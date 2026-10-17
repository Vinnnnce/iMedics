import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import {
  HOMEPAGE_SUGGESTIONS,
  facilitySuggestions,
  patientSuggestions,
  doctorSuggestions,
} from "@/lib/suggestions";
import { SuggestionsCard } from "@/components/shared/suggestions-card";

describe("patient suggestions", () => {
  const empty = {
    hasUpcomingAppointment: true,
    unpaidPayments: 0,
    failedPayments: 0,
    pendingResults: 0,
    unreadMessages: 0,
    hasBloodGroup: true,
  };

  it("suggests booking when there is no upcoming appointment", () => {
    const items = patientSuggestions({ ...empty, hasUpcomingAppointment: false });
    expect(items[0].title).toBe("Book a consultation");
    expect(items[0].href).toBe("/doctors");
  });

  it("suggests payment when bookings are unpaid or failed", () => {
    const items = patientSuggestions({ ...empty, unpaidPayments: 1, failedPayments: 1 });
    expect(items.some((s) => s.href === "/payments")).toBe(true);
  });

  it("suggests completing the health summary when the blood group is missing", () => {
    const items = patientSuggestions({ ...empty, hasBloodGroup: false });
    expect(items.some((s) => s.href === "/patient/case-file")).toBe(true);
  });

  it("always shows at least one suggestion, even in a perfect state", () => {
    const items = patientSuggestions(empty);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it("caps the number of suggestions", () => {
    const items = patientSuggestions({
      hasUpcomingAppointment: false,
      unpaidPayments: 1,
      failedPayments: 0,
      pendingResults: 2,
      unreadMessages: 3,
      hasBloodGroup: false,
    });
    expect(items.length).toBeLessThanOrEqual(4);
  });
});

describe("doctor suggestions", () => {
  const empty = {
    pendingBookings: 0,
    aiToReview: 0,
    subscriptionActive: true,
    activePatients: 0,
  };

  it("suggests responding to booking requests when pending", () => {
    const items = doctorSuggestions({ ...empty, pendingBookings: 2 });
    expect(items[0].title).toBe("Respond to booking requests");
    expect(items[0].href).toBe("/doctor/booking-requests");
  });

  it("suggests reviewing AI drafts when pending", () => {
    const items = doctorSuggestions({ ...empty, aiToReview: 1 });
    expect(items.some((s) => s.href === "/doctor/ai-tools")).toBe(true);
  });

  it("suggests activating the subscription when inactive", () => {
    const items = doctorSuggestions({ ...empty, subscriptionActive: false });
    expect(items.some((s) => s.href === "/doctor/subscription")).toBe(true);
  });

  it("always shows at least one suggestion", () => {
    const items = doctorSuggestions(empty);
    expect(items.length).toBeGreaterThanOrEqual(1);
  });
});

describe("facility suggestions", () => {
  const empty = {
    accountType: null as null,
    referralInbox: 0,
    credentialAlerts: 0,
    activeServices: 5,
  };

  it("suggests accepting referrals when the inbox is non-empty", () => {
    const items = facilitySuggestions({ ...empty, referralInbox: 3 });
    expect(items[0].title).toBe("Accept pending referrals");
    expect(items[0].href).toBe("/lab/referrals");
  });

  it("suggests publishing services when the catalogue is empty", () => {
    const items = facilitySuggestions({ ...empty, activeServices: 0 });
    expect(items.some((s) => s.href === "/lab/services")).toBe(true);
  });

  it("varies the account-type suggestion by facility kind", () => {
    const hospital = facilitySuggestions({ ...empty, accountType: "HOSPITAL" });
    const laboratory = facilitySuggestions({ ...empty, accountType: "LABORATORY" });
    const diagnostic = facilitySuggestions({ ...empty, accountType: "DIAGNOSTIC_CENTRE" });
    expect(hospital.some((s) => s.href === "/lab/staff")).toBe(true);
    expect(laboratory.some((s) => s.href === "/lab/orders")).toBe(true);
    expect(diagnostic.some((s) => s.href === "/lab/bookings")).toBe(true);
    expect(diagnostic.some((s) => s.href === "/lab/staff")).toBe(false);
  });

  it("suggests resolving credential alerts", () => {
    const items = facilitySuggestions({ ...empty, credentialAlerts: 2 });
    expect(items.some((s) => s.href === "/lab/credentials")).toBe(true);
  });
});

describe("homepage suggestions and rendering", () => {
  it("has homepage suggestions for signed-out visitors", () => {
    expect(HOMEPAGE_SUGGESTIONS.length).toBe(3);
    expect(HOMEPAGE_SUGGESTIONS.every((s) => s.href.startsWith("/") && s.cta.length > 0)).toBe(true);
  });

  it("renders suggestion rows with working links", () => {
    const html = renderToString(<SuggestionsCard items={HOMEPAGE_SUGGESTIONS} />);
    expect(html).toContain("Suggestions");
    expect(html).toContain("Find a doctor");
    expect(html).toContain('href="/doctors"');
    expect(html).toContain("Join as a provider");
  });

  it("renders nothing when there are no suggestions", () => {
    expect(renderToString(<SuggestionsCard items={[]} />)).toBe("");
  });
});
