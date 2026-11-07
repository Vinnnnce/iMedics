import { PRIVACY_COMMON, PRIVACY_AUDIENCES } from "./privacy";
import { TERMS_COMMON, TERMS_AUDIENCES } from "./terms";
import { COOKIES_COMMON, COOKIES_AUDIENCES } from "./cookies";
import { LEGAL_META } from "./types";

/** A release is immutable once accepted. Material changes require a new version. */
export const POLICY_RELEASE = {
  version: "2026-11.1-draft",
  status: "DRAFT" as "DRAFT" | "PUBLISHED",
  effectiveDate: null as string | null,
  updatedAt: "2026-11-04",
  jurisdiction: "Nigeria",
  documents: {
    privacy: { title: "Privacy Policy", common: PRIVACY_COMMON, audiences: PRIVACY_AUDIENCES },
    terms: { title: "Terms of Use", common: TERMS_COMMON, audiences: TERMS_AUDIENCES },
    cookies: { title: "Cookie Policy", common: COOKIES_COMMON, audiences: COOKIES_AUDIENCES },
  },
};

export function policyCanBeAccepted() {
  return POLICY_RELEASE.status === "PUBLISHED" && Boolean(POLICY_RELEASE.effectiveDate) &&
    !LEGAL_META.operatorName.startsWith("[") && !LEGAL_META.operatorAddress.startsWith("[");
}
