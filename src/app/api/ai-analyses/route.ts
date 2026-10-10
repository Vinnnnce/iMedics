import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { listPendingReview } from "@/lib/data/ai-review";

// GET /api/ai-analyses — the doctor's review queue: completed AI analyses, for patients in their care,
// that are waiting for approval.
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  return NextResponse.json({ analyses: await listPendingReview(user) });
});
