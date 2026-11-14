// Public download-centre data: the current published release for each
// platform. Cache briefly so the homepage footer stays fast.
import { NextResponse } from "next/server";
import { getCurrentReleases } from "@/lib/app-releases";

export const revalidate = 60;

export async function GET() {
  const releases = await getCurrentReleases();
  return NextResponse.json(
    { releases },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
