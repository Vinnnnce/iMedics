import { readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  HOMEPAGE_SUGGESTIONS,
  doctorSuggestions,
  facilitySuggestions,
  patientSuggestions,
} from "@/lib/suggestions";
/** Regression for Base UI buttons defaulting to type=button, including hidden tab panels. */
describe("dashboard form submit controls", () => {
  it.each(["patient", "doctor", "facility", "admin", "intelligence", "tasks", "documents", "payments"])("%s forms have explicit submit buttons", name => {
    const file = path.join(process.cwd(), `src/components/dashboard/${name}.tsx`);
    const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const forms: ts.JsxElement[] = [];
    function find(node: ts.Node) {
      if (ts.isJsxElement(node) && node.openingElement.tagName.getText(source) === "form") forms.push(node);
      ts.forEachChild(node, find);
    }
    find(source);
    for (const form of forms) {
      let submits = 0;
      function check(node: ts.Node) {
        const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
        if (opening && ["Button", "button"].includes(opening.tagName.getText(source))) {
          if (opening.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.getText(source) === "type" && attr.initializer && ts.isStringLiteral(attr.initializer) && attr.initializer.text === "submit")) submits++;
        }
        ts.forEachChild(node, check);
      }
      check(form);
      expect(submits, `${name} form at position ${form.pos} needs an explicit submit button`).toBeGreaterThan(0);
    }
  });
});

/** Account-specific suggestions: each dashboard wires the builder for its
 *  account type, the homepage shows visitor suggestions, and nothing leaks
 *  into the sidebar or non-dashboard areas. */
describe("dashboard account-specific suggestions", () => {
  const DASHBOARDS = [
    { name: "patient", file: "src/app/dashboard/page.tsx", builder: "patientSuggestions" },
    { name: "doctor", file: "src/app/doctor/dashboard/page.tsx", builder: "doctorSuggestions" },
    { name: "facility", file: "src/app/lab/dashboard/page.tsx", builder: "facilitySuggestions" },
  ] as const;

  it.each(DASHBOARDS)("%s dashboard renders its account-specific suggestions card", ({ file, builder }) => {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    expect(source, `${file} should render the SuggestionsCard`).toContain("SuggestionsCard");
    expect(source, `${file} should use the ${builder} builder`).toContain(builder);
  });

  it("the public homepage shows suggestions for signed-out visitors", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/home/public-homepage.tsx"), "utf8");
    expect(source).toContain("SuggestionsCard");
    expect(source).toContain("HOMEPAGE_SUGGESTIONS");
  });

  it("keeps the suggestions card out of the sidebar footer and other navigation", () => {
    const navbar = readFileSync(path.join(process.cwd(), "src/components/layout/navbar.tsx"), "utf8");
    expect(navbar).not.toContain("SuggestionsCard");
    expect(navbar).not.toContain("@/lib/suggestions");
  });

  it("facility suggestions vary by the facility's account type", () => {
    const base = { referralInbox: 0, credentialAlerts: 0, activeServices: 5 };
    const hrefs = (accountType: "HOSPITAL" | "LABORATORY" | "DIAGNOSTIC_CENTRE") =>
      facilitySuggestions({ ...base, accountType }).map(s => s.href);
    expect(hrefs("HOSPITAL")).toContain("/lab/staff");
    expect(hrefs("LABORATORY")).toContain("/lab/orders");
    expect(hrefs("DIAGNOSTIC_CENTRE")).toContain("/lab/bookings");
    expect(hrefs("HOSPITAL")).not.toContain("/lab/bookings");
  });

  it("patient suggestions respond to the patient's state", () => {
    const items = patientSuggestions({
      hasUpcomingAppointment: false,
      unpaidPayments: 1,
      failedPayments: 0,
      pendingResults: 0,
      unreadMessages: 0,
      hasBloodGroup: true,
    });
    expect(items[0].href).toBe("/doctors");
    expect(items.some(s => s.href === "/payments")).toBe(true);
  });

  it("doctor suggestions respond to the doctor's state", () => {
    const items = doctorSuggestions({
      pendingBookings: 1,
      aiToReview: 0,
      subscriptionActive: true,
      activePatients: 0,
    });
    expect(items[0].href).toBe("/doctor/booking-requests");
  });

  it("homepage suggestions cover patients and providers", () => {
    const hrefs = HOMEPAGE_SUGGESTIONS.map(s => s.href);
    expect(hrefs).toContain("/doctors");
    expect(hrefs).toContain("/laboratories");
    expect(hrefs).toContain("/auth/signup");
  });
});
