import { NextResponse } from "next/server";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getFacility } from "@/lib/facilities";

// GET /api/facilities/[id] — one facility with its active services and prices.
export const GET = withAuth<{ id: string }>(null, async (_req, { params }) => {
  const facility = await getFacility(parseId((await params).id));
  if (!facility) throw notFound("Facility not found");
  return NextResponse.json({ facility });
});
