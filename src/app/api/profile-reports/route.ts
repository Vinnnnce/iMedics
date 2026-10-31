import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { badRequest, conflict, notFound } from "@/lib/errors";
import { MAX_REPORTS_PER_DAY, createReportSchema } from "@/lib/profile-reports";

// POST /api/profile-reports — a signed-in user flags a doctor or facility
// profile for admin review. One open report per user and profile, a daily cap
// per user, and you cannot report your own profile.
export const POST = withAuth(null, async (req, { user }) => {
  const { targetType, targetId, reason, details } = await parseBody(req, createReportSchema);

  const owner =
    targetType === "DOCTOR"
      ? await prisma.doctorProfile.findUnique({ where: { id: targetId }, select: { userId: true } })
      : await prisma.labStaffProfile.findFirst({ where: { id: targetId, isPublished: true }, select: { userId: true } });
  if (!owner) throw notFound("Profile not found");
  if (owner.userId === user.id) throw badRequest("You cannot report your own profile");

  const [open, today] = await Promise.all([
    prisma.profileReport.findFirst({ where: { reporterId: user.id, targetType, targetId, status: "OPEN" }, select: { id: true } }),
    prisma.profileReport.count({ where: { reporterId: user.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
  ]);
  if (open) throw conflict("You have already reported this profile. Our team will review it.");
  if (today >= MAX_REPORTS_PER_DAY) throw badRequest("You have reached today's limit for reports. Please try again tomorrow.");

  const report = await prisma.profileReport.create({
    data: { reporterId: user.id, targetType, targetId, reason, details: details || null },
    select: { id: true },
  });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "PROFILE_REPORTED", resourceType: `${targetType}Profile`, resourceId: targetId, details: { reason }, req });
  return NextResponse.json({ success: true, id: report.id }, { status: 201 });
});
