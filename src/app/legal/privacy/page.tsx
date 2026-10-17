import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { LegalPolicy } from "@/components/legal/legal-policy";
import { policyAudienceFor } from "@/lib/legal/types";
import { PRIVACY_AUDIENCES, PRIVACY_COMMON } from "@/lib/legal/privacy";

export const metadata: Metadata = {
  title: "Privacy Policy — Medic1905",
  description:
    "How Medic1905 collects, uses, shares and protects your personal and health data, tailored to your account type and compliant with the Nigeria Data Protection Act 2023.",
};

export default async function PrivacyPage() {
  const user = await getCurrentUser();
  const audience = policyAudienceFor(user);

  return (
    <LegalPolicy
      title="Privacy Policy"
      audience={audience}
      common={PRIVACY_COMMON}
      audiences={PRIVACY_AUDIENCES}
      intro="This policy explains how we handle your personal and health data under Nigerian law — including the Constitution, the Nigeria Data Protection Act 2023, the National Health Act 2014 and your professional obligations if you are a provider. It is tailored to your account type."
      related={[
        { href: "/legal/terms", label: "Terms of Use" },
        { href: "/legal/cookies", label: "Cookies Policy" },
        { href: "/about", label: "About Medic1905" },
      ]}
    />
  );
}
