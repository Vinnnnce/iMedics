import { z } from "zod";
import { currencySchema, priceSchema } from "./money";

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Enter a service name").max(120),
  description: z.string().trim().max(1000).transform((v) => v || null).optional(),
  category: z.enum(["LAB_TEST", "IMAGING", "PROCEDURE", "CONSULTATION", "OTHER"]).default("LAB_TEST"),
  price: priceSchema,
  currency: currencySchema,
  turnaroundHours: z.number().int().min(1).max(720).nullable().optional(),
  /** Free text such as "Mon–Sat 8am–4pm" or "Walk-in, no appointment needed". */
  availability: z.string().trim().max(200).transform((v) => v || null).nullable().optional(),
  /** Optional branch/location label for facilities that price per branch. */
  branch: z.string().trim().max(80).transform((v) => v || null).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const serviceSelect = {
  id: true,
  name: true,
  description: true,
  category: true,
  price: true,
  currency: true,
  turnaroundHours: true,
  availability: true,
  branch: true,
  isActive: true,
  updatedAt: true,
} as const;

export const serializeService = <T extends { price: { toString(): string } }>(s: T) => ({ ...s, price: Number(s.price) });

export const CATEGORY_LABEL = { LAB_TEST: "Lab test", IMAGING: "Imaging", PROCEDURE: "Procedure", CONSULTATION: "Consultation", OTHER: "Other" } as const;
export type ServiceCategoryKey = keyof typeof CATEGORY_LABEL;
