import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { getVerifiedDoctorProfile } from "@/lib/access";
import { letterheadView } from "@/lib/letterheads";
import { renderLetterheadPreviewPdf } from "@/lib/his/letterhead-preview";

// GET /api/doctors/me/letterheads/[id]/preview — a sample document rendered
// under the doctor's own letterhead for proofing.
export const GET = withAuth<{ id: string }>(["DOCTOR"], async (req, { user, params }) => {
  const doctor = await getVerifiedDoctorProfile(user);
  const profile = await prisma.letterheadProfile.findFirst({ where: { id: parseId((await params).id), userId: doctor.userId } });
  if (!profile) throw notFound("Letterhead not found");
  const bytes = await renderLetterheadPreviewPdf(letterheadView(profile));
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="letterhead-preview-${profile.name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase()}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
});
