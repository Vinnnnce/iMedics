import { NextResponse } from "next/server";
import { withAuth } from "@/lib/api";
import { badRequest } from "@/lib/errors";
import { loadDoctorPerformance } from "@/lib/analytics/doctor";
import { PeriodError } from "@/lib/analytics/periods";
import { parseRangeInput } from "@/lib/analytics";

// GET /api/doctors/me/performance — the signed-in doctor's own workload and documentation statistics.
export const GET = withAuth(["DOCTOR"], async (req, { user }) => {
  try {
    return NextResponse.json(await loadDoctorPerformance(user, parseRangeInput(new URL(req.url).searchParams)));
  } catch (e) {
    if (e instanceof PeriodError) throw badRequest(e.message);
    throw e;
  }
});
