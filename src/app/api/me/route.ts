import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { loadMe } from "@/lib/me";

// GET /api/me — the signed-in user's authoritative role and onboarding state.
// The client uses this for routing; it must never trust Clerk metadata for that.
// Readable while onboarding: the signup wizard routes on this response.
export const GET = withAuth(
  null,
  async (_req, { user }) => NextResponse.json(await loadMe(user)),
  { allowOnboarding: true },
);

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    phone: z.string().trim().max(30).nullable().optional(),
    language: z
      .string()
      .regex(/^[a-z]{2}$/, "Use a two-letter language code")
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update" });

// PATCH /api/me — update your own display name, phone number or language.
// Role, status and email cannot be changed here.
export const PATCH = withAuth(null, async (req, { user }) => {
  const data = await parseBody(req, updateSchema);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data,
    select: { name: true, phone: true, language: true },
  });
  return NextResponse.json(updated);
});
