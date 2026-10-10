import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { listDoctors } from "@/lib/data/doctors";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  specialty: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

// GET /api/doctors — directory of verified doctors who are accepting patients.
// Only public profile fields are returned (never licence or registration numbers).
export const GET = withAuth(null, async (req) => {
  return NextResponse.json(await listDoctors(parseQuery(req, querySchema)));
});
