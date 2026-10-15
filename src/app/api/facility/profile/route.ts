import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedFacilityProfile } from "@/lib/access";

const select = { addressLine: true, city: true, state: true, operatingHours: true, about: true } as const;
const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);

const schema = z.object({
  addressLine: text(200),
  city: text(100),
  state: text(100),
  operatingHours: text(200),
  about: text(1000),
});

// GET /api/facility/profile — location, opening hours and description shown to patients.
export const GET = withAuth(["LAB_SCIENTIST"], async (_req, { user }) => {
  const profile = await getVerifiedFacilityProfile(user);
  return NextResponse.json({ profile: await prisma.labStaffProfile.findUniqueOrThrow({ where: { id: profile.id }, select }) });
});

// PUT /api/facility/profile
export const PUT = withAuth(["LAB_SCIENTIST"], async (req, { user }) => {
  const profile = await getVerifiedFacilityProfile(user);
  const data = await parseBody(req, schema);
  return NextResponse.json({ profile: await prisma.labStaffProfile.update({ where: { id: profile.id }, data, select }) });
});
