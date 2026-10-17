import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { LegalPolicy } from "@/components/legal/legal-policy";
import { policyAudienceFor } from "@/lib/legal/types";
import { COOKIES_AUDIENCES, COOKIES_COMMON } from "@/lib/legal/cookies";

export const metadata: Metadata = {
  title: "Cookies Policy — Medic1905",
  description:
    "How Medic1905 uses cookies and similar technologies, and how you can control them.",
};

export default async function CookiesPage() {
  const user = await getCurrentUser();
  const audience = policyAudienceFor(user);

  return (
    <LegalPolicy
      title="Cookies Policy"
      audience={audience}
      common={COOKIES_COMMON}
      audiences={COOKIES_AUDIENCES}
      intro="This policy explains the cookies and similar technologies the platform uses, why each one is needed, and how to control them. We do not use advertising or cross-site tracking cookies."
      related={[
        { href: "/legal/terms", label: "Terms of Use" },
        { href: "/legal/privacy", label: "Privacy Policy" },
        { href: "/about", label: "About Medic1905" },
      ]}
    />
  );
}
