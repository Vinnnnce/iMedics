import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth, parseBody } from "@/lib/api";
import { prisma } from "@/lib/prisma";

function tourKey(user: { role: string; accountType: string | null; status: string }) {
  return `workspace-v1:${user.role}:${user.accountType ?? "GENERAL"}:${user.status}`;
}
export const GET = withAuth(null, async (_req, { user }) => {
  const key = tourKey(user);
  const tour = await prisma.productTour.findUnique({ where: { userId_tourKey: { userId: user.id, tourKey: key } } });
  return NextResponse.json(tour ?? { status: "NOT_STARTED", step: 0 });
}, { allowOnboarding: true });
export const PATCH = withAuth(null, async (req, { user }) => {
  const data = await parseBody(req, z.object({ status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "SKIPPED"]), step: z.number().int().min(0).max(100) }));
  const key = tourKey(user);
  const tour = await prisma.productTour.upsert({
    where: { userId_tourKey: { userId: user.id, tourKey: key } },
    create: { userId: user.id, tourKey: key, ...data }, update: data,
  });
  return NextResponse.json({ status: tour.status, step: tour.step });
}, { allowOnboarding: true });
