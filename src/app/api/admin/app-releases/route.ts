// Administrator app-release management API.
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { releaseInput } from "@/lib/app-release-schemas";

export const GET = withAuth(["ADMIN"], async () => {
  const releases = await prisma.appRelease.findMany({ orderBy: [{ platform: "asc" }, { releaseDate: "desc" }] });
  const totals = await prisma.appRelease.groupBy({
    by: ["platform"],
    _sum: { downloadCount: true, failureCount: true },
  });
  return NextResponse.json({ releases, totals });
});

export const POST = withAuth(["ADMIN"], async (req: NextRequest) => {
  const input = await parseBody(req, releaseInput);
  // Only one current release per platform.
  if (input.isCurrent) {
    await prisma.appRelease.updateMany({ where: { platform: input.platform, isCurrent: true }, data: { isCurrent: false } });
  }
  const release = await prisma.appRelease.create({ data: input });
  return NextResponse.json({ release });
});
