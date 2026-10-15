import { z } from "zod";
const reading = z.discriminatedUnion("metric", [
  z.object({ metric: z.literal("steps"), value: z.number().int().min(0).max(100000), recordedAt: z.iso.datetime() }),
  z.object({ metric: z.literal("resting_heart_rate"), value: z.number().min(20).max(250), recordedAt: z.iso.datetime() }),
  z.object({ metric: z.literal("sleep_hours"), value: z.number().min(0).max(24), recordedAt: z.iso.datetime() }),
]);
export const wearableImportSchema = z.object({ consent: z.literal(true), source: z.string().trim().min(1).max(80), readings: z.array(reading).min(1).max(365) });
