// Zod schemas shared by the app-release API routes.
import { z } from "zod";
import { isReleasePlatform } from "./app-releases";

export const releaseInput = z.object({
  platform: z.string().refine(isReleasePlatform, "platform must be ANDROID, IOS or WINDOWS"),
  channel: z.string().default("stable"),
  version: z.string().min(1),
  buildNumber: z.number().int().min(1).default(1),
  fileUrl: z.string().url().nullable().optional(),
  fileName: z.string().nullable().optional(),
  fileSizeBytes: z.number().int().min(0).nullable().optional(),
  checksumSha256: z.string().nullable().optional(),
  minOsVersion: z.string().nullable().optional(),
  releaseNotes: z.string().default(""),
  storeUrl: z.string().url().nullable().optional(),
  testFlightUrl: z.string().url().nullable().optional(),
  releaseDate: z.coerce.date().optional(),
  published: z.boolean().default(false),
  isCurrent: z.boolean().default(false),
});

export const releasePatch = releaseInput.partial();
