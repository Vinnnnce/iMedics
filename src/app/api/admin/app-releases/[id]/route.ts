// Update / delete an app release (admin).
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { releasePatch } from "@/lib/app-release-schemas";
import { notFound } from "@/lib/errors";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAuth(["ADMIN"], async (req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const input = await parseBody(req, releasePatch);
  const existing = await prisma.appRelease.findUnique({ where: { id } });
  if (!existing) throw notFound("Release not found");
  if (input.isCurrent) {
    await prisma.appRelease.updateMany({
      where: { platform: existing.platform, isCurrent: true, id: { not: id } },
      data: { isCurrent: false },
    });
  }
  const release = await prisma.appRelease.update({ where: { id }, data: input });
  return NextResponse.json({ release });
});

export const DELETE = withAuth(["ADMIN"], async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const existing = await prisma.appRelease.findUnique({ where: { id } });
  if (!existing) throw notFound("Release not found");
  await prisma.appRelease.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
