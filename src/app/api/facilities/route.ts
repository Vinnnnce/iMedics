import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { listFacilities } from "@/lib/facilities";

const querySchema = z.object({
  search: z.string().trim().max(100).optional(),
  city: z.string().trim().max(100).optional(),
  category: z.enum(["LAB_TEST", "IMAGING", "PROCEDURE", "CONSULTATION", "OTHER"]).optional(),
});

// GET /api/facilities — verified laboratories, diagnostic centres and hospitals with their priced services.
export const GET = withAuth(null, async (req) => {
  return NextResponse.json({ facilities: await listFacilities(parseQuery(req, querySchema)) });
});
