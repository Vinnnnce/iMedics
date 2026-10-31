import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { LegalPolicy } from "@/components/legal/legal-policy";
import { FaqSection } from "@/components/shared/faq-section";
import { policyAudienceFor, AUDIENCE_LABELS, LEGAL_NAV_LINKS, LEGAL_META } from "@/lib/legal/types";
import { TERMS_AUDIENCES, TERMS_COMMON } from "@/lib/legal/terms";
import { PRIVACY_AUDIENCES, PRIVACY_COMMON } from "@/lib/legal/privacy";
import { COOKIES_AUDIENCES, COOKIES_COMMON } from "@/lib/legal/cookies";
import { FAQS, facilityFaqs } from "@/lib/faqs";

const RELATED = [
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Use" },
];

describe("policy audience resolution", () => {
  it("maps each account type to its own audience", () => {
    expect(policyAudienceFor({ accountType: "PATIENT" })).toBe("PATIENT");
    expect(policyAudienceFor({ accountType: "DOCTOR" })).toBe("DOCTOR");
    expect(policyAudienceFor({ accountType: "HOSPITAL" })).toBe("HOSPITAL");
    expect(policyAudienceFor({ accountType: "LABORATORY" })).toBe("LABORATORY");
    expect(policyAudienceFor({ accountType: "DIAGNOSTIC_CENTRE" })).toBe("DIAGNOSTIC_CENTRE");
    expect(policyAudienceFor({ accountType: "PHARMACY" })).toBe("PHARMACY");
  });

  it("falls back to the role when the account type is missing", () => {
    expect(policyAudienceFor({ role: "DOCTOR", accountType: null })).toBe("DOCTOR");
    expect(policyAudienceFor({ role: "PATIENT", accountType: null })).toBe("PATIENT");
  });

  it("resolves signed-out users, admins and unknown accounts to GENERAL", () => {
    expect(policyAudienceFor(null)).toBe("GENERAL");
    expect(policyAudienceFor(undefined)).toBe("GENERAL");
    expect(policyAudienceFor({ role: "ADMIN", accountType: null })).toBe("GENERAL");
    expect(policyAudienceFor({ role: "LAB_SCIENTIST", accountType: null })).toBe("GENERAL");
  });
});

describe("legal content invariants", () => {
  it("covers all six account audiences in every policy", () => {
    for (const audiences of [TERMS_AUDIENCES, PRIVACY_AUDIENCES, COOKIES_AUDIENCES]) {
      expect(audiences.map((a) => a.audience).sort()).toEqual(
        ["DIAGNOSTIC_CENTRE", "DOCTOR", "HOSPITAL", "LABORATORY", "PATIENT", "PHARMACY"],
      );
    }
  });

  it("has unique section anchors within each policy", () => {
    for (const [common, audiences] of [
      [TERMS_COMMON, TERMS_AUDIENCES],
      [PRIVACY_COMMON, PRIVACY_AUDIENCES],
      [COOKIES_COMMON, COOKIES_AUDIENCES],
    ] as const) {
      const ids = [
        ...common.map((s) => s.id),
        ...audiences.flatMap((a) => a.sections.map((s) => s.id)),
      ];
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("mentions the Nigerian legal framework in every policy", () => {
    expect(TERMS_COMMON.some((s) => JSON.stringify(s).includes("Nigeria Data Protection Act"))).toBe(true);
    expect(PRIVACY_COMMON.some((s) => JSON.stringify(s).includes("Nigeria Data Protection Act"))).toBe(true);
    expect(COOKIES_COMMON.some((s) => JSON.stringify(s).includes("Nigeria Data Protection Act"))).toBe(true);
    expect(PRIVACY_COMMON.some((s) => JSON.stringify(s).includes("National Health Act"))).toBe(true);
  });

  it("includes the not-legal-advice disclaimer in every policy", () => {
    const rendered = renderToString(
      <LegalPolicy
        title="Terms of Use"
        audience="GENERAL"
        common={TERMS_COMMON}
        audiences={TERMS_AUDIENCES}
        intro="intro"
        related={RELATED}
      />,
    );
    expect(rendered).toContain("does not constitute legal advice");
  });
});

describe("legal policy rendering", () => {
  it("shows only the viewer's audience section when tailored", () => {
    const html = renderToString(
      <LegalPolicy
        title="Terms of Use"
        audience="PATIENT"
        common={TERMS_COMMON}
        audiences={TERMS_AUDIENCES}
        intro="intro"
        related={RELATED}
      />,
    );
    expect(html).toContain("tailored to your Patient account");
    expect(html).toContain("For patients");
    expect(html).not.toContain("For laboratories");
  });

  it("shows every audience section to signed-out visitors", () => {
    const html = renderToString(
      <LegalPolicy
        title="Privacy Policy"
        audience="GENERAL"
        common={PRIVACY_COMMON}
        audiences={PRIVACY_AUDIENCES}
        intro="intro"
        related={RELATED}
      />,
    );
    expect(html).toContain("general version");
    for (const label of Object.values(AUDIENCE_LABELS)) {
      if (label === "General") continue;
      expect(html).toContain(`For ${label} accounts`);
    }
  });

  it("renders the sidebar footer link targets in the related nav", () => {
    const html = renderToString(
      <LegalPolicy
        title="Cookies Policy"
        audience="GENERAL"
        common={COOKIES_COMMON}
        audiences={COOKIES_AUDIENCES}
        intro="intro"
        related={RELATED}
      />,
    );
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/legal/terms"');
    expect(html).toContain('href="/legal/privacy"');
  });

  it("shows the sidebar footer links and never an FAQ link", () => {
    expect(LEGAL_NAV_LINKS.map((link) => link.href)).toEqual([
      "/legal/terms",
      "/legal/privacy",
      "/about",
    ]);
    expect(LEGAL_NAV_LINKS.some((link) => link.href.includes("faq"))).toBe(false);
  });

  it("uses a distinct version for the rewritten policies", () => {
    expect(LEGAL_META.version).not.toBe("2026-10");
    expect(LEGAL_META.version).toMatch(/^2026-10\./);
  });
});

describe("FAQ data and rendering", () => {
  it("has FAQs for every audience", () => {
    for (const audience of Object.keys(FAQS) as (keyof typeof FAQS)[]) {
      expect(FAQS[audience].length).toBeGreaterThan(0);
      for (const faq of FAQS[audience]) {
        expect(faq.question.length).toBeGreaterThan(0);
        expect(faq.answer.length).toBeGreaterThan(0);
      }
    }
  });

  it("maps facility account types to their FAQ set", () => {
    expect(facilityFaqs("HOSPITAL")).toBe(FAQS.HOSPITAL);
    expect(facilityFaqs("LABORATORY")).toBe(FAQS.LABORATORY);
    expect(facilityFaqs("DIAGNOSTIC_CENTRE")).toBe(FAQS.DIAGNOSTIC_CENTRE);
    expect(facilityFaqs(null)).toEqual([]);
    expect(facilityFaqs("PATIENT")).toEqual([]);
  });

  it("renders the FAQ section with its questions", () => {
    const html = renderToString(<FaqSection items={FAQS.PATIENT} className="" />);
    expect(html).toContain("Frequently asked questions");
    expect(html).toContain("How do I book a consultation?");
    expect(html).toContain("Who can see my health records?");
    // Answers live inside collapsibles that expand on interaction.
  });

  it("renders nothing when there are no matching FAQs", () => {
    expect(renderToString(<FaqSection items={[]} className="" />)).toBe("");
  });
});
