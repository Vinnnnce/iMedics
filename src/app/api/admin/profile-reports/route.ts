import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { notFound } from "@/lib/errors";

// GET /api/admin/profile-reports — open reports first (admin only)
export const GET = withAuth(["ADMIN"], async () => {
  const reports = await prisma.profileReport.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
  return NextResponse.json({ reports });
});

const updateSchema = z.object({ id: z.string().uuid(), status: z.enum(["REVIEWED", "DISMISSED"]) });

// PATCH /api/admin/profile-reports — close a report as reviewed or dismissed
export const PATCH = withAuth(["ADMIN"], async (req, { user }) => {
  const { id, status } = await parseBody(req, updateSchema);
  const existing = await prisma.profileReport.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Report not found");
  const report = await prisma.profileReport.update({
    where: { id },
    data: { status, reviewedAt: new Date(), reviewedById: user.id },
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "PROFILE_REPORT_REVIEWED", resourceType: "ProfileReport", resourceId: id, details: { status }, req });
  return NextResponse.json({ success: true, report });
});
