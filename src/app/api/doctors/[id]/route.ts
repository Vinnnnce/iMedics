import { NextResponse } from "next/server";
import { withAuth, parseId } from "@/lib/api";
import { getDoctorProfileView } from "@/lib/data/doctors";
import { notFound } from "@/lib/errors";

// GET /api/doctors/[id] — public profile of a verified doctor, with recent reviews.
// For patients it also says whether they have liked the doctor and may leave a review.
export const GET = withAuth<{ id: string }>(null, async (_req, { user, params }) => {
  const view = await getDoctorProfileView(parseId((await params).id), user);
  if (!view) throw notFound("Doctor not found");
  return NextResponse.json(view);
});
