import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest } from "@/lib/errors";
import { writeAudit } from "@/lib/audit";
import { doctorPortfolioInputSchema } from "@/lib/doctor-profile";

const portfolioSelect = {
  id: true,
  type: true,
  title: true,
  description: true,
  externalUrl: true,
  publishedAt: true,
  attachmentFileId: true,
  visibility: true,
  consentStatus: true,
  consentAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

// GET /api/doctors/me/portfolio — the signed-in doctor's portfolio items (all, with consent state).
export const GET = withAuth(["DOCTOR"], async (_req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const items = await prisma.doctorPortfolioItem.findMany({
    where: { doctorId: doctor.id },
    orderBy: [{ publishedAt: "desc" as const }, { createdAt: "desc" as const }],
    select: portfolioSelect,
  });
  return NextResponse.json({ items });
});

// POST /api/doctors/me/portfolio — add a portfolio item (private by default).
// Case studies must be consent-approved before they become public; the doctor records that consent here.
export const POST = withAuth(["DOCTOR"], async (req, { user }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const data = await parseBody(req, doctorPortfolioInputSchema);

  if (data.attachmentFileId) {
    const file = await prisma.doctorFile.findUnique({ where: { id: data.attachmentFileId }, select: { doctorId: true } });
    if (!file || file.doctorId !== doctor.id) throw badRequest("That attachment was not found among your uploads");
  }

  const created = await prisma.doctorPortfolioItem.create({
    data: {
      doctorId: doctor.id,
      type: data.type,
      title: data.title,
      description: data.description || null,
      externalUrl: data.externalUrl || null,
      publishedAt: data.publishedAt ?? null,
      attachmentFileId: data.attachmentFileId,
      visibility: data.visibility,
      consentStatus: data.consentStatus,
      consentAt: data.consentStatus === "GRANTED" ? new Date() : null,
    },
    select: portfolioSelect,
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DOCTOR_PORTFOLIO_ITEM_CREATED",
    resourceType: "DoctorPortfolioItem",
    resourceId: created.id,
    details: { type: data.type, title: data.title, visibility: data.visibility, consentStatus: data.consentStatus },
    req,
  });

  return NextResponse.json({ item: created }, { status: 201 });
});
