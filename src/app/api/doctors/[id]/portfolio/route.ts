import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { portfolioItemIsPublic, serializePublicPortfolioItem } from "@/lib/doctor-profile";

// GET /api/doctors/[id]/portfolio — the doctor's published portfolio.
// Only PUBLIC items are returned; case studies additionally require recorded GRANTED consent.
// Attachment downloads are separate, permission-checked endpoints (nothing is public by URL).
export const GET = withAuth<{ id: string }>(null, async (_req, { params }) => {
  const doctorId = parseId((await params).id);

  const doctor = await prisma.doctorProfile.findFirst({
    where: { id: doctorId, verificationStatus: "VERIFIED", user: { status: "ACTIVE", deletedAt: null } },
    select: { id: true },
  });
  if (!doctor) throw notFound("Doctor not found");

  const items = await prisma.doctorPortfolioItem.findMany({
    where: { doctorId, visibility: "PUBLIC" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    select: { id: true, type: true, title: true, description: true, externalUrl: true, publishedAt: true, attachmentFileId: true, consentStatus: true, visibility: true },
    take: 100,
  });

  return NextResponse.json({
    items: items.filter(portfolioItemIsPublic).map(serializePublicPortfolioItem),
  });
});
