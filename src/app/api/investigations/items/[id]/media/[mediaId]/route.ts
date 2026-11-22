import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth, parseId } from "@/lib/api";
import { findAccessiblePatient } from "@/lib/access";
import { notFound } from "@/lib/errors";
import { presignView } from "@/lib/storage";
import { auditInvestigation } from "@/lib/investigations/service";

type Params = { id: string; mediaId: string };

// GET /api/investigations/items/[id]/media/[mediaId] — short-lived view URL, only for media of a RELEASED report.
export const GET = withAuth<Params>(["DOCTOR", "PATIENT"], async (req, { user, params }) => {
  const p = await params;
  const itemId = parseId(p.id);
  const mediaId = parseId(p.mediaId);
  const media = await prisma.investigation_media.findFirst({
    where: { id: mediaId, itemId, result: { status: "RELEASED", ...(user.role === "PATIENT" ? { patientVisible: true } : {}) } },
    include: { item: { select: { order: { select: { patientId: true, requestedById: true } } } } },
  });
  if (!media) throw notFound("Media not found");
  const o = media.item.order;
  if (!(user.role === "DOCTOR" && o.requestedById === user.id)) await findAccessiblePatient(user, o.patientId).catch(() => { throw notFound("Media not found"); });
  await auditInvestigation(user, "INVESTIGATION_MEDIA_VIEWED", itemId, { patientId: o.patientId, req });
  return NextResponse.json({ url: await presignView(media.storageKey, media.fileName), fileName: media.fileName, mimeType: media.mimeType });
});
