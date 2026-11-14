/**
 * Tauri updater endpoint for the Windows desktop app.
 * GET /api/app-releases/updates/{target}/{current_version}
 * Returns a Tauri update manifest when a newer signed WINDOWS release
 * exists, otherwise 204 No Content.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPlatformLabel } from "@/lib/app-releases";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ target: string; current_version: string }> },
) {
  const { target, current_version } = await ctx.params;
  const platform = getPlatformLabel(target);
  if (platform !== "WINDOWS") {
    return new NextResponse(null, { status: 204 });
  }
  const latest = await prisma.appRelease.findFirst({
    where: { platform: "WINDOWS", published: true },
    orderBy: { version: "desc" },
  });
  const semverGt = (a: string, b: string) => {
    const pa = a.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    const pb = b.replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] || 0) > (pb[i] || 0)) return true;
      if ((pa[i] || 0) < (pb[i] || 0)) return false;
    }
    return false;
  };
  if (!latest || !semverGt(latest.version, current_version)) {
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json({
    version: latest.version,
    notes: latest.releaseNotes ?? undefined,
    pub_date: latest.releaseDate?.toISOString() ?? new Date().toISOString(),
    platforms: {
      [target]: {
        signature: latest.updateSignature ?? "",
        url: latest.fileUrl,
      },
    },
  });
}
