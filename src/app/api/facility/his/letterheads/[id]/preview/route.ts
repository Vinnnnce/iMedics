import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { notFound } from "@/lib/errors";
import { requireHisAccess } from "@/lib/his/access";
import { letterheadView } from "@/lib/letterheads";
import { renderLetterheadPreviewPdf } from "@/lib/his/letterhead-preview";

// GET /api/facility/his/letterheads/[id]/preview — a sample document rendered
// under this letterhead so managers can proof the branding before approving it.
export const GET = withAuth<{ id: string }>(null, async (req, { user, params }) => {
  const access = await requireHisAccess(user, "MANAGE_HOSPITAL_SETTINGS", req);
  const profile = await prisma.letterheadProfile.findFirst({ where: { id: parseId((await params).id), facilityId: access.facility.id } });
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
