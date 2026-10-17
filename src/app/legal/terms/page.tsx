import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { LegalPolicy } from "@/components/legal/legal-policy";
import { policyAudienceFor } from "@/lib/legal/types";
import { TERMS_AUDIENCES, TERMS_COMMON } from "@/lib/legal/terms";

export const metadata: Metadata = {
  title: "Terms of Use — Medic1905",
  description:
    "The terms that govern your use of Medic1905, tailored to your account type and aligned with Nigerian law.",
};

export default async function TermsPage() {
  const user = await getCurrentUser();
  const audience = policyAudienceFor(user);

  return (
    <LegalPolicy
      title="Terms of Use"
      audience={audience}
      common={TERMS_COMMON}
      audiences={TERMS_AUDIENCES}
      intro="These Terms set out the rules for using the Medic1905 platform: what the platform is, what each account type may do, and the legal framework that applies in Nigeria. Sections marked for your account type apply to you specifically."
      related={[
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/legal/cookies", label: "Cookies Policy" },
        { href: "/about", label: "About Medic1905" },
      ]}
    />
  );
}
