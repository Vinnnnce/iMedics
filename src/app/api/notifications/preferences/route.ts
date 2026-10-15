import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { CONFIGURABLE_CATEGORIES, getPreferenceMatrix, savePreferences, type PreferenceMatrix } from "@/lib/notifications/preferences";
import { isPushConfigured } from "@/lib/notifications/push";

const channels = z.object({ IN_APP: z.boolean(), EMAIL: z.boolean(), PUSH: z.boolean() });
const schema = z.object(Object.fromEntries(CONFIGURABLE_CATEGORIES.map((c) => [c, channels.optional()])) as Record<(typeof CONFIGURABLE_CATEGORIES)[number], z.ZodOptional<typeof channels>>);

// GET /api/notifications/preferences — the caller's notification settings.
export const GET = withAuth(null, async (_req, { user }) => {
  return NextResponse.json({
    preferences: await getPreferenceMatrix(user.id),
    pushAvailable: isPushConfigured(),
    vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null,
  });
});

// PUT /api/notifications/preferences — update some or all categories.
export const PUT = withAuth(null, async (req, { user }) => {
  const update = (await parseBody(req, schema)) as Partial<PreferenceMatrix>;
  await savePreferences(user.id, update);
  return NextResponse.json({ preferences: await getPreferenceMatrix(user.id) });
});
