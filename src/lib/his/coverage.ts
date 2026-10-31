import { z } from "zod";

export const PAYER_CATEGORIES = ["PUBLIC_INSURANCE", "PRIVATE_INSURANCE", "EMPLOYER_SPONSORED", "GOVERNMENT_SUBSIDIZED", "INTERNATIONAL_INSURANCE", "TRAVEL_INSURANCE", "SELF_PAY", "UNINSURED", "CHARITY", "OTHER"] as const;
export const INSURED = ["PUBLIC_INSURANCE", "PRIVATE_INSURANCE", "EMPLOYER_SPONSORED", "GOVERNMENT_SUBSIDIZED", "INTERNATIONAL_INSURANCE", "TRAVEL_INSURANCE"] as const;

export const coverageBody = z.object({
  category: z.enum(PAYER_CATEGORIES),
  rank: z.number().int().min(1).max(2).default(1),
  providerName: z.string().trim().max(160).nullish(),
  planName: z.string().trim().max(160).nullish(),
  memberNumber: z.string().trim().max(80).nullish(),
  coverageStart: z.string().date().nullish(),
  coverageEnd: z.string().date().nullish(),
  benefitNotes: z.string().max(2000).nullish(),
  referralRequired: z.boolean().optional(),
  preauthRequired: z.boolean().optional(),
  authorizationNumber: z.string().trim().max(80).nullish(),
  authorizationExpires: z.string().date().nullish(),
  billingResponsibility: z.string().trim().max(160).nullish(),
  copayKobo: z.number().int().min(0).nullish(),
  outOfPocketKobo: z.number().int().min(0).nullish(),
});

export function toDates<T extends Record<string, unknown>>(data: T) {
  const out: Record<string, unknown> = { ...data };
  for (const k of ["coverageStart", "coverageEnd", "authorizationExpires"]) if (typeof out[k] === "string") out[k] = new Date(out[k] as string);
  return out;
}

