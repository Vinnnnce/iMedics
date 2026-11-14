// Download tracking: counts a download then redirects to the installer
// (object storage or GitHub Release asset). Never auto-started — the user
// explicitly taps the download button, which links here.
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const release = await prisma.appRelease.findUnique({ where: { id } });
  if (!release || !release.published) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }
  const target = release.fileUrl || release.storeUrl;
  if (!target) {
    return NextResponse.json({ error: "This release has no downloadable file yet" }, { status: 404 });
  }
  await prisma.appRelease.update({
    where: { id },
    data: { downloadCount: { increment: 1 } },
  }).catch(() => {/* counter best-effort */});
  return NextResponse.redirect(target, { status: 302 });
}
