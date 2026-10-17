import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseBody, parseId } from "@/lib/api";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { badRequest, notFound } from "@/lib/errors";
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



async function ownItem(doctorId: string, id: string) {
  const item = await prisma.doctorPortfolioItem.findUnique({ where: { id }, select: { doctorId: true } });
  if (!item || item.doctorId !== doctorId) throw notFound("Portfolio item not found");
}

// PUT /api/doctors/me/portfolio/[id] — edit one of the doctor's own portfolio items.
// Granting consent timestamps it server-side; a case study cannot be public without GRANTED consent.
export const PUT = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  await ownItem(doctor.id, id);
  const data = await parseBody(req, doctorPortfolioInputSchema);

  if (data.attachmentFileId) {
    const file = await prisma.doctorFile.findUnique({ where: { id: data.attachmentFileId }, select: { doctorId: true } });
    if (!file || file.doctorId !== doctor.id) throw badRequest("That attachment was not found among your uploads");
  }

  const previous = await prisma.doctorPortfolioItem.findUniqueOrThrow({ where: { id }, select: { consentAt: true } });
  const consentAt = data.consentStatus === "GRANTED" ? (previous.consentAt ?? new Date()) : null;
  const effectiveVisibility = data.visibility === "PUBLIC" && data.type === "CASE_STUDY" && data.consentStatus !== "GRANTED" ? "PRIVATE" : data.visibility;

  const updated = await prisma.doctorPortfolioItem.update({
    where: { id },
    data: {
      type: data.type,
      title: data.title,
      description: data.description || null,
      externalUrl: data.externalUrl || null,
      publishedAt: data.publishedAt ?? null,
      attachmentFileId: data.attachmentFileId,
      visibility: effectiveVisibility,
      consentStatus: data.consentStatus,
      consentAt,
    },
    select: portfolioSelect,
  });

  await writeAudit({
    userId: user.id,
    actorRole: user.role,
    action: "DOCTOR_PORTFOLIO_ITEM_UPDATED",
    resourceType: "DoctorPortfolioItem",
    resourceId: id,
    details: { title: data.title, visibility: updated.visibility, consentStatus: updated.consentStatus },
    req,
  });

  return NextResponse.json({ item: updated });
});

// DELETE /api/doctors/me/portfolio/[id] — remove one of the doctor's own portfolio items.
export const DELETE = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const id = parseId((await params).id);
  await ownItem(doctor.id, id);

  await prisma.doctorPortfolioItem.delete({ where: { id } });
  await writeAudit({ userId: user.id, actorRole: user.role, action: "DOCTOR_PORTFOLIO_ITEM_DELETED", resourceType: "DoctorPortfolioItem", resourceId: id, req });
  return NextResponse.json({ deleted: true });
});
