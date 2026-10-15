import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseQuery } from "@/lib/api";
import { searchIcd10 } from "@/lib/icd10/service";

const querySchema = z.object({
  q: z.string().trim().max(100).default(""),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// GET /api/icd10?q=hypertension|I10 — search assignable ICD-10 codes by code or diagnosis name.
export const GET = withAuth(["DOCTOR", "ADMIN"], async (req) => {
  const { q, limit } = parseQuery(req, querySchema);
  const { release, results } = await searchIcd10(q, limit);
  return NextResponse.json(
    {
      release: release && { label: release.label, edition: release.edition, jurisdiction: release.jurisdiction },
      results,
    },
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
});
